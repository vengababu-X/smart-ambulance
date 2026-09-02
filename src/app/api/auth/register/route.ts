import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const role = String(body.role || "patient").trim() as UserRole;
    const phone = String(body.phone || "").trim();
    const vehicleNumber = String(body.vehicleNumber || "").trim();
    const hospitalId = String(body.hospitalId || "").trim();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ["patient", "driver", "hospital", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role specified." },
        { status: 400 }
      );
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Role-specific validation
    if (role === "driver" && !vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required for drivers." },
        { status: 400 }
      );
    }

    if (role === "hospital" && !hospitalId) {
      return NextResponse.json(
        { success: false, error: "Hospital ID is required for hospital staff." },
        { status: 400 }
      );
    }

    // Create user
    // Patients and admins are auto-approved; drivers and hospital staff need admin approval
    const requiresApproval = role === "driver" || role === "hospital";

    const userData: Record<string, unknown> = {
      name,
      email,
      password,
      role,
      phone,
      isActive: true,
      isApproved: !requiresApproval,
    };

    if (role === "driver") {
      userData.vehicleNumber = vehicleNumber;
    }

    if (role === "hospital") {
      userData.hospitalId = hospitalId;
    }

    const user = await User.create(userData);

    console.log(
      `[AUTH] New user registered: ${user.email} (role: ${user.role}, approved: ${!requiresApproval})`
    );

    return NextResponse.json(
      {
        success: true,
        message: requiresApproval
          ? "Account created successfully. Your account is pending admin approval."
          : "Account created successfully.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: !requiresApproval,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
