import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: List all users (admin only)
export async function GET(request: NextRequest) {
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
    const role = searchParams.get("role");
    const status = searchParams.get("status"); // "pending", "approved", "all"
    const search = searchParams.get("search") || "";

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (role && ["patient", "driver", "hospital", "admin"].includes(role)) {
      query.role = role;
    }

    if (status === "pending") {
      query.isApproved = false;
    } else if (status === "approved") {
      query.isApproved = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: await User.countDocuments({}),
      pending: await User.countDocuments({ isApproved: false, role: { $in: ["driver", "hospital"] } }),
      drivers: await User.countDocuments({ role: "driver" }),
      hospitals: await User.countDocuments({ role: "hospital" }),
      patients: await User.countDocuments({ role: "patient" }),
      admins: await User.countDocuments({ role: "admin" }),
    };

    return NextResponse.json({
      success: true,
      users,
      stats,
    });
  } catch (error) {
    console.error("Admin users fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users." },
      { status: 500 }
    );
  }
}
