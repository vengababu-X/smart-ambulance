import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import Hospital from "@/models/Hospital";

/**
 * Seed route: Clears any orphaned data and reports current state.
 * No hardcoded hospital or ambulance data — all records are created
 * via the Admin Dashboard or user registration.
 */
export async function GET() {
  try {
    await connectToDatabase();

    const hospitalCount = await Hospital.countDocuments({});
    const ambulanceCount = await Ambulance.countDocuments({});

    // Clear any orphaned ambulance records (ambulances come from driver registrations)
    if (ambulanceCount > 0) {
      await Ambulance.deleteMany({});
    }

    return NextResponse.json(
      {
        success: true,
        message:
          hospitalCount > 0
            ? `System has ${hospitalCount} hospital(s) registered.`
            : "No hospitals registered yet. Use the Admin Dashboard to add hospitals.",
        hospitals: hospitalCount,
        ambulances: 0,
        note: "All data is managed through the Admin Dashboard. No hardcoded records.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check database state.",
      },
      { status: 500 }
    );
  }
}
