import mongoose, { Schema, Document, Model } from "mongoose";

export type AmbulanceStatus = "AVAILABLE" | "DISPATCHED" | "MAINTENANCE" | "OFFLINE";

export interface IAmbulance extends Document {
  vehicleNumber: string;
  driverName: string;
  status: AmbulanceStatus;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  createdAt: Date;
  updatedAt: Date;
}

const AmbulanceSchema = new Schema<IAmbulance>(
  {
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    driverName: {
      type: String,
      required: true,
      trim: true,
      default: "Unassigned",
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "DISPATCHED", "MAINTENANCE", "OFFLINE"],
      default: "AVAILABLE",
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: [number, number]) => coords.length === 2,
          message: "Location coordinates must be [longitude, latitude].",
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

AmbulanceSchema.index({ location: "2dsphere" });

const Ambulance: Model<IAmbulance> =
  mongoose.models.Ambulance ||
  mongoose.model<IAmbulance>("Ambulance", AmbulanceSchema);

export default Ambulance;
