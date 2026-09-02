"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Shield,
  Truck,
  Building2,
  Siren,
  Camera,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Save,
  ArrowLeft,
  Clock,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  vehicleNumber: string;
  hospitalId: string;
  avatar: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof Siren; description: string }> = {
  patient: {
    label: "Patient",
    color: "bg-red-500/15 text-red-300 ring-red-500/30",
    icon: Siren,
    description: "Emergency SOS portal access",
  },
  driver: {
    label: "Driver",
    color: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    icon: Truck,
    description: "Ambulance driver HUD access",
  },
  hospital: {
    label: "Hospital Staff",
    color: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    icon: Building2,
    description: "Hospital ER queue management",
  },
  admin: {
    label: "Administrator",
    color: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
    icon: Shield,
    description: "Full system administration access",
  },
};

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load profile.");
      const data = await response.json();
      if (data.success && data.user) {
        setProfile(data.user);
        setEditName(data.user.name || "");
        setEditPhone(data.user.phone || "");
        setEditAvatar(data.user.avatar || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchProfile();
    }
  }, [status, fetchProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Save profile
  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          avatar: editAvatar,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update profile.");
      }

      setProfile(data.user);
      setIsEditing(false);
      setSuccess("Profile updated successfully!");

      // Update NextAuth session so navbar reflects changes
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: data.user.name,
          phone: data.user.phone,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    if (profile) {
      setEditName(profile.name || "");
      setEditPhone(profile.phone || "");
      setEditAvatar(profile.avatar || "");
    }
    setIsEditing(false);
    setError("");
  };

  if (status === "loading" || isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8" />
          <p>Failed to load profile.</p>
        </div>
      </main>
    );
  }

  const config = roleConfig[profile.role] || roleConfig.patient;
  const RoleIcon = config.icon;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">
              Account
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              User Profile
            </h1>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{success}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30">
          {/* Avatar & Role */}
          <div className="mb-6 flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-black text-white ring-2 ring-slate-700">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  profile.name.charAt(0).toUpperCase()
                )}
              </div>
              {isEditing && (
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white">
                  <Camera className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white">{profile.name}</h2>
              <p className="text-sm text-slate-400">{profile.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${config.color}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {config.label}
                </span>
                {profile.isApproved ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    Approved
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                    Pending Approval
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">{config.description}</p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User className="h-3.5 w-3.5" /> Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                />
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-white">
                  {profile.name}
                </div>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </label>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-300">
                {profile.email}
                <span className="ml-2 text-xs text-slate-600">(cannot be changed)</span>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Phone className="h-3.5 w-3.5" /> Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500 placeholder:text-slate-600"
                />
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-white">
                  {profile.phone || "Not set"}
                </div>
              )}
            </div>

            {/* Avatar URL */}
            {isEditing && (
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Camera className="h-3.5 w-3.5" /> Profile Picture URL
                </label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
            )}

            {/* Role (read-only) */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Shield className="h-3.5 w-3.5" /> Role
              </label>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-300">
                {config.label}
                <span className="ml-2 text-xs text-slate-600">(assigned at registration)</span>
              </div>
            </div>

            {/* Role-specific fields */}
            {profile.role === "driver" && profile.vehicleNumber && (
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Truck className="h-3.5 w-3.5" /> Vehicle Number
                </label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-white font-mono font-bold">
                  {profile.vehicleNumber}
                </div>
              </div>
            )}

            {profile.role === "hospital" && profile.hospitalId && (
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="h-3.5 w-3.5" /> Hospital ID
                </label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-white font-mono font-bold">
                  {profile.hospitalId}
                </div>
              </div>
            )}

            {/* Account Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Member Since
                </label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Last Updated
                </label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  {profile.updatedAt
                    ? new Date(profile.updatedAt).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"
              >
                <User className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
