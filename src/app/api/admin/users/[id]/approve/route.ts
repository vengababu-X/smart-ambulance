import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
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

      return NextResponse.json({
        success: true,
        message: `${user.name} (${user.role}) has been approved.`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: true,
        },
      });
    } else {
      // Reject: deactivate the account
      user.isApproved = false;
      user.isActive = false;
      await user.save();

      console.log(
        `[ADMIN] User rejected: ${user.email} (role: ${user.role}) by ${session.user.email}`
      );

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
