"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Loader2,
  Mail,
  Lock,
  User,
  Phone,
  Shield,
  Truck,
  Building2,
  Siren,
  Eye,
  EyeOff,
} from "lucide-react";

const roles = [
  {
    value: "patient",
    label: "Patient",
    description: "Request emergency SOS services",
    icon: Siren,
    color: "border-red-500/30 bg-red-500/5 text-red-300",
    activeColor: "border-red-500 bg-red-500/10 text-red-300",
  },
  {
    value: "driver",
    label: "Ambulance Driver",
    description: "Accept dispatches and navigate to patients",
    icon: Truck,
    color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    activeColor: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
  },
  {
    value: "hospital",
    label: "Hospital Staff",
    description: "Manage ER queue and patient handovers",
    icon: Building2,
    color: "border-blue-500/30 bg-blue-500/5 text-blue-300",
    activeColor: "border-blue-500 bg-blue-500/10 text-blue-300",
  },
  {
    value: "admin",
    label: "System Admin",
    description: "Full fleet analytics and management",
    icon: Shield,
    color: "border-purple-500/30 bg-purple-500/5 text-purple-300",
    activeColor: "border-purple-500 bg-purple-500/10 text-purple-300",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role: selectedRole,
          phone,
          vehicleNumber: selectedRole === "driver" ? vehicleNumber : undefined,
          hospitalId: selectedRole === "hospital" ? hospitalId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Registration failed.");
      }

      setSuccess("Account created! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/30">
            <Ambulance className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            Create Account
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Join the Smart Ambulance emergency response network
          </p>
        </div>

        {/* Register Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30">
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select your role
            </label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((role) => {
                const isActive = selectedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedRole(role.value)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      isActive ? role.activeColor : role.color
                    }`}
                  >
                    <role.icon className="h-5 w-5 mb-2" />
                    <p className="text-sm font-bold">{role.label}</p>
                    <p className="text-xs opacity-70">{role.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-12 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Driver: Vehicle Number */}
            {selectedRole === "driver" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle Number
                </label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="AMB-101"
                    required
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            {/* Hospital: Hospital ID */}
            {selectedRole === "hospital" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Hospital ID
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    placeholder="HOSP-001"
                    required
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-900/30 transition hover:shadow-red-700/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-red-400 hover:text-red-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
