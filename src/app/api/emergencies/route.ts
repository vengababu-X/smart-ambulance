import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Emergency from "@/models/Emergency";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Build date filter — uses createdAt
    const filter: Record<string, unknown> = {};

    if (dateParam) {
      // Single day: filter to the entire calendar day in local interpretation
      const dayStart = new Date(dateParam);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateParam);
      dayEnd.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (fromParam || toParam) {
      // Date range
      const rangeFilter: Record<string, Date> = {};
      if (fromParam) {
        const from = new Date(fromParam);
        from.setHours(0, 0, 0, 0);
        rangeFilter.$gte = from;
      }
      if (toParam) {
        const to = new Date(toParam);
        to.setHours(23, 59, 59, 999);
        rangeFilter.$lte = to;
      }
      filter.createdAt = rangeFilter;
    }

    const emergencies = await Emergency.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        emergencies,
        total: emergencies.length,
        filters: { date: dateParam, from: fromParam, to: toParam },
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
    if (status === "ASSIGNED") {
      updateFields.dispatchedAt = now;
    } else if (status === "EN_ROUTE") {
      updateFields.pickedUpAt = now;
    } else if (status === "ARRIVED") {
      updateFields.arrivedAt = now;
      updateFields.handoverTimestamp = now;
    } else if (status === "COMPLETED") {
      updateFields.arrivedAt = now;
      updateFields.completedAt = now;
      updateFields.handoverTimestamp = now;
    }

    // If completed or arrived, also release ambulance back to AVAILABLE
    if (status === "COMPLETED" || status === "ARRIVED") {
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
