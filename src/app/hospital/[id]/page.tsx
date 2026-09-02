"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Heart,
  Loader2,
  MapPin,
  Siren,
  Stethoscope,
  Truck,
  Activity,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";

interface EmergencyRecord {
  _id: string;
  emergencyId: string;
  patientName?: string;
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
  createdAt?: string;
}



const priorityOrder: Record<string, number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
};

export default function HospitalQueuePage({
  params,
}: {
  params: { id: string };
}) {
  const [successMessage] = useState("");

  const fetchEmergencies = useCallback(async () => {
    const response = await fetch("/api/emergencies", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load active emergencies.");
    const data = await response.json();
    const emergencies: EmergencyRecord[] = Array.isArray(data.emergencies)
      ? data.emergencies
      : [];
    return emergencies.filter(
      (item) => item.status && !["COMPLETED"].includes(item.status)
    );
  }, []);

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

  const calculateETA = (createdAt?: string): string => {
    if (!createdAt) return "—";
    const elapsed = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 60000
    );
    if (elapsed < 1) return "< 1 min";
    if (elapsed < 5) return `${elapsed} min`;
    return `${elapsed} min ago`;
  };

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
                  Hospital ER Queue
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  Incoming Emergencies
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Hospital ID: {params.id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void refreshQueue()}
              className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
            >
              Refresh queue
            </button>
          </div>
        </header>

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

        {/* Success */}
        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

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
                    {/* Ambulance */}
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

                    {/* Coordinates */}
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

                    {/* Vitals */}
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

                    {/* Symptoms */}
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
      </div>
    </main>
  );
}
