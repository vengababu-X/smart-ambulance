import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import Emergency from "@/models/Emergency";
import Hospital from "@/models/Hospital";

function determinePriority(
  severityScore: number,
  symptoms: string[]
): "RED" | "YELLOW" | "GREEN" {
  const text = symptoms.join(" ").toLowerCase();
  const redKeywords = [
    "chest pain",
    "severe bleeding",
    "unconscious",
    "stroke",
    "heart attack",
    "road accident",
    "trauma",
    "difficulty breathing",
  ];
  const yellowKeywords = [
    "shortness of breath",
    "infection",
    "fever",
    "dizziness",
    "nausea",
    "allergic",
    "fracture",
    "bleeding",
  ];

  if (
    severityScore >= 8 ||
    redKeywords.some((k) => text.includes(k))
  )
    return "RED";
  if (severityScore >= 5 || yellowKeywords.some((k) => text.includes(k)))
    return "YELLOW";
  return "GREEN";
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const latitude = Number(body.latitude ?? body.lat);
    const longitude = Number(body.longitude ?? body.lng);
    const symptoms: string[] = Array.isArray(body.symptoms)
      ? body.symptoms.map((s: unknown) => String(s).trim()).filter(Boolean)
      : typeof body.symptoms === "string"
      ? body.symptoms
          .split(/[,\n]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    const patientName = String(body.patientName || "Unknown Patient").trim();
    const patientContact = String(
      body.patientContact || body.phone || "0000000000"
    ).trim();
    const severityScore = Math.min(
      10,
      Math.max(1, Number(body.severityScore) || 5)
    );

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, error: "Valid coordinates are required." },
        { status: 400 }
      );
    }

    if (symptoms.length === 0) {
      return NextResponse.json(
        { success: false, error: "Symptoms are required." },
        { status: 400 }
      );
    }

    const priority = determinePriority(severityScore, symptoms);
    const emergencyId = `EMG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Find nearest AVAILABLE ambulance
    const ambulance = await Ambulance.findOne({
      status: "AVAILABLE",
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: 25000,
        },
      },
    }).lean();

    if (!ambulance) {
      return NextResponse.json(
        {
          success: false,
          message: "No available ambulance within 25km radius.",
        },
        { status: 404 }
      );
    }

    await Ambulance.findByIdAndUpdate(ambulance._id, {
      status: "DISPATCHED",
    });

    // Find nearest non-capacity hospital
    const hospital = await Hospital.findOne({
      isAtCapacity: false,
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: 30000,
        },
      },
    }).lean();

    // Fallback to nearest hospital
    const assignedHospital =
      hospital ||
      (await Hospital.findOne({
        location: {
          $nearSphere: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: 50000,
          },
        },
      }).lean());

    if (assignedHospital) {
      const bedDecrement: Record<string, number> = {};
      if (assignedHospital.availableBeds > 0)
        bedDecrement.availableBeds = -1;
      if (priority === "RED" && assignedHospital.availableIcu > 0)
        bedDecrement.availableIcu = -1;
      if (Object.keys(bedDecrement).length > 0) {
        await Hospital.findByIdAndUpdate(assignedHospital._id, {
          $inc: bedDecrement,
        });
      }
      const updated = await Hospital.findById(assignedHospital._id).lean();
      if (updated && updated.availableBeds <= 0) {
        await Hospital.findByIdAndUpdate(assignedHospital._id, {
          isAtCapacity: true,
        });
      }
    }

    const emergency = await Emergency.create({
      emergencyId,
      patientName,
      patientContact,
      symptoms,
      severityScore,
      priority,
      patientCoordinates: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      status: "ASSIGNED",
      assignedAmbulanceId: String(ambulance._id),
      assignedAmbulanceVehicle: ambulance.vehicleNumber,
      destinationHospitalId: assignedHospital
        ? String(assignedHospital._id)
        : null,
      destinationHospitalName: assignedHospital
        ? assignedHospital.name
        : null,
    });

    // Mock Fast2SMS
    console.log("[Fast2SMS MOCK] SOS Alert:", {
      to: patientContact,
      message: `SOS: ${patientName}. Symptoms: ${symptoms.join(", ")}. Priority: ${priority}. Ambulance: ${ambulance.vehicleNumber}.`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Emergency SOS dispatched.",
        emergency: {
          id: emergency._id,
          emergencyId,
          priority,
          status: "ASSIGNED",
          assignedAmbulanceVehicle: ambulance.vehicleNumber,
          destinationHospitalName: assignedHospital?.name || null,
          createdAt: emergency.createdAt,
        },
        ambulance: {
          id: ambulance._id,
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName,
          status: "DISPATCHED",
          location: ambulance.location,
        },
        hospital: assignedHospital
          ? {
              id: assignedHospital._id,
              name: assignedHospital.name,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("SOS API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while processing SOS request.",
      },
      { status: 500 }
    );
  }
}
