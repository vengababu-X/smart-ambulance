import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import User from "@/models/User";

/**
 * GET: Fetch all ambulances by joining approved Driver users with Ambulance records.
 *
 * Strategy:
 * 1. Query all approved driver users (role=driver, isApproved=true)
 * 2. Query all Ambulance records from the Ambulance collection
 * 3. Merge: each driver with a vehicleNumber gets an ambulance card
 *    - If an Ambulance record exists for that vehicleNumber, use its status/location
 *    - If not, create a virtual entry from the driver's user data
 * 4. Ambulance records without a matching driver are shown as unassigned
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // "AVAILABLE", "DISPATCHED", "MAINTENANCE"

    // Step 1: Fetch all approved driver users
    const driverUsers = await User.find({
      role: "driver",
      isApproved: true,
      vehicleNumber: { $exists: true, $ne: "" },
    })
      .select("name email phone vehicleNumber isApproved createdAt")
      .lean();

    // Step 2: Fetch all Ambulance records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ambulanceQuery: Record<string, any> = {};
    if (statusFilter && ["AVAILABLE", "DISPATCHED", "MAINTENANCE"].includes(statusFilter)) {
      ambulanceQuery.status = statusFilter;
    }
    const ambulanceRecords = await Ambulance.find(ambulanceQuery).lean();

    // Build a lookup map for ambulance records by vehicleNumber
    const ambulanceByVehicle = new Map(
      ambulanceRecords.map((a) => [a.vehicleNumber, a])
    );

    // Step 3: Merge driver users with ambulance records
    const fleet = driverUsers.map((driver) => {
      const ambulanceRecord = driver.vehicleNumber
        ? ambulanceByVehicle.get(driver.vehicleNumber)
        : null;

      // If ambulance record exists, use its status and location
      // Otherwise, create from driver data (status defaults to AVAILABLE)
      return {
        _id: ambulanceRecord?._id || `user-${driver._id}`,
        vehicleNumber: driver.vehicleNumber || "UNASSIGNED",
        driverName: driver.name,
        driverEmail: driver.email,
        driverPhone: driver.phone || "",
        driverUserId: String(driver._id),
        status: ambulanceRecord?.status || "AVAILABLE",
        location: ambulanceRecord?.location || null,
        isApproved: driver.isApproved,
        registeredAt: driver.createdAt,
        createdAt: ambulanceRecord?.createdAt || driver.createdAt,
        updatedAt: ambulanceRecord?.updatedAt || driver.createdAt,
        source: ambulanceRecord ? "ambulance-record" : "driver-user",
      };
    });

    // Step 4: Add any ambulance records that don't have a matching driver
    const driverVehicleNumbers = new Set(driverUsers.map((d) => d.vehicleNumber));
    for (const ambulance of ambulanceRecords) {
      if (!driverVehicleNumbers.has(ambulance.vehicleNumber)) {
        fleet.push({
          _id: String(ambulance._id),
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName || "Unassigned",
          driverEmail: "",
          driverPhone: "",
          driverUserId: "",
          status: ambulance.status,
          location: ambulance.location,
          isApproved: false,
          registeredAt: ambulance.createdAt,
          createdAt: ambulance.createdAt,
          updatedAt: ambulance.updatedAt,
          source: "ambulance-record",
        });
      }
    }

    // Sort: AVAILABLE first, then DISPATCHED, then MAINTENANCE
    const statusOrder = { AVAILABLE: 0, DISPATCHED: 1, MAINTENANCE: 2 };
    fleet.sort((a, b) => {
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
      return aOrder - bOrder;
    });

    return NextResponse.json(
      {
        success: true,
        ambulances: fleet,
        stats: {
          total: fleet.length,
          available: fleet.filter((a) => a.status === "AVAILABLE").length,
          dispatched: fleet.filter((a) => a.status === "DISPATCHED").length,
          maintenance: fleet.filter((a) => a.status === "MAINTENANCE").length,
          drivers: driverUsers.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ambulance fleet fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch fleet data." },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new ambulance record (admin only).
 * Automatically links to an approved driver if vehicleNumber matches.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const vehicleNumber = String(body.vehicleNumber || "").trim().toUpperCase();
    const driverName = String(body.driverName || "Unassigned").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, error: "Valid latitude and longitude are required." },
        { status: 400 }
      );
    }

    // Check if ambulance already exists
    const existing = await Ambulance.findOne({ vehicleNumber });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Ambulance ${vehicleNumber} already exists.` },
        { status: 409 }
      );
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      driverName,
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    });

    // Try to link to an approved driver user
    const linkedDriver = await User.findOne({
      role: "driver",
      vehicleNumber: vehicleNumber,
    }).select("name email");

    return NextResponse.json(
      {
        success: true,
        message: `Ambulance ${vehicleNumber} created successfully.`,
        ambulance: {
          id: ambulance._id,
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName,
          status: ambulance.status,
          location: ambulance.location,
          linkedDriver: linkedDriver
            ? { name: linkedDriver.name, email: linkedDriver.email }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ambulance create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register ambulance." },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update ambulance status or location.
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { vehicleNumber, status, latitude, longitude } = body;

    if (!vehicleNumber) {
      return NextResponse.json(
        { success: false, error: "Vehicle number is required." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateFields: Record<string, any> = {};
    if (status) updateFields.status = status;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      updateFields.location = {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    }

    const ambulance = await Ambulance.findOneAndUpdate(
      { vehicleNumber },
      { $set: updateFields },
      { new: true }
    );

    if (!ambulance) {
      return NextResponse.json(
        { success: false, error: "Ambulance not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ambulance }, { status: 200 });
  } catch (error) {
    console.error("Ambulance update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ambulance." },
      { status: 500 }
    );
  }
}
