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

/**
 * Unified ambulance lookup:
 * 1. Query Ambulance collection (spatial → any available → emergency override)
 * 2. If no Ambulance record found, check approved Driver users with vehicleNumber
 * 3. Auto-create Ambulance record for the driver if found
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function findAvailableAmbulance(
  latitude: number,
  longitude: number
): Promise<{
  ambulance: any | null;
  source: string;
}> {
  // Step 1: Try $nearSphere spatial query on Ambulance collection
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

  if (ambulance) {
    console.log("[DISPATCH] Found ambulance via spatial query:", ambulance.vehicleNumber);
    return { ambulance: ambulance as any, source: "spatial" };
  }

  // Step 2: Any AVAILABLE ambulance in the collection
  ambulance = await Ambulance.findOne({ status: "AVAILABLE" })
    .sort({ createdAt: 1 })
    .lean();

  if (ambulance) {
    console.log("[DISPATCH] Found ambulance via fallback (any available):", ambulance.vehicleNumber);
    return { ambulance: ambulance as any, source: "fallback" };
  }

  // Step 3: Emergency override — any non-DISPATCHED ambulance
  ambulance = await Ambulance.findOne({ status: { $ne: "DISPATCHED" } })
    .sort({ createdAt: 1 })
    .lean();

  if (ambulance) {
    console.log("[DISPATCH] Found ambulance via emergency override:", ambulance.vehicleNumber);
    return { ambulance: ambulance as any, source: "emergency-override" };
  }

  // Step 4: Check approved Driver users with a vehicleNumber
  // Create Ambulance records on-the-fly for any drivers missing them
  const approvedDrivers = await User.find({
    role: "driver",
    isApproved: true,
    vehicleNumber: { $exists: true, $ne: "" },
  })
    .select("name vehicleNumber phone")
    .lean();

  for (const driver of approvedDrivers) {
    if (!driver.vehicleNumber) continue;

    // Check if an Ambulance record already exists for this vehicle
    const existingAmbulance = await Ambulance.findOne({
      vehicleNumber: driver.vehicleNumber,
    }).lean();

    if (existingAmbulance) {
      // Update status to AVAILABLE if it was stuck in another state
      if (existingAmbulance.status !== "AVAILABLE") {
        await Ambulance.findByIdAndUpdate(existingAmbulance._id, {
          status: "AVAILABLE",
        });
        console.log("[DISPATCH] Reset ambulance status to AVAILABLE:", driver.vehicleNumber);
      }
      ambulance = await Ambulance.findOne({
        vehicleNumber: driver.vehicleNumber,
      }).lean();
      if (ambulance) {
        return { ambulance: ambulance as any, source: "driver-user-reset" };
      }
    } else {
      // Auto-create Ambulance record for this driver
      const newAmbulance = await Ambulance.create({
        vehicleNumber: driver.vehicleNumber,
        driverName: driver.name,
        status: "AVAILABLE",
        location: {
          type: "Point",
          coordinates: [longitude, latitude], // Default to patient location
        },
      });
      console.log("[DISPATCH] Auto-created ambulance for driver:", driver.vehicleNumber);
      return { ambulance: newAmbulance.toObject() as any, source: "driver-user-created" };
    }
  }

  // No ambulances found anywhere
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
    // UNIFIED AMBULANCE MATCHING
    // ═══════════════════════════════════════════════════════
    const { ambulance: matchedAmbulance, source: ambulanceSource } =
      await findAvailableAmbulance(latitude, longitude);

    if (!matchedAmbulance) {
      // Dynamic check: are there any drivers at all?
      const driverCount = await User.countDocuments({
        role: "driver",
        isApproved: true,
      });
      const ambulanceCount = await Ambulance.countDocuments({});

      let errorMessage = "No ambulances available for dispatch.";
      if (driverCount === 0 && ambulanceCount === 0) {
        errorMessage =
          "No drivers or ambulances registered in the system. Please register driver accounts and approve them from the Admin Dashboard.";
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
      `[DISPATCH] Ambulance assigned: ${matchedAmbulance.vehicleNumber} (source: ${ambulanceSource})`
    );

    // Mark ambulance as DISPATCHED
    await Ambulance.findByIdAndUpdate(matchedAmbulance._id, {
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
      assignedAmbulanceId: String(matchedAmbulance._id),
      assignedAmbulanceVehicle: matchedAmbulance.vehicleNumber,
      destinationHospitalId: assignedHospital
        ? String(assignedHospital._id)
        : null,
      destinationHospitalName: assignedHospital ? assignedHospital.name : null,
      aiTriageNotes,
    });

    // Mock Fast2SMS
    console.log("[Fast2SMS MOCK] Dispatch notification:", {
      to: patientContact,
      message: `EMERGENCY DISPATCH: ${patientName}. Symptoms: ${symptoms.join(", ")}. Priority: ${priority}. Ambulance: ${matchedAmbulance.vehicleNumber}. Hospital: ${assignedHospital?.name || "TBD"}.`,
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
          id: matchedAmbulance._id,
          vehicleNumber: matchedAmbulance.vehicleNumber,
          driverName: matchedAmbulance.driverName,
          status: "DISPATCHED",
          location: matchedAmbulance.location,
        },
        hospital: assignedHospital
          ? {
              id: assignedHospital._id,
              name: assignedHospital.name,
              address: assignedHospital.address,
              availableBeds: assignedHospital.availableBeds,
              location: assignedHospital.location,
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
