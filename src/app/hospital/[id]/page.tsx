"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Heart,
  Loader2,
  MapPin,
  Save,
  Siren,
  Stethoscope,
  Truck,
  Activity,
  X,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";

/* ─── Types ─── */
interface EmergencyRecord {
  _id: string;
  emergencyId: string;
  patientName?: string;
  patientContact?: string;
  patientCoordinates?: {
    coordinates: [number, number];
  };
  symptoms?: string[];
  severityScore?: number;
  priority?: "RED" | "YELLOW" | "GREEN";
  status?: string;
  assignedAmbulanceVehicle?: string;
  destinationHospitalId?: string;
  destinationHospitalName?: string;
  vitals?: {
    heartRate: number | null;
    spo2: number | null;
  };
  dispatchedAt?: string;
  pickedUpAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  handoverTimestamp?: string;
  createdAt?: string;
}

interface CapacityData {
  id: string;
  name: string;
  address: string;
  totalBeds: number;
  availableBeds: number;
  icuCapacity: number;
  availableIcu: number;
  staffCount: number;
  isAtCapacity: boolean;
}

interface HistorySummary {
  total: number;
  red: number;
  yellow: number;
  green: number;
  pending: number;
  assigned: number;
  enRoute: number;
  arrived: number;
  completed: number;
}

const priorityOrder: Record<string, number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
};

type DashboardTab = "live" | "history";

