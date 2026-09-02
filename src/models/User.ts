import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "patient" | "driver" | "hospital" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  vehicleNumber?: string;
  hospitalId?: string;
  avatar?: string;
  googleId?: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["patient", "driver", "hospital", "admin"],
      default: "patient",
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    hospitalId: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    googleId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  if (!this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const userPassword = (this as unknown as { password?: string }).password;
  if (!userPassword) return false;
  return bcrypt.compare(candidatePassword, userPassword);
};

// Index for fast email lookups
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isApproved: 1 });
UserSchema.index({ role: 1, isApproved: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
