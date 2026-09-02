import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Hospital from "@/models/Hospital";

// GET: Fetch this hospital's full capacity details
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "hospital") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Hospital access required." },
        { status: 403 }
      );
    }

    // Verify staff belongs to this hospital
    if (session.user.hospitalId !== params.id) {
      return NextResponse.json(
        { success: false, error: "Access denied to this hospital." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const hospital = await Hospital.findById(params.id).lean();
    if (!hospital) {
      return NextResponse.json(
        { success: false, error: "Hospital not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      hospital: {
        id: hospital._id,
        name: hospital.name,
        address: hospital.address,
        totalBeds: hospital.totalBeds,
        availableBeds: hospital.availableBeds,
        icuCapacity: hospital.icuCapacity,
        availableIcu: hospital.availableIcu,
        staffCount: hospital.staffCount,
        isAtCapacity: hospital.isAtCapacity,
      },
    });
  } catch (error) {
    console.error("Hospital capacity fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hospital data." },
      { status: 500 }
    );
  }
}

// PATCH: Quick-update Available Beds and Available ICU
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "hospital") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Hospital access required." },
        { status: 403 }
      );
    }

    // Verify staff belongs to this hospital
    if (session.user.hospitalId !== params.id) {
      return NextResponse.json(
        { success: false, error: "Access denied to this hospital." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const body = await request.json();
    const hospital = await Hospital.findById(params.id);
    if (!hospital) {
      return NextResponse.json(
        { success: false, error: "Hospital not found." },
        { status: 404 }
      );
    }

    // Build update payload — only allow capacity fields hospital staff should change
    const updateFields: Record<string, unknown> = {};

    if (body.availableBeds !== undefined) {
      const val = Math.max(0, Math.min(parseInt(body.availableBeds) || 0, hospital.totalBeds));
      updateFields.availableBeds = val;
      // Recalculate at-capacity flag
      updateFields.isAtCapacity = val === 0;
    }

    if (body.availableIcu !== undefined) {
      const val = Math.max(0, Math.min(parseInt(body.availableIcu) || 0, hospital.icuCapacity));
      updateFields.availableIcu = val;
    }

    // Also allow staff count if provided
    if (body.staffCount !== undefined) {
      updateFields.staffCount = Math.max(0, parseInt(body.staffCount) || 0);
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await Hospital.findByIdAndUpdate(
      params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Update failed." },
        { status: 500 }
      );
    }

    console.log(
      `[HOSPITAL] Capacity updated: ${updated.name} — beds: ${updated.availableBeds}/${updated.totalBeds}, icu: ${updated.availableIcu}/${updated.icuCapacity} by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      message: "Capacity updated successfully.",
      hospital: {
        id: updated._id,
        name: updated.name,
        totalBeds: updated.totalBeds,
        availableBeds: updated.availableBeds,
        icuCapacity: updated.icuCapacity,
        availableIcu: updated.availableIcu,
        staffCount: updated.staffCount,
        isAtCapacity: updated.isAtCapacity,
      },
    });
  } catch (error) {
    console.error("Hospital capacity update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update capacity." },
      { status: 500 }
    );
  }
}
