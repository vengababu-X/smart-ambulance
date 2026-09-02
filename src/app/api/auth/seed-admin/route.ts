import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";

export async function GET() {
  try {
    await connectToDatabase();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      return NextResponse.json(
        {
          success: true,
          message: "Admin account already exists.",
          admin: {
            email: existingAdmin.email,
            name: existingAdmin.name,
          },
        },
        { status: 200 }
      );
    }

    // Create default admin (auto-approved)
    const admin = await User.create({
      name: "System Admin",
      email: "admin@smartambulance.com",
      password: "admin123",
      role: "admin" as UserRole,
      phone: "+919876543210",
      isActive: true,
      isApproved: true,
    });

    // Also create demo users for each role
    const demoUsers: Array<{
      name: string;
      email: string;
      password: string;
      role: UserRole;
      phone: string;
      vehicleNumber?: string;
      hospitalId?: string;
    }> = [
      {
        name: "Rajesh Kumar",
        email: "driver@smartambulance.com",
        password: "driver123",
        role: "driver",
        phone: "+919876543211",
        // vehicleNumber is set when the driver registers or updates their profile
      },
      {
        name: "Hospital Staff",
        email: "hospital@smartambulance.com",
        password: "hospital123",
        role: "hospital",
        phone: "+919876543212",
        // hospitalId is set when the staff member registers or is assigned by admin
      },
      {
        name: "Patient User",
        email: "patient@smartambulance.com",
        password: "patient123",
        role: "patient",
        phone: "+919876543213",
      },
    ];

    const createdUsers = [];
    for (const userData of demoUsers) {
      const exists = await User.findOne({ email: userData.email });
      if (!exists) {
        const isDriverOrHospital = userData.role === "driver" || userData.role === "hospital";
        const user = await User.create({
          ...userData,
          isApproved: !isDriverOrHospital,
          isActive: true,
        });
        createdUsers.push({
          email: user.email,
          role: user.role,
          password: userData.password,
          isApproved: !isDriverOrHospital,
        });
      }
    }

    console.log("[SEED] Initial admin and demo users created.");

    return NextResponse.json(
      {
        success: true,
        message: "Initial users seeded successfully.",
        admin: {
          email: admin.email,
          password: "admin123",
        },
        demoUsers: createdUsers,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed admin error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed admin user." },
      { status: 500 }
    );
  }
}
