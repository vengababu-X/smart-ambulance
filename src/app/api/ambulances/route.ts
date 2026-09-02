import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";

export async function GET() {
  try {
    await connectToDatabase();

    const ambulances = await Ambulance.find({})
      .sort({ status: 1, vehicleNumber: 1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        ambulances,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ambulance fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch ambulance records.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const vehicleNumber = String(body.vehicleNumber || "").trim();
    const driverName = String(body.driverName || "Unassigned").trim();
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
        { success: false, error: "Valid latitude and longitude are required." },
        { status: 400 }
      );
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      driverName,
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    });

    return NextResponse.json(
      { success: true, ambulance },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ambulance create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register ambulance." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { vehicleNumber, status, latitude, longitude } = body;

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (status) updateFields.status = status;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      updateFields.location = {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    }

    const ambulance = await Ambulance.findOneAndUpdate(
      { vehicleNumber },
      { $set: updateFields },
      { new: true }
    );

    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ambulance }, { status: 200 });
  } catch (error) {
    console.error("Ambulance update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ambulance." },
      { status: 500 }
    );
  }
}
