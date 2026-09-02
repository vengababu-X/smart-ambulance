import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import Emergency from "@/models/Emergency";
import Hospital from "@/models/Hospital";
import User from "@/models/User";

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

/**
 * Unified ambulance lookup — same logic as /api/dispatch:
 * 1. Ambulance collection (spatial → any available → override)
 * 2. Approved Driver users with vehicleNumber (auto-create record)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function findAvailableAmbulance(
  latitude: number,
  longitude: number
): Promise<{ ambulance: any | null; source: string }> {
  // Step 1: Spatial query
  let ambulance = await Ambulance.findOne({
    status: "AVAILABLE",
    location: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [longitude, latitude] },
        $maxDistance: 25000,
      },
    },
  }).lean();

  if (ambulance) return { ambulance: ambulance as any, source: "spatial" };

  // Step 2: Any AVAILABLE
  ambulance = await Ambulance.findOne({ status: "AVAILABLE" })
    .sort({ createdAt: 1 })
    .lean();
  if (ambulance) return { ambulance: ambulance as any, source: "fallback" };

  // Step 3: Emergency override
  ambulance = await Ambulance.findOne({ status: { $ne: "DISPATCHED" } })
    .sort({ createdAt: 1 })
    .lean();
  if (ambulance) return { ambulance: ambulance as any, source: "emergency-override" };

  // Step 4: Approved Driver users — auto-create Ambulance record
  const approvedDrivers = await User.find({
    role: "driver",
    isApproved: true,
    vehicleNumber: { $exists: true, $ne: "" },
  })
    .select("name vehicleNumber phone")
    .lean();

  for (const driver of approvedDrivers) {
    if (!driver.vehicleNumber) continue;

    const existing = await Ambulance.findOne({
      vehicleNumber: driver.vehicleNumber,
    }).lean();

    if (existing) {
      if (existing.status !== "AVAILABLE") {
        await Ambulance.findByIdAndUpdate(existing._id, { status: "AVAILABLE" });
      }
      ambulance = await Ambulance.findOne({ vehicleNumber: driver.vehicleNumber }).lean();
      if (ambulance) return { ambulance: ambulance as any, source: "driver-user-reset" };
    } else {
      const newAmb = await Ambulance.create({
        vehicleNumber: driver.vehicleNumber,
        driverName: driver.name,
        status: "AVAILABLE",
        location: { type: "Point", coordinates: [longitude, latitude] },
      });
      console.log("[SOS] Auto-created ambulance for driver:", driver.vehicleNumber);
      return { ambulance: newAmb.toObject() as any, source: "driver-user-created" };
    }
  }

  return { ambulance: null, source: "none" };
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
          .split(/[,\\n]/)
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

    // ═══ UNIFIED AMBULANCE LOOKUP ═══
    const { ambulance: matchedAmbulance, source: ambulanceSource } =
      await findAvailableAmbulance(latitude, longitude);

    if (!matchedAmbulance) {
      const driverCount = await User.countDocuments({
        role: "driver",
        isApproved: true,
      });
      const ambulanceCount = await Ambulance.countDocuments({});

      let errorMessage = "No ambulances available for dispatch.";
      if (driverCount === 0 && ambulanceCount === 0) {
        errorMessage =
          "No drivers or ambulances registered. Please register driver accounts and approve them from the Admin Dashboard.";
      } else if (ambulanceCount === 0) {
        errorMessage =
          "No ambulance records found. Approve pending driver accounts from the Admin Dashboard to auto-create ambulance records.";
      } else {
        errorMessage =
          "All ambulances are currently busy. Please try again in a few moments.";
      }

      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 404 }
      );
    }

    console.log(
      `[SOS] Ambulance assigned: ${matchedAmbulance.vehicleNumber} (source: ${ambulanceSource})`
    );

    await Ambulance.findByIdAndUpdate(matchedAmbulance._id, {
      status: "DISPATCHED",
    });

    // ═══ HOSPITAL MATCHING ═══
    const hospital = await Hospital.findOne({
      isAtCapacity: false,
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: 30000,
        },
      },
    }).lean();

    const assignedHospital =
      hospital ||
      (await Hospital.findOne({
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
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
      dispatchedAt: new Date(),
      assignedAmbulanceId: String(matchedAmbulance._id),
      assignedAmbulanceVehicle: matchedAmbulance.vehicleNumber,
      destinationHospitalId: assignedHospital
        ? String(assignedHospital._id)
        : null,
      destinationHospitalName: assignedHospital
        ? assignedHospital.name
        : null,
    });

    console.log("[Fast2SMS MOCK] SOS Alert:", {
      to: patientContact,
      message: `SOS: ${patientName}. Symptoms: ${symptoms.join(", ")}. Priority: ${priority}. Ambulance: ${matchedAmbulance.vehicleNumber}.`,
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
          assignedAmbulanceVehicle: matchedAmbulance.vehicleNumber,
          destinationHospitalName: assignedHospital?.name || null,
          createdAt: emergency.createdAt,
        },
        ambulance: {
          id: matchedAmbulance._id,
          vehicleNumber: matchedAmbulance.vehicleNumber,
          driverName: matchedAmbulance.driverName,
          status: "DISPATCHED",
          location: matchedAmbulance.location,
        },
        hospital: assignedHospital
          ? { id: assignedHospital._id, name: assignedHospital.name }
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
