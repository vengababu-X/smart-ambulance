import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Ambulance from "@/models/Ambulance";
import Hospital from "@/models/Hospital";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH: Approve or reject a user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve" or "reject"

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    if (user.role === "patient" || user.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Patient and admin accounts do not require approval." },
        { status: 400 }
      );
    }

    if (action === "approve") {
      user.isApproved = true;
      user.isActive = true;
      await user.save();

      console.log(
        `[ADMIN] User approved: ${user.email} (role: ${user.role}) by ${session.user.email}`
      );

      // ═══ AUTO-CREATE AMBULANCE RECORD (for drivers) ═══
      let ambulanceCreated = false;
      let ambulanceUpdated = false;

      if (user.role === "driver" && user.vehicleNumber) {
        const existingAmbulance = await Ambulance.findOne({
          vehicleNumber: user.vehicleNumber,
        });

        if (existingAmbulance) {
          if (existingAmbulance.status !== "AVAILABLE") {
            await Ambulance.findByIdAndUpdate(existingAmbulance._id, {
              status: "AVAILABLE",
              driverName: user.name,
            });
            ambulanceUpdated = true;
            console.log(
              `[ADMIN] Ambulance ${user.vehicleNumber} reset to AVAILABLE for approved driver ${user.name}`
            );
          }
        } else {
          await Ambulance.create({
            vehicleNumber: user.vehicleNumber,
            driverName: user.name,
            status: "AVAILABLE",
            location: {
              type: "Point",
              coordinates: [79.9929, 14.9132], // Kavali, AP
            },
          });
          ambulanceCreated = true;
          console.log(
            `[ADMIN] Auto-created ambulance ${user.vehicleNumber} for approved driver ${user.name}`
          );
        }
      }

      // ═══ AUTO-CREATE HOSPITAL RECORD (for hospital staff) ═══
      let hospitalCreated = false;
      let hospitalUpdated = false;

      if (user.role === "hospital" && user.hospitalId) {
        const existingHospital = await Hospital.findOne({
          name: user.name,
        });

        if (existingHospital) {
          // Hospital already exists — ensure it's not marked as at capacity
          if (existingHospital.isAtCapacity) {
            await Hospital.findByIdAndUpdate(existingHospital._id, {
              isAtCapacity: false,
            });
            hospitalUpdated = true;
            console.log(
              `[ADMIN] Hospital "${user.name}" reset from AT CAPACITY for approved staff ${user.email}`
            );
          }
        } else {
          // Create new Hospital record using the user's name as hospital name
          await Hospital.create({
            name: user.name,
            address: `Registered by ${user.email}`,
            totalBeds: 50,
            availableBeds: 50,
            icuCapacity: 10,
            availableIcu: 10,
            staffCount: 0,
            isAtCapacity: false,
            location: {
              type: "Point",
              coordinates: [79.9929, 14.9132], // Kavali, AP (will be updated via admin)
            },
          });
          hospitalCreated = true;
          console.log(
            `[ADMIN] Auto-created hospital "${user.name}" for approved staff ${user.email}`
          );
        }
      }

      // Build response message
      const parts: string[] = [`${user.name} (${user.role}) has been approved.`];
      if (ambulanceCreated) parts.push(`Ambulance ${user.vehicleNumber} auto-created.`);
      if (ambulanceUpdated) parts.push(`Ambulance ${user.vehicleNumber} reset to AVAILABLE.`);
      if (hospitalCreated) parts.push(`Hospital "${user.name}" auto-created.`);
      if (hospitalUpdated) parts.push(`Hospital "${user.name}" reset from AT CAPACITY.`);

      return NextResponse.json({
        success: true,
        message: parts.join(" "),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: true,
          vehicleNumber: user.vehicleNumber,
          hospitalId: user.hospitalId,
        },
        ambulance: user.role === "driver" ? {
          created: ambulanceCreated,
          updated: ambulanceUpdated,
          vehicleNumber: user.vehicleNumber || null,
        } : undefined,
        hospital: user.role === "hospital" ? {
          created: hospitalCreated,
          updated: hospitalUpdated,
          name: user.name,
        } : undefined,
      });
    } else {
      // Reject: deactivate the account
      user.isApproved = false;
      user.isActive = false;
      await user.save();

      console.log(
        `[ADMIN] User rejected: ${user.email} (role: ${user.role}) by ${session.user.email}`
      );

      // If driver is rejected, set their ambulance to MAINTENANCE
      if (user.role === "driver" && user.vehicleNumber) {
        await Ambulance.findOneAndUpdate(
          { vehicleNumber: user.vehicleNumber },
          { status: "MAINTENANCE" }
        );
        console.log(
          `[ADMIN] Ambulance ${user.vehicleNumber} set to MAINTENANCE for rejected driver`
        );
      }

      // If hospital staff is rejected, mark hospital as at capacity
      if (user.role === "hospital" && user.name) {
        await Hospital.findOneAndUpdate(
          { name: user.name },
          { isAtCapacity: true }
        );
        console.log(
          `[ADMIN] Hospital "${user.name}" set to AT CAPACITY for rejected staff`
        );
      }

      return NextResponse.json({
        success: true,
        message: `${user.name} (${user.role}) has been rejected and deactivated.`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: false,
        },
      });
    }
  } catch (error) {
    console.error("Admin user approval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process approval." },
      { status: 500 }
    );
  }
}

// DELETE: Remove a user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { id } = await params;

    // Prevent admin from deleting themselves
    if (id === session.user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot delete your own admin account." },
        { status: 400 }
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // If deleting a driver, also remove their ambulance record
    if (user.role === "driver" && user.vehicleNumber) {
      await Ambulance.findOneAndDelete({ vehicleNumber: user.vehicleNumber });
      console.log(
        `[ADMIN] Ambulance ${user.vehicleNumber} deleted for removed driver ${user.name}`
      );
    }

    // If deleting hospital staff, also remove their hospital record
    if (user.role === "hospital" && user.name) {
      await Hospital.findOneAndDelete({ name: user.name });
      console.log(
        `[ADMIN] Hospital "${user.name}" deleted for removed staff ${user.email}`
      );
    }

    await User.findByIdAndDelete(id);

    console.log(
      `[ADMIN] User deleted: ${user.email} (role: ${user.role}) by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      message: `${user.name} (${user.role}) has been permanently deleted.`,
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user." },
      { status: 500 }
    );
  }
}
