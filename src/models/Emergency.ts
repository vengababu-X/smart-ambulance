import mongoose, { Schema, Document, Model } from "mongoose";

export type EmergencyStatus =
  | "PENDING"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COMPLETED";

export interface IEmergency extends Document {
  emergencyId: string;
  patientName: string;
  patientContact: string;
  symptoms: string[];
  severityScore: number;
  priority: "RED" | "YELLOW" | "GREEN";
  patientCoordinates: {
    type: "Point";
    coordinates: [number, number];
  };
  status: EmergencyStatus;
  assignedAmbulanceId: string | null;
  assignedAmbulanceVehicle: string | null;
  destinationHospitalId: string | null;
  destinationHospitalName: string | null;
  aiTriageNotes: string;
  vitals: {
    heartRate: number | null;
    spo2: number | null;
  };
  handoverTimestamp: Date | null;
  dispatchedAt: Date | null;
  pickedUpAt: Date | null;
  arrivedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencySchema = new Schema<IEmergency>(
  {
    emergencyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    patientName: {
      type: String,
      trim: true,
      default: "Unknown Patient",
    },
    patientContact: {
      type: String,
      trim: true,
      default: "0000000000",
    },
    symptoms: {
      type: [String],
      required: true,
      default: [],
    },
    severityScore: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 5,
    },
    priority: {
      type: String,
      enum: ["RED", "YELLOW", "GREEN"],
      required: true,
      default: "YELLOW",
    },
    patientCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: [number, number]) => coords.length === 2,
          message: "Patient coordinates must be [longitude, latitude].",
        },
      },
    },
    status: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COMPLETED"],
      required: true,
      default: "PENDING",
    },
    assignedAmbulanceId: {
      type: String,
      default: null,
      index: true,
    },
    assignedAmbulanceVehicle: {
      type: String,
      default: null,
    },
    destinationHospitalId: {
      type: String,
      default: null,
      index: true,
    },
    destinationHospitalName: {
      type: String,
      default: null,
    },
    aiTriageNotes: {
      type: String,
      default: "",
    },
    vitals: {
      heartRate: {
        type: Number,
        default: null,
      },
      spo2: {
        type: Number,
        default: null,
      },
    },
    handoverTimestamp: {
      type: Date,
      default: null,
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    arrivedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

EmergencySchema.index({ patientCoordinates: "2dsphere" });

const Emergency: Model<IEmergency> =
  mongoose.models.Emergency ||
  mongoose.model<IEmergency>("Emergency", EmergencySchema);

export default Emergency;
