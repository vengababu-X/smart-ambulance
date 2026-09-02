import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Emergency from "@/models/Emergency";

/**
 * GET /api/hospital/[id]/history?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&status=COMPLETED
 *
 * Returns emergency records destined for this hospital, with optional date filtering
 * and status filtering. Used by the hospital dashboard for daily logs and history views.
 */
export async function GET(
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

    if (session.user.hospitalId !== params.id) {
      return NextResponse.json(
        { success: false, error: "Access denied to this hospital." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const statusParam = searchParams.get("status");

    // Build query filter
    const filter: Record<string, unknown> = {
      destinationHospitalId: params.id,
    };

    // Date filtering on createdAt
    if (dateParam) {
      const dayStart = new Date(dateParam);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateParam);
      dayEnd.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (fromParam || toParam) {
      const rangeFilter: Record<string, Date> = {};
      if (fromParam) {
        const from = new Date(fromParam);
        from.setHours(0, 0, 0, 0);
        rangeFilter.$gte = from;
      }
      if (toParam) {
        const to = new Date(toParam);
        to.setHours(23, 59, 59, 999);
        rangeFilter.$lte = to;
      }
      filter.createdAt = rangeFilter;
    }

    // Optional status filter
    if (statusParam) {
      const validStatuses = [
        "PENDING",
        "ASSIGNED",
        "EN_ROUTE",
        "ARRIVED",
        "COMPLETED",
      ];
      if (validStatuses.includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    const emergencies = await Emergency.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Compute daily summary stats for the returned records
    const summary = {
      total: emergencies.length,
      red: emergencies.filter((e) => e.priority === "RED").length,
      yellow: emergencies.filter((e) => e.priority === "YELLOW").length,
      green: emergencies.filter((e) => e.priority === "GREEN").length,
      pending: emergencies.filter((e) => e.status === "PENDING").length,
      assigned: emergencies.filter((e) => e.status === "ASSIGNED").length,
      enRoute: emergencies.filter((e) => e.status === "EN_ROUTE").length,
      arrived: emergencies.filter((e) => e.status === "ARRIVED").length,
      completed: emergencies.filter((e) => e.status === "COMPLETED").length,
    };

    return NextResponse.json({
      success: true,
      emergencies,
      summary,
      total: emergencies.length,
      filters: { date: dateParam, from: fromParam, to: toParam, status: statusParam },
    });
  } catch (error) {
    console.error("Hospital history fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hospital history." },
      { status: 500 }
    );
  }
}
