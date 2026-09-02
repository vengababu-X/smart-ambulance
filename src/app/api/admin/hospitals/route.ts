import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Hospital from "@/models/Hospital";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: List all hospitals (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const hospitals = await Hospital.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      hospitals,
      total: hospitals.length,
    });
  } catch (error) {
    console.error("Admin hospitals fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hospitals." },
      { status: 500 }
    );
  }
}

// POST: Create a new hospital (admin only)
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
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const availableBeds = parseInt(body.availableBeds) || 0;
    const totalBeds = parseInt(body.totalBeds) || availableBeds;
    const icuCapacity = parseInt(body.icuCapacity) || 0;
    const availableIcu = parseInt(body.availableIcu) || icuCapacity;

    // Validation
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Hospital name is required." },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Hospital address is required." },
        { status: 400 }
      );
    }

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Valid latitude and longitude are required." },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: "Coordinates out of valid range." },
        { status: 400 }
      );
    }

    const hospital = await Hospital.create({
      name,
      address,
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
      availableBeds,
      totalBeds,
      icuCapacity,
      availableIcu,
      isAtCapacity: availableBeds === 0,
    });

    console.log(
      `[ADMIN] Hospital created: ${hospital.name} (${hospital._id}) by ${session.user.email}`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Hospital "${name}" created successfully.`,
        hospital: {
          id: hospital._id,
          name: hospital.name,
          address: hospital.address,
          location: hospital.location,
          availableBeds: hospital.availableBeds,
          totalBeds: hospital.totalBeds,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin hospital create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create hospital." },
      { status: 500 }
    );
  }
}

// DELETE: Remove a hospital (admin only)
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
    const hospitalId = searchParams.get("id");

    if (!hospitalId) {
      return NextResponse.json(
        { success: false, error: "Hospital ID is required." },
        { status: 400 }
      );
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return NextResponse.json(
        { success: false, error: "Hospital not found." },
        { status: 404 }
      );
    }

    await Hospital.findByIdAndDelete(hospitalId);

    console.log(
      `[ADMIN] Hospital deleted: ${hospital.name} (${hospital._id}) by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      message: `Hospital "${hospital.name}" has been permanently deleted.`,
    });
  } catch (error) {
    console.error("Admin hospital delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete hospital." },
      { status: 500 }
    );
  }
}
