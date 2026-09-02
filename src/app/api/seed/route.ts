import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Ambulance from "@/models/Ambulance";
import Hospital from "@/models/Hospital";

const seededAmbulances = [
  {
    vehicleNumber: "AMB-101",
    driverName: "Rajesh Kumar",
    status: "AVAILABLE",
    location: {
      type: "Point",
      coordinates: [83.2185, 17.6868],
    },
  },
  {
    vehicleNumber: "AMB-102",
    driverName: "Suresh Reddy",
    status: "AVAILABLE",
    location: {
      type: "Point",
      coordinates: [83.2201, 17.6902],
    },
  },
  {
    vehicleNumber: "AMB-103",
    driverName: "Venkatesh Rao",
    status: "AVAILABLE",
    location: {
      type: "Point",
      coordinates: [83.2148, 17.6814],
    },
  },
  {
    vehicleNumber: "AMB-104",
    driverName: "Prasad Naidu",
    status: "AVAILABLE",
    location: {
      type: "Point",
      coordinates: [83.225, 17.695],
    },
  },
  {
    vehicleNumber: "AMB-105",
    driverName: "Kiran Babu",
    status: "MAINTENANCE",
    location: {
      type: "Point",
      coordinates: [83.21, 17.68],
    },
  },
];

const seededHospitals = [
  {
    name: "King George Hospital",
    address: "Maharani Peta, Visakhapatnam, Andhra Pradesh 530002",
    totalBeds: 200,
    availableBeds: 45,
    icuCapacity: 20,
    availableIcu: 8,
    isAtCapacity: false,
    location: {
      type: "Point",
      coordinates: [83.2185, 17.71],
    },
  },
  {
    name: "Care Hospitals",
    address: "RTC Complex, Visakhapatnam, Andhra Pradesh 530013",
    totalBeds: 150,
    availableBeds: 30,
    icuCapacity: 15,
    availableIcu: 5,
    isAtCapacity: false,
    location: {
      type: "Point",
      coordinates: [83.22, 17.72],
    },
  },
  {
    name: "Apollo Hospitals",
    address: "RTC Complex Road, Visakhapatnam, Andhra Pradesh 530013",
    totalBeds: 300,
    availableBeds: 80,
    icuCapacity: 30,
    availableIcu: 12,
    isAtCapacity: false,
    location: {
      type: "Point",
      coordinates: [83.215, 17.705],
    },
  },
  {
    name: "Narayana Medical Centre",
    address: "Dwaraka Nagar, Visakhapatnam, Andhra Pradesh 530016",
    totalBeds: 100,
    availableBeds: 5,
    icuCapacity: 10,
    availableIcu: 1,
    isAtCapacity: true,
    location: {
      type: "Point",
      coordinates: [83.225, 17.715],
    },
  },
];

export async function GET() {
  try {
    await connectToDatabase();

    await Ambulance.deleteMany({});
    await Hospital.deleteMany({});

    const createdAmbulances = await Ambulance.insertMany(seededAmbulances);
    const createdHospitals = await Hospital.insertMany(seededHospitals);

    return NextResponse.json(
      {
        success: true,
        message:
          "Database seeded successfully with test ambulance and hospital data.",
        ambulances: createdAmbulances,
        hospitals: createdHospitals,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed the MongoDB database.",
      },
      { status: 500 }
    );
  }
}
