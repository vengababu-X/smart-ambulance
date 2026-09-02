import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Hospital from "@/models/Hospital";

export async function GET() {
  try {
    await connectToDatabase();

    const hospitals = await Hospital.find({})
      .select("name location availableBeds availableIcu isAtCapacity")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      hospitals,
      total: hospitals.length,
    });
  } catch (error) {
    console.error("Hospitals fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hospitals." },
      { status: 500 }
    );
  }
}