export default function HospitalQueuePage({
  params,
}: {
  params: { id: string };
}) {
  /* ─── Tab State ─── */
  const [activeTab, setActiveTab] = useState<DashboardTab>("live");

  /* ─── Capacity Widget State ─── */
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [editBeds, setEditBeds] = useState("");
  const [editIcu, setEditIcu] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  /* ─── Date Filter State ─── */
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  /* ─── History State ─── */
  const [historyRecords, setHistoryRecords] = useState<EmergencyRecord[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  /* ─── Date Navigation Helpers ─── */
  const navigateDate = (offset: number) => {
    const current = new Date(selectedDate + "T00:00:00");
    current.setDate(current.getDate() + offset);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(dateStr + "T00:00:00");
    selected.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let label = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (diffDays === 0) label = "Today — " + label;
    else if (diffDays === -1) label = "Yesterday — " + label;

    return label;
  };

  /* ─── Fetch Capacity ─── */
  const fetchCapacity = useCallback(async () => {
    const response = await fetch(`/api/hospital/${params.id}/capacity`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load hospital capacity.");
    const data = await response.json();
    setCapacityLoading(false);
    setCapacityError(null);
    return data.hospital as CapacityData;
  }, [params.id]);

  const { data: polledCapacity } = usePolling<CapacityData>(
    fetchCapacity,
    5000
  );

  useEffect(() => {
    if (polledCapacity) setCapacity(polledCapacity);
  }, [polledCapacity]);

  useEffect(() => {
    void fetchCapacity().then(setCapacity).catch(() => setCapacityLoading(false));
  }, [fetchCapacity]);

  /* ─── Save Capacity ─── */
  const handleSaveCapacity = async () => {
    if (!capacity) return;
    setSaveLoading(true);
    setSaveSuccess(null);
    try {
      const body: Record<string, string> = {};
      if (editBeds !== String(capacity.availableBeds)) body.availableBeds = editBeds;
      if (editIcu !== String(capacity.availableIcu)) body.availableIcu = editIcu;

      if (Object.keys(body).length === 0) {
        setEditingCapacity(false);
        return;
      }

      const response = await fetch(`/api/hospital/${params.id}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Update failed");
        return;
      }

      setCapacity(data.hospital);
      setEditingCapacity(false);
      setSaveSuccess("Capacity updated — dispatchers now see live status.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  const startEditing = () => {
    if (!capacity) return;
    setEditBeds(String(capacity.availableBeds));
    setEditIcu(String(capacity.availableIcu));
    setEditingCapacity(true);
  };

  /* ─── Live Emergency Queue ─── */
  const fetchEmergencies = useCallback(async () => {
    const response = await fetch("/api/emergencies", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load active emergencies.");
    const data = await response.json();
    const emergencies: EmergencyRecord[] = Array.isArray(data.emergencies)
      ? data.emergencies
      : [];
    return emergencies.filter(
      (item) =>
        item.status &&
        !["COMPLETED"].includes(item.status) &&
        item.destinationHospitalId === params.id
    );
  }, [params.id]);

  const {
    data: records,
    loading,
    error: pollingError,
    refetch: refreshQueue,
  } = usePolling<EmergencyRecord[]>(fetchEmergencies, 3000);

  const activeRecords = useMemo(() => {
    const list = records ?? [];
    return [...list].sort((a, b) => {
      const pDiff =
        (priorityOrder[a.priority ?? "GREEN"] ?? 99) -
        (priorityOrder[b.priority ?? "GREEN"] ?? 99);
      if (pDiff !== 0) return pDiff;
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }, [records]);

  const stats = useMemo(() => {
    return {
      red: activeRecords.filter((r) => r.priority === "RED").length,
      yellow: activeRecords.filter((r) => r.priority === "YELLOW").length,
      green: activeRecords.filter((r) => r.priority === "GREEN").length,
      arrived: activeRecords.filter((r) => r.status === "ARRIVED").length,
    };
  }, [activeRecords]);

  /* ─── History Fetch ─── */
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params_obj = new URLSearchParams();
      params_obj.set("date", selectedDate);
      if (historyFilter !== "all") {
        params_obj.set("status", historyFilter);
      }

      const response = await fetch(
        `/api/hospital/${params.id}/history?${params_obj}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to load history.");
      const data = await response.json();
      setHistoryRecords(data.emergencies ?? []);
      setHistorySummary(data.summary ?? null);
    } catch {
      setHistoryError("Unable to load history for this date.");
    } finally {
      setHistoryLoading(false);
    }
  }, [params.id, selectedDate, historyFilter]);

  useEffect(() => {
    if (activeTab === "history") {
      void fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  /* ─── Helpers ─── */
  const calculateETA = (createdAt?: string): string => {
    if (!createdAt) return "—";
    const elapsed = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 60000
    );
    if (elapsed < 1) return "< 1 min";
    if (elapsed < 5) return `${elapsed} min`;
    return `${elapsed} min ago`;
  };

  const formatTimestamp = (ts?: string): string => {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/30">
                <Siren className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">
                  Hospital Command Center
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  {capacity?.name ?? "Loading..."}
                </h1>
                {capacity && (
                  <p className="text-xs text-slate-500 mt-1">
                    {capacity.address}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshQueue()}
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              >
                Refresh queue
              </button>
            </div>
          </div>
        </header>

        {/* ═══ Tab Navigation ═══ */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === "live"
                ? "bg-red-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            <Siren className="h-4 w-4" /> Live Queue
            {activeRecords.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {activeRecords.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            <Calendar className="h-4 w-4" /> Daily Logs
          </button>
        </div>

        {/* ═══ Live Capacity Update Widget ═══ */}
        {capacity && (
          <section className="mb-8 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                    <BedDouble className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Live Capacity
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time bed &amp; ICU availability — changes push to dispatch instantly
                    </p>
                  </div>
                  <div className="ml-auto">
                    {capacity.isAtCapacity ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-black text-red-300">
                        AT CAPACITY
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
                        OPEN
                      </span>
                    )}
                  </div>
                </div>

                {/* Capacity Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Available Beds
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {capacity.availableBeds}
                      <span className="text-sm font-medium text-slate-500">
                        /{capacity.totalBeds}
                      </span>
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          capacity.availableBeds === 0
                            ? "bg-red-500"
                            : capacity.availableBeds < capacity.totalBeds * 0.2
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.max(
                            0,
                            (capacity.availableBeds / capacity.totalBeds) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {capacity.totalBeds - capacity.availableBeds} occupied
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Available ICU
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {capacity.availableIcu}
                      <span className="text-sm font-medium text-slate-500">
                        /{capacity.icuCapacity}
                      </span>
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          capacity.availableIcu === 0
                            ? "bg-red-500"
                            : capacity.availableIcu <
                              capacity.icuCapacity * 0.2
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.max(
                            0,
                            (capacity.availableIcu / capacity.icuCapacity) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {capacity.icuCapacity - capacity.availableIcu} occupied
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Staff On Duty
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {capacity.staffCount}
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(5, (capacity.staffCount / 50) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Success toast */}
            {saveSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {saveSuccess}
              </div>
            )}

            {/* Quick-Edit Bar */}
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">
                  Quick Update
                </h3>
                {editingCapacity ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveCapacity()}
                      disabled={saveLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {saveLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {saveLoading ? "Saving..." : "Save to DB"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCapacity(false)}
                      disabled={saveLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Update Capacity
                  </button>
                )}
              </div>

              {editingCapacity ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Available Beds
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={capacity.totalBeds}
                      value={editBeds}
                      onChange={(e) => setEditBeds(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <p className="mt-1 text-[10px] text-slate-600">
                      Max: {capacity.totalBeds}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Available ICU
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={capacity.icuCapacity}
                      value={editIcu}
                      onChange={(e) => setEditIcu(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <p className="mt-1 text-[10px] text-slate-600">
                      Max: {capacity.icuCapacity}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <p className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-400">
                      Staff: {capacity.staffCount}
                      <span className="text-xs text-slate-600 ml-2">(admin-editable)</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Click &quot;Update Capacity&quot; to quickly adjust available beds and ICU beds.
                  Changes are saved directly to MongoDB and visible to ambulance dispatchers instantly.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Loading capacity */}
        {capacityLoading && !capacity && (
          <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
            Loading hospital data...
          </div>
        )}

        {capacityError && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{capacityError}</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ LIVE QUEUE TAB ═══ */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === "live" && (
          <>
            {/* Stats */}
            <section className="mb-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-200">RED (Critical)</p>
                <p className="mt-2 text-3xl font-black text-red-400">
                  {stats.red}
                </p>
              </div>
              <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm text-yellow-200">YELLOW (Urgent)</p>
                <p className="mt-2 text-3xl font-black text-yellow-400">
                  {stats.yellow}
                </p>
              </div>
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-200">GREEN (Stable)</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">
                  {stats.green}
                </p>
              </div>
              <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-sm text-blue-200">ARRIVED</p>
                <p className="mt-2 text-3xl font-black text-blue-400">
                  {stats.arrived}
                </p>
              </div>
            </section>

            {/* Error */}
            {pollingError && (
              <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Unable to load the emergency queue right now.</span>
                </div>
              </div>
            )}

            {/* Emergency Queue */}
            {loading && activeRecords.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                Loading emergency queue...
              </div>
            ) : activeRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <Siren className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">
                  No active incoming emergencies
                </p>
                <p className="mt-2 text-sm">
                  The queue will update automatically when a new case is dispatched.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {activeRecords.map((record) => {
                  const patientCoordinates =
                    record.patientCoordinates?.coordinates;
                  const lat = patientCoordinates ? patientCoordinates[1] : null;
                  const lng = patientCoordinates ? patientCoordinates[0] : null;

                  return (
                    <article
                      key={record._id}
                      className={`rounded-3xl border p-6 shadow-xl shadow-slate-950/20 ${
                        record.priority === "RED"
                          ? "border-red-500/30 bg-red-500/5"
                          : record.priority === "YELLOW"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-emerald-500/30 bg-emerald-500/5"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                                record.priority === "RED"
                                  ? "bg-red-500/20 text-red-300"
                                  : record.priority === "YELLOW"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {record.priority ?? "GREEN"}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                              <Clock3 className="h-3.5 w-3.5" />
                              {record.status ?? "PENDING"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">
                              ETA: {calculateETA(record.createdAt)}
                            </span>
                            {record.severityScore && (
                              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">
                                Score: {record.severityScore}/10
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Patient &amp; Condition
                            </p>
                            <h2 className="mt-2 text-xl font-bold text-white">
                              {record.patientName || "Unknown Patient"}
                            </h2>
                            <p className="text-sm text-slate-300">
                              {record.symptoms?.join(", ") || "Emergency case"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Dispatch ID
                          </p>
                          <p className="mt-2 font-semibold text-white">
                            {record.emergencyId}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Truck className="h-4 w-4" />
                            <span className="text-xs uppercase tracking-[0.2em]">
                              Ambulance
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-white">
                            {record.assignedAmbulanceVehicle || "Unassigned"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs uppercase tracking-[0.2em]">
                              Coordinates
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-white">
                            {lat !== null && lng !== null
                              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                              : "Unavailable"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Activity className="h-4 w-4" />
                            <span className="text-xs uppercase tracking-[0.2em]">
                              Vitals
                            </span>
                          </div>
                          <div className="mt-3 space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Heart className="h-3 w-3 text-red-400" />
                              <span className="text-white">
                                {record.vitals?.heartRate
                                  ? `${record.vitals.heartRate} bpm`
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-3 w-3 text-blue-400" />
                              <span className="text-white">
                                SpO₂{" "}
                                {record.vitals?.spo2
                                  ? `${record.vitals.spo2}%`
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Stethoscope className="h-4 w-4" />
                            <span className="text-xs uppercase tracking-[0.2em]">
                              Symptoms
                            </span>
                          </div>
                          <ul className="mt-3 space-y-1 text-sm text-slate-200">
                            {(record.symptoms ?? []).map((symptom) => (
                              <li key={symptom}>• {symptom}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ DAILY LOGS / HISTORY TAB ═══ */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <>
            {/* ─── Date Picker Bar ─── */}
            <section className="mb-6 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Date-Wise Logs
                    </h2>
                    <p className="text-xs text-slate-400">
                      View emergencies and admissions for any specific day
                    </p>
                  </div>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateDate(-1)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    title="Previous day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateDate(1)}
                    disabled={isToday}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {!isToday && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDate(
                          new Date().toISOString().split("T")[0]
                        )
                      }
                      className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Date Display */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-white">
                  {formatDateDisplay(selectedDate)}
                </p>

                {/* Status Filter Chips */}
                <div className="flex gap-2 ml-auto">
                  {[
                    { value: "all", label: "All" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "ARRIVED", label: "Arrived" },
                    { value: "EN_ROUTE", label: "En Route" },
                    { value: "ASSIGNED", label: "Assigned" },
                    { value: "PENDING", label: "Pending" },
                  ].map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setHistoryFilter(chip.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        historyFilter === chip.value
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ─── Daily Summary Stats ─── */}
            {historySummary && (
              <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Cases
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {historySummary.total}
                  </p>
                </div>
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
                    RED
                  </p>
                  <p className="mt-2 text-3xl font-black text-red-400">
                    {historySummary.red}
                  </p>
                </div>
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-yellow-300">
                    YELLOW
                  </p>
                  <p className="mt-2 text-3xl font-black text-yellow-400">
                    {historySummary.yellow}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    GREEN
                  </p>
                  <p className="mt-2 text-3xl font-black text-emerald-400">
                    {historySummary.green}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                    Completed
                  </p>
                  <p className="mt-2 text-3xl font-black text-blue-400">
                    {historySummary.completed}
                  </p>
                </div>
              </section>
            )}

            {/* ─── History Error ─── */}
            {historyError && (
              <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{historyError}</span>
                </div>
              </div>
            )}

            {/* ─── History Records ─── */}
            {historyLoading ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                Loading records for {selectedDate}...
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-400">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">
                  No records for this date
                </p>
                <p className="mt-2 text-sm">
                  No emergencies were logged on {formatDateDisplay(selectedDate)}.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyRecords.map((record) => (
                  <article
                    key={record._id}
                    className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/20 ${
                      record.status === "COMPLETED"
                        ? "border-slate-700 bg-slate-900/50"
                        : record.status === "ARRIVED"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : record.priority === "RED"
                        ? "border-red-500/30 bg-red-500/5"
                        : record.priority === "YELLOW"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-emerald-500/30 bg-emerald-500/5"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                              record.priority === "RED"
                                ? "bg-red-500/20 text-red-300"
                                : record.priority === "YELLOW"
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {record.priority ?? "GREEN"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
                              record.status === "COMPLETED"
                                ? "border-emerald-500/30 text-emerald-300"
                                : record.status === "ARRIVED"
                                ? "border-blue-500/30 text-blue-300"
                                : "border-slate-700 text-slate-300"
                            }`}
                          >
                            {record.status === "COMPLETED" && (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {record.status ?? "PENDING"}
                          </span>
                          {record.severityScore && (
                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">
                              Score: {record.severityScore}/10
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {record.patientName || "Unknown Patient"}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {record.symptoms?.join(", ") || "Emergency case"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Dispatch ID
                          </p>
                          <p className="mt-1 font-semibold text-white">
                            {record.emergencyId}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Ambulance
                          </p>
                          <p className="mt-1 font-semibold text-white">
                            {record.assignedAmbulanceVehicle || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-400">Created:</span>
                        <span className="text-slate-300">
                          {formatTimestamp(record.createdAt)}
                        </span>
                      </div>
                      {record.dispatchedAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-slate-400">Dispatched:</span>
                          <span className="text-slate-300">
                            {formatTimestamp(record.dispatchedAt)}
                          </span>
                        </div>
                      )}
                      {record.pickedUpAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-slate-400">Picked Up:</span>
                          <span className="text-slate-300">
                            {formatTimestamp(record.pickedUpAt)}
                          </span>
                        </div>
                      )}
                      {record.arrivedAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-blue-400">Arrived:</span>
                          <span className="text-blue-300">
                            {formatTimestamp(record.arrivedAt)}
                          </span>
                        </div>
                      )}
                      {record.completedAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-emerald-400">Completed:</span>
                          <span className="text-emerald-300">
                            {formatTimestamp(record.completedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
