import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Emergency from "@/models/Emergency";

export async function GET() {
  try {
    await connectToDatabase();

    const emergencies = await Emergency.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        emergencies,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Emergency fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch emergency records.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const emergencyId = String(body.emergencyId || "").trim();
    const status = String(body.status || "").trim();

    if (!emergencyId) {
      return NextResponse.json(
        { success: false, error: "Emergency ID is required." },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COMPLETED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value." },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = { status };
    const now = new Date();

    // Set timing fields based on status transition
    if (status === "EN_ROUTE") {
      updateFields.pickedUpAt = now;
    } else if (status === "ARRIVED") {
      updateFields.arrivedAt = now;
      updateFields.handoverTimestamp = now;
    } else if (status === "COMPLETED") {
      updateFields.completedAt = now;
    }

    // If completed, also release ambulance
    if (status === "COMPLETED") {
      const emergency = await Emergency.findOne({ emergencyId }).lean();
      if (emergency?.assignedAmbulanceVehicle) {
        const Ambulance = (await import("@/models/Ambulance")).default;
        await Ambulance.findOneAndUpdate(
          { vehicleNumber: emergency.assignedAmbulanceVehicle },
          { status: "AVAILABLE" }
        );
      }
    }

    const emergency = await Emergency.findOneAndUpdate(
      { emergencyId },
      { $set: updateFields },
      { new: true }
    );

    if (!emergency) {
      return NextResponse.json(
        { success: false, error: "Emergency not found." },
        { status: 404 }
      );
    }

    console.log(`[EMERGENCY] Status updated: ${emergencyId} → ${status}`);

    return NextResponse.json(
      {
        success: true,
        message: `Emergency status updated to ${status}.`,
        emergency: {
          emergencyId: emergency.emergencyId,
          status: emergency.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Emergency update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update emergency status." },
      { status: 500 }
    );
  }
}
