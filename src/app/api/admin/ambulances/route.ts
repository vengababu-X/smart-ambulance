import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST: Create a new ambulance (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const body = await request.json();
    const vehicleNumber = String(body.vehicleNumber || "").trim().toUpperCase();
    const driverName = String(body.driverName || "").trim();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    if (!driverName) {
      return NextResponse.json(
        { success: false, error: "Driver name is required." },
        { status: 400 }
      );
    }

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Valid latitude and longitude are required." },
        { status: 400 }
      );
    }

    // Check for duplicate vehicle number
    const existing = await Ambulance.findOne({ vehicleNumber });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Ambulance ${vehicleNumber} already exists.` },
        { status: 409 }
      );
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      driverName,
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
    });

    console.log(
      `[ADMIN] Ambulance created: ${ambulance.vehicleNumber} by ${session.user.email}`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Ambulance ${vehicleNumber} created successfully.`,
        ambulance: {
          id: ambulance._id,
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName,
          status: ambulance.status,
          location: ambulance.location,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin ambulance create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create ambulance." },
      { status: 500 }
    );
  }
}

// DELETE: Remove an ambulance (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const ambulanceId = searchParams.get("id");

    if (!ambulanceId) {
      return NextResponse.json(
        { success: false, error: "Ambulance ID is required." },
        { status: 400 }
      );
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    if (ambulance.status === "DISPATCHED") {
      return NextResponse.json(
        { success: false, error: "Cannot delete an ambulance that is currently dispatched." },
        { status: 400 }
      );
    }

    await Ambulance.findByIdAndDelete(ambulanceId);

    console.log(
      `[ADMIN] Ambulance deleted: ${ambulance.vehicleNumber} by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      message: `Ambulance ${ambulance.vehicleNumber} has been permanently deleted.`,
    });
  } catch (error) {
    console.error("Admin ambulance delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete ambulance." },
      { status: 500 }
    );
  }
}
