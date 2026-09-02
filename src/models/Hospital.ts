import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHospital extends Document {
  name: string;
  address: string;
  totalBeds: number;
  availableBeds: number;
  icuCapacity: number;
  availableIcu: number;
  staffCount: number;
  isAtCapacity: boolean;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    totalBeds: {
      type: Number,
      required: true,
      min: 0,
      default: 50,
    },
    availableBeds: {
      type: Number,
      required: true,
      min: 0,
      default: 50,
    },
    icuCapacity: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    availableIcu: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    staffCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isAtCapacity: {
      type: Boolean,
      default: false,
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

HospitalSchema.index({ location: "2dsphere" });

const Hospital: Model<IHospital> =
  mongoose.models.Hospital ||
  mongoose.model<IHospital>("Hospital", HospitalSchema);

export default Hospital;
