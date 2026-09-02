import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import Emergency from "@/models/Emergency";
import Hospital from "@/models/Hospital";

function determinePriority(
  severityScore: number,
  symptoms: string[]
): "RED" | "YELLOW" | "GREEN" {
  const normalizedSymptoms = symptoms.join(" ").toLowerCase();

  const redKeywords = [
    "chest pain",
    "severe bleeding",
    "unconscious",
    "stroke",
    "heart attack",
    "road accident",
    "trauma",
    "difficulty breathing",
    "cardiac arrest",
  ];

  const yellowKeywords = [
    "shortness of breath",
    "infection",
    "fever",
    "dizziness",
    "nausea",
    "allergic",
    "fracture",
    "pregnancy",
    "bleeding",
  ];

  if (
    severityScore >= 8 ||
    redKeywords.some((k) => normalizedSymptoms.includes(k))
  ) {
    return "RED";
  }

  if (
    severityScore >= 5 ||
    yellowKeywords.some((k) => normalizedSymptoms.includes(k))
  ) {
    return "YELLOW";
  }

  return "GREEN";
}

function generateEmergencyId(): string {
  return `EMG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
    const aiTriageNotes = String(body.aiTriageNotes || "").trim();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid patient latitude and longitude are required.",
        },
        { status: 400 }
      );
    }

    if (symptoms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Symptoms are required to triage the patient.",
        },
        { status: 400 }
      );
    }

    const priority = determinePriority(severityScore, symptoms);

    // ═══════════════════════════════════════════════════════
    // AMBULANCE MATCHING — with geospatial fallback
    // ═══════════════════════════════════════════════════════

    // Step 1: Try $nearSphere spatial query
    let ambulance = await Ambulance.findOne({
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

    let ambulanceSource = "spatial";

    // Step 2: Fallback — any AVAILABLE ambulance if spatial query returned nothing
    if (!ambulance) {
      console.log(
        "[DISPATCH] Spatial query returned no ambulances. Falling back to any available ambulance."
      );
      ambulance = await Ambulance.findOne({ status: "AVAILABLE" })
        .sort({ createdAt: 1 })
        .lean();
      ambulanceSource = "fallback";
    }

    // Step 3: Absolute last resort — pick any ambulance at all (override MAINTENANCE)
    if (!ambulance) {
      console.log(
        "[DISPATCH] No available ambulances. Attempting to assign any ambulance."
      );
      ambulance = await Ambulance.findOne({
        status: { $ne: "DISPATCHED" },
      })
        .sort({ createdAt: 1 })
        .lean();
      ambulanceSource = "emergency-override";
    }

    if (!ambulance) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No ambulances exist in the system. Please seed the database first via /api/seed.",
        },
        { status: 404 }
      );
    }

    console.log(
      `[DISPATCH] Ambulance assigned: ${ambulance.vehicleNumber} (source: ${ambulanceSource})`
    );

    // Mark ambulance as DISPATCHED
    await Ambulance.findByIdAndUpdate(ambulance._id, {
      status: "DISPATCHED",
    });

    // ═══════════════════════════════════════════════════════
    // HOSPITAL MATCHING — with fallback
    // ═══════════════════════════════════════════════════════

    const hospitals = await Hospital.find({
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

    let assignedHospital: (typeof hospitals)[0] | null = null;

    for (const hospital of hospitals) {
      if (priority === "RED") {
        if (hospital.availableIcu > 0 && hospital.availableBeds > 0) {
          assignedHospital = hospital;
          break;
        }
      } else {
        if (hospital.availableBeds > 0) {
          assignedHospital = hospital;
          break;
        }
      }
    }

    // Fallback: nearest hospital even at capacity
    if (!assignedHospital && hospitals.length > 0) {
      assignedHospital = hospitals[0];
    }

    // If no hospitals found within radius, find any hospital
    if (!assignedHospital) {
      const anyHospital = await Hospital.find({})
        .sort({ createdAt: 1 })
        .lean();
      if (anyHospital.length > 0) {
        assignedHospital = anyHospital[0];
      }
    }

    // Decrement hospital beds
    if (assignedHospital) {
      const bedDecrement: Record<string, number> = {};
      if (assignedHospital.availableBeds > 0) {
        bedDecrement.availableBeds = -1;
      }
      if (priority === "RED" && assignedHospital.availableIcu > 0) {
        bedDecrement.availableIcu = -1;
      }
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

    const emergencyId = generateEmergencyId();

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
      assignedAmbulanceId: String(ambulance._id),
      assignedAmbulanceVehicle: ambulance.vehicleNumber,
      destinationHospitalId: assignedHospital
        ? String(assignedHospital._id)
        : null,
      destinationHospitalName: assignedHospital ? assignedHospital.name : null,
      aiTriageNotes,
    });

    // Mock Fast2SMS
    console.log("[Fast2SMS MOCK] Dispatch notification:", {
      to: patientContact,
      message: `EMERGENCY DISPATCH: ${patientName}. Symptoms: ${symptoms.join(", ")}. Priority: ${priority}. Ambulance: ${ambulance.vehicleNumber}. Hospital: ${assignedHospital?.name || "TBD"}.`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Emergency dispatched successfully.",
        emergency: {
          id: emergency._id,
          emergencyId: emergency.emergencyId,
          patientName: emergency.patientName,
          symptoms: emergency.symptoms,
          severityScore: emergency.severityScore,
          priority: emergency.priority,
          status: emergency.status,
          assignedAmbulanceId: emergency.assignedAmbulanceId,
          assignedAmbulanceVehicle: emergency.assignedAmbulanceVehicle,
          destinationHospitalId: emergency.destinationHospitalId,
          destinationHospitalName: emergency.destinationHospitalName,
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
              address: assignedHospital.address,
              availableBeds: assignedHospital.availableBeds,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Dispatch API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while processing emergency dispatch.",
      },
      { status: 500 }
    );
  }
}
