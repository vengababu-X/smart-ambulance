import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const vehicleNumber = String(body.vehicleNumber || "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, error: "Valid coordinates are required." },
        { status: 400 }
      );
    }

    const ambulance = await Ambulance.findOneAndUpdate(
      { vehicleNumber },
      {
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      },
      { new: true }
    );

    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Location updated.",
        ambulance: {
          vehicleNumber: ambulance.vehicleNumber,
          location: ambulance.location,
          status: ambulance.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Driver location update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update driver location." },
      { status: 500 }
    );
  }
}
