"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Ambulance,
  FileText,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Siren,
  Stethoscope,
  Building2,
  Heart,
  CheckCircle2,
  Clock,
  Trash2,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";

const AdminMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

/* ─── Interfaces ─── */
interface AmbulanceRecord {
  _id: string;
  vehicleNumber: string;
  driverName: string;
  status: "AVAILABLE" | "DISPATCHED" | "MAINTENANCE";
  location?: { coordinates?: [number, number] };
  createdAt?: string;
  updatedAt?: string;
}

interface EmergencyLog {
  _id: string;
  emergencyId: string;
  patientName?: string;
  patientContact?: string;
  symptoms?: string[];
  severityScore?: number;
  priority?: string;
  status?: string;
  assignedAmbulanceVehicle?: string;
  destinationHospitalName?: string;
  vitals?: { heartRate: number | null; spo2: number | null };
  dispatchedAt?: string;
  pickedUpAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  handoverTimestamp?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  vehicleNumber?: string;
  hospitalId?: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt?: string;
}

interface HospitalRecord {
  _id: string;
  name: string;
  address: string;
  totalBeds: number;
  availableBeds: number;
  icuCapacity: number;
  availableIcu: number;
  isAtCapacity: boolean;
  location?: { coordinates?: [number, number] };
  createdAt?: string;
}

type AdminTab = "fleet" | "approvals" | "hospitals" | "logs" | "audit" | "map";

