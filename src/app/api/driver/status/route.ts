import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const vehicleNumber = String(body.vehicleNumber || "").trim();
    const status = String(body.status || "").trim().toUpperCase();

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    const validStatuses = ["AVAILABLE", "OFFLINE"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be AVAILABLE or OFFLINE." },
        { status: 400 }
      );
    }

    const ambulance = await Ambulance.findOneAndUpdate(
      { vehicleNumber },
      { status },
      { new: true }
    );

    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    console.log(`[DRIVER] Status toggled: ${vehicleNumber} → ${status}`);

    return NextResponse.json({
      success: true,
      message: `Driver status updated to ${status}.`,
      ambulance: {
        vehicleNumber: ambulance.vehicleNumber,
        status: ambulance.status,
      },
    });
  } catch (error) {
    console.error("Driver status update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update driver status." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const vehicleNumber = String(searchParams.get("vehicleNumber") || "").trim();

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    const ambulance = await Ambulance.findOne({ vehicleNumber }).lean();

    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ambulance: {
        vehicleNumber: ambulance.vehicleNumber,
        status: ambulance.status,
      },
    });
  } catch (error) {
    console.error("Driver status fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch driver status." },
      { status: 500 }
    );
  }
}