/* ─── Component ─── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("fleet");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  /* ─── Fleet Polling ─── */
  const fetchAmbulances = useCallback(async () => {
    const response = await fetch("/api/ambulances", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load fleet data.");
    const payload = await response.json();
    setLastRefreshed(new Date());
    return (payload.ambulances ?? []) as AmbulanceRecord[];
  }, []);

  const {
    data: polledAmbulances,
    loading: fleetLoading,
    error: fleetError,
    refetch: refreshFleet,
  } = usePolling<AmbulanceRecord[]>(fetchAmbulances, 5000);

  /* ─── Emergency Polling ─── */
  const fetchEmergencies = useCallback(async () => {
    const response = await fetch("/api/emergencies", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load emergency logs.");
    const payload = await response.json();
    return (payload.emergencies ?? []) as EmergencyLog[];
  }, []);

  const {
    data: polledEmergencies,
    loading: logLoading,
    refetch: refreshLogs,
  } = usePolling<EmergencyLog[]>(fetchEmergencies, 5000);

  /* ─── User Management State ─── */
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userStats, setUserStats] = useState<Record<string, number>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
  const [approvalAction, setApprovalAction] = useState<string | null>(null);

  /* ─── Hospital Management State ─── */
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [showHospitalForm, setShowHospitalForm] = useState(false);
  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    availableBeds: "20",
    totalBeds: "20",
    icuCapacity: "5",
    availableIcu: "5",
  });

  /* ─── Ambulance Creation State ─── */
  const [showAmbulanceForm, setShowAmbulanceForm] = useState(false);
  const [ambulanceForm, setAmbulanceForm] = useState({
    vehicleNumber: "",
    driverName: "",
    lat: "",
    lng: "",
  });

  /* ─── Fetch Functions ─── */
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (userRoleFilter !== "all") params.set("role", userRoleFilter);
      if (userStatusFilter !== "all") params.set("status", userStatusFilter);
      if (userSearch) params.set("search", userSearch);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load users.");
      const payload = await response.json();
      setUsers(payload.users ?? []);
      setUserStats(payload.stats ?? {});
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setUsersLoading(false);
    }
  }, [userRoleFilter, userStatusFilter, userSearch]);

  const fetchHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try {
      const response = await fetch("/api/admin/hospitals", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load hospitals.");
      const payload = await response.json();
      setHospitals(payload.hospitals ?? []);
    } catch {
      console.error("Failed to fetch hospitals");
    } finally {
      setHospitalsLoading(false);
    }
  }, []);

  /* ─── Effects ─── */
  useEffect(() => {
    if (activeTab === "approvals" || activeTab === "logs") {
      void fetchUsers();
    }
    if (activeTab === "hospitals") {
      void fetchHospitals();
    }
  }, [activeTab, fetchUsers, fetchHospitals]);

  /* ─── Actions ─── */
  const handleUserAction = async (userId: string, action: "approve" | "reject") => {
    setApprovalAction(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "Action failed");
        return;
      }
      void fetchUsers();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setApprovalAction(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    setApprovalAction(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "Delete failed");
        return;
      }
      void fetchUsers();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setApprovalAction(null);
    }
  };

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hospitalForm),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to create hospital");
        return;
      }
      setShowHospitalForm(false);
      setHospitalForm({ name: "", address: "", lat: "", lng: "", availableBeds: "20", totalBeds: "20", icuCapacity: "5", availableIcu: "5" });
      void fetchHospitals();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleDeleteHospital = async (hospitalId: string) => {
    if (!confirm("Are you sure you want to permanently delete this hospital?")) return;
    try {
      const response = await fetch(`/api/admin/hospitals?id=${hospitalId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Delete failed");
        return;
      }
      void fetchHospitals();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleCreateAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/ambulances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ambulanceForm),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to create ambulance");
        return;
      }
      setShowAmbulanceForm(false);
      setAmbulanceForm({ vehicleNumber: "", driverName: "", lat: "", lng: "" });
      void refreshFleet();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleDeleteAmbulance = async (ambulanceId: string) => {
    if (!confirm("Are you sure you want to permanently delete this ambulance?")) return;
    try {
      const response = await fetch(`/api/admin/ambulances?id=${ambulanceId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Delete failed");
        return;
      }
      void refreshFleet();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const refreshAll = () => {
    void refreshFleet();
    void refreshLogs();
    void fetchUsers();
    void fetchHospitals();
  };

  const ambulances = polledAmbulances ?? [];
  const emergencies = polledEmergencies ?? [];
  const errorMessage = fleetError?.message || "";

  const fleetStats = {
    available: ambulances.filter((a) => a.status === "AVAILABLE").length,
    dispatched: ambulances.filter((a) => a.status === "DISPATCHED").length,
    maintenance: ambulances.filter((a) => a.status === "MAINTENANCE").length,
    total: ambulances.length,
  };

  const emergencyStats = {
    total: emergencies.length,
    red: emergencies.filter((e) => e.priority === "RED").length,
    yellow: emergencies.filter((e) => e.priority === "YELLOW").length,
    green: emergencies.filter((e) => e.priority === "GREEN").length,
  };

  const pendingUsers = users.filter((u) => !u.isApproved && (u.role === "driver" || u.role === "hospital"));

  const TABS = [
    { key: "fleet", label: "Fleet", icon: Ambulance },
    { key: "approvals", label: `Approvals (${pendingUsers.length})`, icon: Users },
    { key: "hospitals", label: "Hospitals", icon: Building2 },
    { key: "logs", label: "Emergency Logs", icon: FileText },
    { key: "audit", label: "Incident Audit", icon: Clock },
    { key: "map", label: "Live Map", icon: MapPin },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Admin Console</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">Fleet Command Center</h1>
                {lastRefreshed && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3 w-3" /> Last refreshed: {lastRefreshed.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void refreshFleet()} disabled={fleetLoading}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
                <RefreshCcw className={`h-4 w-4 ${fleetLoading ? "animate-spin" : ""}`} />
                {fleetLoading ? "Refreshing..." : "Refresh Fleet"}
              </button>
              <button type="button" onClick={refreshAll}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700">
                <RefreshCcw className="h-4 w-4" /> Refresh All
              </button>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2"><Ambulance className="h-4 w-4 text-emerald-400" /><span className="text-sm text-emerald-200">Available</span></div>
            <p className="mt-2 text-3xl font-black text-emerald-400">{fleetStats.available}</p>
          </div>
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center gap-2"><Ambulance className="h-4 w-4 text-red-400" /><span className="text-sm text-red-200">Dispatched</span></div>
            <p className="mt-2 text-3xl font-black text-red-400">{fleetStats.dispatched}</p>
          </div>
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2"><Siren className="h-4 w-4 text-amber-400" /><span className="text-sm text-amber-200">Emergencies</span></div>
            <p className="mt-2 text-3xl font-black text-amber-400">{emergencyStats.total}</p>
          </div>
          <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /><span className="text-sm text-blue-200">Pending Approval</span></div>
            <p className="mt-2 text-3xl font-black text-blue-400">{userStats.pending ?? pendingUsers.length}</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span>{errorMessage}</span></div>
          </div>
        )}

        {/* ═══ Fleet Tab ═══ */}
        {activeTab === "fleet" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Ambulance Fleet</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{fleetStats.total} total</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowAmbulanceForm(!showAmbulanceForm)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                  <Plus className="h-4 w-4" /> Add Ambulance
                </button>
                <button type="button" onClick={() => void refreshFleet()} disabled={fleetLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:opacity-60">
                  <RefreshCcw className={`h-4 w-4 ${fleetLoading ? "animate-spin" : ""}`} /> Refresh Fleet
                </button>
              </div>
            </div>

            {/* Add Ambulance Form */}
            {showAmbulanceForm && (
              <form onSubmit={handleCreateAmbulance} className="mb-6 rounded-3xl border border-blue-500/30 bg-blue-500/5 p-6">
                <h3 className="mb-4 text-lg font-bold text-white">Add New Ambulance</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Vehicle Number</label>
                    <input type="text" required placeholder="e.g. AMB-201" value={ambulanceForm.vehicleNumber}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, vehicleNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Driver Name</label>
                    <input type="text" required placeholder="e.g. John Doe" value={ambulanceForm.driverName}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, driverName: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input type="number" step="any" required placeholder="e.g. 17.6868" value={ambulanceForm.lat}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, lat: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input type="number" step="any" required placeholder="e.g. 83.2185" value={ambulanceForm.lng}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, lng: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
                    <Plus className="h-4 w-4" /> Create Ambulance
                  </button>
                  <button type="button" onClick={() => setShowAmbulanceForm(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {fleetLoading && ambulances.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-400" /> Loading fleet...
              </div>
            ) : ambulances.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <Ambulance className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">No ambulances registered</p>
                <p className="mt-2 text-sm">Visit <code className="text-blue-400">/api/seed</code> to seed test data, or add one above.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ambulances.map((ambulance) => (
                  <div key={ambulance._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20 transition hover:border-slate-700">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Vehicle</p>
                        <h2 className="mt-2 text-2xl font-black text-white">{ambulance.vehicleNumber}</h2>
                        <p className="text-sm text-slate-400">{ambulance.driverName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                          ambulance.status === "AVAILABLE" ? "bg-emerald-500/15 text-emerald-300"
                          : ambulance.status === "DISPATCHED" ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                        }`}>{ambulance.status}</span>
                        {ambulance.status !== "DISPATCHED" && (
                          <button type="button" onClick={() => void handleDeleteAmbulance(ambulance._id)}
                            className="rounded-lg bg-red-500/10 p-1.5 text-red-400 transition hover:bg-red-500/20">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Location</p>
                        <p className="mt-1 text-white">
                          {ambulance.location?.coordinates
                            ? `${ambulance.location.coordinates[1].toFixed(5)}, ${ambulance.location.coordinates[0].toFixed(5)}`
                            : "Location unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {ambulance.status === "AVAILABLE" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : ambulance.status === "DISPATCHED" ? <Siren className="h-4 w-4 text-red-400" />
                        : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                      <span className="text-xs text-slate-500">
                        {ambulance.status === "AVAILABLE" ? "Ready for dispatch"
                          : ambulance.status === "DISPATCHED" ? "Currently on a call"
                          : "Out of service"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Pending Approvals Tab ═══ */}
        {activeTab === "approvals" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pending Account Approvals</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search users..." value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void fetchUsers(); }}
                    className="rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500 w-48" />
                </div>
                <select value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
                <button type="button" onClick={() => void fetchUsers()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700">
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>

            {usersLoading ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-400" /> Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <Users className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">No users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user._id} className={`rounded-2xl border p-4 ${
                    !user.isApproved && (user.role === "driver" || user.role === "hospital")
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-slate-800 bg-slate-900/70"
                  }`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          user.role === "admin" ? "bg-blue-500/15 text-blue-400"
                          : user.role === "driver" ? "bg-emerald-500/15 text-emerald-400"
                          : user.role === "hospital" ? "bg-purple-500/15 text-purple-400"
                          : "bg-slate-500/15 text-slate-400"
                        }`}>
                          {user.role === "admin" ? <ShieldCheck className="h-5 w-5" />
                            : user.role === "driver" ? <Ambulance className="h-5 w-5" />
                            : user.role === "hospital" ? <Building2 className="h-5 w-5" />
                            : <Heart className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white">{user.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              user.role === "admin" ? "bg-blue-500/20 text-blue-300"
                              : user.role === "driver" ? "bg-emerald-500/20 text-emerald-300"
                              : user.role === "hospital" ? "bg-purple-500/20 text-purple-300"
                              : "bg-slate-500/20 text-slate-300"
                            }`}>{user.role}</span>
                            {user.isApproved ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">APPROVED</span>
                            ) : (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">PENDING</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{user.email}</p>
                          {user.phone && <p className="text-xs text-slate-500">{user.phone}</p>}
                          {user.vehicleNumber && <p className="text-xs text-emerald-400">Vehicle: {user.vehicleNumber}</p>}
                          {user.hospitalId && <p className="text-xs text-purple-400">Hospital: {user.hospitalId}</p>}
                          <p className="text-xs text-slate-600">Registered: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!user.isApproved && (user.role === "driver" || user.role === "hospital") && (
                          <>
                            <button type="button" onClick={() => void handleUserAction(user._id, "approve")}
                              disabled={approvalAction === user._id}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
                              <UserCheck className="h-4 w-4" /> Approve
                            </button>
                            <button type="button" onClick={() => void handleUserAction(user._id, "reject")}
                              disabled={approvalAction === user._id}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60">
                              <UserX className="h-4 w-4" /> Reject
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => void handleDeleteUser(user._id)}
                          disabled={approvalAction === user._id || user.role === "admin"}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Hospitals Tab ═══ */}
        {activeTab === "hospitals" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Hospital Management</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{hospitals.length} total</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowHospitalForm(!showHospitalForm)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                  <Plus className="h-4 w-4" /> Add Hospital
                </button>
                <button type="button" onClick={() => void fetchHospitals()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700">
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>

            {/* Add Hospital Form */}
            {showHospitalForm && (
              <form onSubmit={handleCreateHospital} className="mb-6 rounded-3xl border border-blue-500/30 bg-blue-500/5 p-6">
                <h3 className="mb-4 text-lg font-bold text-white">Add New Hospital</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Hospital Name</label>
                    <input type="text" required placeholder="e.g. City General Hospital" value={hospitalForm.name}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Address</label>
                    <input type="text" required placeholder="e.g. 123 Main Street" value={hospitalForm.address}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input type="number" step="any" required placeholder="e.g. 17.6868" value={hospitalForm.lat}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, lat: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input type="number" step="any" required placeholder="e.g. 83.2185" value={hospitalForm.lng}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, lng: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Available Beds</label>
                    <input type="number" min="0" required value={hospitalForm.availableBeds}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, availableBeds: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Beds</label>
                    <input type="number" min="0" required value={hospitalForm.totalBeds}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, totalBeds: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ICU Capacity</label>
                    <input type="number" min="0" required value={hospitalForm.icuCapacity}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, icuCapacity: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Available ICU</label>
                    <input type="number" min="0" required value={hospitalForm.availableIcu}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, availableIcu: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
                    <Plus className="h-4 w-4" /> Create Hospital
                  </button>
                  <button type="button" onClick={() => setShowHospitalForm(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {hospitalsLoading ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-400" /> Loading hospitals...
              </div>
            ) : hospitals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">No hospitals registered</p>
                <p className="mt-2 text-sm">Add a hospital above or visit <code className="text-blue-400">/api/seed</code> to seed data.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {hospitals.map((hospital) => (
                  <div key={hospital._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hospital</p>
                        <h2 className="mt-2 text-xl font-black text-white">{hospital.name}</h2>
                        <p className="text-xs text-slate-400 mt-1">{hospital.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hospital.isAtCapacity ? (
                          <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-black text-red-300">AT CAPACITY</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300">OPEN</span>
                        )}
                        <button type="button" onClick={() => void handleDeleteHospital(hospital._id)}
                          className="rounded-lg bg-red-500/10 p-1.5 text-red-400 transition hover:bg-red-500/20">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-center">
                        <p className="text-xs text-slate-500">Beds</p>
                        <p className="text-lg font-black text-white">{hospital.availableBeds}<span className="text-sm text-slate-500">/{hospital.totalBeds}</span></p>
                      </div>
                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-center">
                        <p className="text-xs text-slate-500">ICU</p>
                        <p className="text-lg font-black text-white">{hospital.availableIcu}<span className="text-sm text-slate-500">/{hospital.icuCapacity}</span></p>
                      </div>
                    </div>
                    {hospital.location?.coordinates && (
                      <p className="mt-3 text-xs text-slate-600">
                        📍 {hospital.location.coordinates[1].toFixed(5)}, {hospital.location.coordinates[0].toFixed(5)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Emergency Logs Tab ═══ */}
        {activeTab === "logs" && (
          <div>
            {logLoading && emergencies.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-400" /> Loading emergency logs...
              </div>
            ) : emergencies.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">No emergency logs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emergencies.map((log) => (
                  <div key={log._id} className={`rounded-3xl border p-5 ${
                    log.priority === "RED" ? "border-red-500/20 bg-red-500/5"
                    : log.priority === "YELLOW" ? "border-yellow-500/20 bg-yellow-500/5"
                    : "border-emerald-500/20 bg-emerald-500/5"
                  }`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${
                            log.priority === "RED" ? "bg-red-500/20 text-red-300"
                            : log.priority === "YELLOW" ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-emerald-500/20 text-emerald-300"
                          }`}>{log.priority}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            log.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300"
                            : log.status === "ARRIVED" ? "bg-blue-500/20 text-blue-300"
                            : "bg-slate-500/20 text-slate-300"
                          }`}>{log.status}</span>
                          {log.severityScore && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">Severity: {log.severityScore}/10</span>}
                        </div>
                        <p className="text-lg font-bold text-white">{log.symptoms?.join(", ") || "Emergency case"}</p>
                        <p className="text-xs text-slate-400">{log.emergencyId} &bull; {log.patientName || "Unknown"} &bull; {log.assignedAmbulanceVehicle || "N/A"} &rarr; {log.destinationHospitalName || "TBD"} &bull; {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <div className="rounded-xl bg-slate-800/50 px-3 py-2 text-center">
                          <Heart className="mx-auto h-3 w-3 text-red-400" />
                          <p className="text-xs text-slate-400">HR</p>
                          <p className="text-sm font-bold text-white">{log.vitals?.heartRate ?? "—"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-800/50 px-3 py-2 text-center">
                          <Stethoscope className="mx-auto h-3 w-3 text-blue-400" />
                          <p className="text-xs text-slate-400">SpO₂</p>
                          <p className="text-sm font-bold text-white">{log.vitals?.spo2 ? `${log.vitals.spo2}%` : "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Incident Audit Tab ═══ */}
        {activeTab === "audit" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Incident Audit Reports</h2>
              <button type="button" onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700">
                <FileText className="h-4 w-4" /> Print Report
              </button>
            </div>

            {emergencies.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <Clock className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">No incidents to audit</p>
              </div>
            ) : (
              <div className="space-y-6">
                {emergencies.map((log) => {
                  const created = log.createdAt ? new Date(log.createdAt) : null;
                  const dispatched = log.dispatchedAt ? new Date(log.dispatchedAt) : null;
                  const arrived = log.arrivedAt ? new Date(log.arrivedAt) : null;
                  const completed = log.completedAt ? new Date(log.completedAt) : null;
                  const responseTimeMs = created && dispatched ? dispatched.getTime() - created.getTime() : null;
                  const transitTimeMs = dispatched && arrived ? arrived.getTime() - dispatched.getTime() : null;
                  const totalTimeMs = created && (arrived || completed) ? (arrived || completed)!.getTime() - created.getTime() : null;
                  const formatDuration = (ms: number | null): string => {
                    if (ms === null || ms < 0) return "—";
                    const totalSec = Math.floor(ms / 1000);
                    const min = Math.floor(totalSec / 60);
                    const sec = totalSec % 60;
                    if (min > 0) return `${min}m ${sec}s`;
                    return `${sec}s`;
                  };
                  return (
                    <div key={log._id} className={`rounded-3xl border p-6 ${
                      log.priority === "RED" ? "border-red-500/20 bg-red-500/5"
                      : log.priority === "YELLOW" ? "border-yellow-500/20 bg-yellow-500/5"
                      : "border-emerald-500/20 bg-emerald-500/5"
                    }`}>
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${log.priority === "RED" ? "bg-red-500/20 text-red-300" : log.priority === "YELLOW" ? "bg-yellow-500/20 text-yellow-300" : "bg-emerald-500/20 text-emerald-300"}`}>{log.priority}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${log.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300" : log.status === "ARRIVED" ? "bg-blue-500/20 text-blue-300" : "bg-slate-500/20 text-slate-300"}`}>{log.status}</span>
                            {log.severityScore && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">Severity: {log.severityScore}/10</span>}
                          </div>
                          <p className="text-xl font-bold text-white">{log.emergencyId}</p>
                          <p className="text-sm text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</p>
                        </div>
                      </div>
                      <div className="mb-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Patient</p>
                          <p className="text-sm font-semibold text-white">{log.patientName || "Unknown"}</p>
                          {log.patientContact && <p className="text-xs text-slate-400 mt-1">{log.patientContact}</p>}
                          <p className="text-xs text-slate-400 mt-1">{log.symptoms?.join(", ") || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Assigned Resources</p>
                          <p className="text-sm font-semibold text-white">Vehicle: {log.assignedAmbulanceVehicle || "N/A"}</p>
                          <p className="text-xs text-slate-400 mt-1">Hospital: {log.destinationHospitalName || "TBD"}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Timing Metrics</p>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div><p className="text-xs text-slate-500">Response Time</p><p className="mt-1 text-lg font-black text-white">{formatDuration(responseTimeMs)}</p></div>
                          <div><p className="text-xs text-slate-500">Transit Duration</p><p className="mt-1 text-lg font-black text-white">{formatDuration(transitTimeMs)}</p></div>
                          <div><p className="text-xs text-slate-500">Total Time</p><p className="mt-1 text-lg font-black text-white">{formatDuration(totalTimeMs)}</p></div>
                          <div><p className="text-xs text-slate-500">Vitals</p><div className="mt-1 flex gap-2"><span className="text-xs text-slate-300">HR: {log.vitals?.heartRate ?? "—"}</span><span className="text-xs text-slate-300">SpO₂: {log.vitals?.spo2 ? `${log.vitals.spo2}%` : "—"}</span></div></div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          { label: "SOS Triggered", time: log.createdAt, active: true },
                          { label: "Dispatched", time: log.dispatchedAt, active: !!log.dispatchedAt },
                          { label: "Patient Picked Up", time: log.pickedUpAt, active: !!log.pickedUpAt },
                          { label: "Arrived at ER", time: log.arrivedAt, active: !!log.arrivedAt },
                          { label: "Completed", time: log.completedAt || log.handoverTimestamp, active: !!(log.completedAt || log.handoverTimestamp) },
                        ].map((step, i) => (
                          <div key={i} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${step.active ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-500"}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${step.active ? "bg-blue-400" : "bg-slate-600"}`} />
                            {step.label}
                            {step.time && <span className="text-[10px] text-slate-400">{new Date(step.time).toLocaleTimeString()}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Live Map Tab ═══ */}
        {activeTab === "map" && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">All Ambulances &amp; Hospitals</h2>
              <button type="button" onClick={() => void refreshFleet()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700">
                <RefreshCcw className="h-3 w-3" /> Refresh
              </button>
            </div>
            <AdminMap
              hospitalLocations={
                ambulances
                  .filter((a) => a.location?.coordinates)
                  .map((a) => ({
                    id: a._id,
                    name: a.vehicleNumber,
                    location: { lat: a.location!.coordinates![1], lng: a.location!.coordinates![0] },
                  })) ?? []
              }
              center={{ lat: 17.6868, lng: 83.2185 }}
              zoom={12}
            />
          </div>
        )}
      </div>
    </main>
  );
}
