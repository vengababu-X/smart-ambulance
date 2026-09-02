"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Activity,
  Heart,
  CheckCircle2,
  Navigation,
  Siren,
  Truck,
  Stethoscope,
  MapPin,
  Phone,
  Timer,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";

const DriverMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300">
      <Activity className="h-5 w-5 animate-spin" />
      Loading map...
    </div>
  ),
});

interface Coordinates {
  lat: number;
  lng: number;
}

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
  destinationHospitalName?: string;
  dispatchedAt?: string;
  vitals?: {
    heartRate: number | null;
    spo2: number | null;
  };
}

interface VitalsData {
  heartRate: number;
  spo2: number;
  timestamp: string;
}

type GeofenceStatus = "DISPATCHED" | "EN_ROUTE" | "ARRIVED" | "COMPLETED";

function simulateVitals(priority?: string): VitalsData {
  const baseHR = priority === "RED" ? 110 : priority === "YELLOW" ? 90 : 75;
  const baseSpO2 =
    priority === "RED" ? 88 : priority === "YELLOW" ? 93 : 97;

  return {
    heartRate: baseHR + Math.floor(Math.random() * 20 - 10),
    spo2: Math.min(
      100,
      Math.max(80, baseSpO2 + Math.floor(Math.random() * 6 - 3))
    ),
    timestamp: new Date().toLocaleTimeString(),
  };
}

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatStopwatch(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function DriverPage({
  params,
}: {
  params: { id: string };
}) {
  const vehicleNumber = params.id;
  const [isTracking, setIsTracking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready for dispatch.");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeEmergency, setActiveEmergency] =
    useState<EmergencyRecord | null>(null);
  const [patientCoordinates, setPatientCoordinates] =
    useState<Coordinates | null>(null);
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [geofenceStatus, setGeofenceStatus] =
    useState<GeofenceStatus>("DISPATCHED");
  const [eta, setEta] = useState<string>("Calculating...");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const vitalsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stopwatch state
  const [dispatchStartTime, setDispatchStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const stopwatchRef = useRef<NodeJS.Timeout | null>(null);

  // Live stopwatch timer
  useEffect(() => {
    if (dispatchStartTime) {
      stopwatchRef.current = setInterval(() => {
        setElapsedMs(Date.now() - dispatchStartTime);
      }, 1000);
      return () => {
        if (stopwatchRef.current) clearInterval(stopwatchRef.current);
      };
    }
  }, [dispatchStartTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, []);

  // Start stopwatch when emergency is found
  useEffect(() => {
    if (activeEmergency?.dispatchedAt && !dispatchStartTime) {
      setDispatchStartTime(new Date(activeEmergency.dispatchedAt).getTime());
    }
  }, [activeEmergency?.dispatchedAt, dispatchStartTime]);

  // Simulate vitals telemetry
  useEffect(() => {
    if (activeEmergency) {
      setVitals(simulateVitals(activeEmergency.priority));
      vitalsIntervalRef.current = setInterval(() => {
        setVitals(simulateVitals(activeEmergency.priority));
      }, 3000);
    }
    return () => {
      if (vitalsIntervalRef.current) {
        clearInterval(vitalsIntervalRef.current);
      }
    };
  }, [activeEmergency]);

  // Calculate ETA
  useEffect(() => {
    if (coordinates && patientCoordinates) {
      const distanceM = haversineDistance(coordinates, patientCoordinates);
      const distanceKm = distanceM / 1000;
      const avgSpeedKmh = 30;
      const minutes = Math.ceil((distanceKm / avgSpeedKmh) * 60);
      setEta(minutes <= 1 ? "Arriving now" : `~${minutes} min`);
    }
  }, [coordinates, patientCoordinates]);

  // Fetch assigned emergency (polling)
  const fetchEmergency = useCallback(async () => {
    if (!vehicleNumber) return [];
    try {
      const response = await fetch("/api/emergencies", { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      const emergencies: EmergencyRecord[] = data.emergencies ?? [];
      const match = emergencies.find(
        (item) =>
          item.assignedAmbulanceVehicle === vehicleNumber &&
          ["PENDING", "ASSIGNED", "EN_ROUTE"].includes(item.status ?? "")
      );
      if (match) {
        setActiveEmergency(match);
        if (match.patientCoordinates?.coordinates) {
          const [lng, lat] = match.patientCoordinates.coordinates;
          setPatientCoordinates({ lat, lng });
        }
        if (match.status === "PENDING" || match.status === "ASSIGNED") {
          setGeofenceStatus("DISPATCHED");
        }
      } else {
        setActiveEmergency(null);
        setPatientCoordinates(null);
      }
    } catch (error) {
      console.error("Failed to load emergency assignment:", error);
    }
    return [];
  }, [vehicleNumber]);

  usePolling(fetchEmergency, 5000);

  // Update emergency status
  const updateEmergencyStatus = useCallback(
    async (newStatus: string) => {
      if (!activeEmergency) return;

      setIsUpdatingStatus(true);
      try {
        const response = await fetch("/api/emergencies", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emergencyId: activeEmergency.emergencyId,
            status: newStatus,
          }),
        });

        if (response.ok) {
          setStatusMessage(
            newStatus === "EN_ROUTE"
              ? "Patient picked up. En route to hospital."
              : newStatus === "ARRIVED"
              ? "Arrived at hospital. Ready for handover."
              : `Status updated to ${newStatus}.`
          );
          if (newStatus === "ARRIVED") {
            setGeofenceStatus("ARRIVED");
            // Stop GPS tracking
            setIsTracking(false);
          }
          // Refresh emergency data
          await fetchEmergency();
        }
      } catch (error) {
        console.error("Failed to update status:", error);
        setErrorMessage("Failed to update status. Please try again.");
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [activeEmergency, fetchEmergency]
  );

  // Geofencing
  useEffect(() => {
    if (!coordinates || !patientCoordinates || !isTracking) return;
    const distanceM = haversineDistance(coordinates, patientCoordinates);

    if (distanceM < 200) {
      setGeofenceStatus("ARRIVED");
      setStatusMessage("Patient location reached. Proceeding to handover.");
    } else if (distanceM < 1000) {
      setGeofenceStatus("EN_ROUTE");
      setStatusMessage("Approaching patient location.");
    } else {
      setGeofenceStatus("DISPATCHED");
      setStatusMessage("En route to patient location.");
    }
  }, [coordinates, patientCoordinates, isTracking]);

  // GPS tracking
  useEffect(() => {
    if (!isTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported in this browser.");
      setIsTracking(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const nextCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoordinates(nextCoordinates);
        setErrorMessage("");

        // Update ambulance location on server
        try {
          await fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vehicleNumber,
              latitude: nextCoordinates.lat,
              longitude: nextCoordinates.lng,
            }),
          });
        } catch (error) {
          console.error("Location update failed:", error);
        }
      },
      (geoError) => {
        setErrorMessage(
          geoError.code === 1
            ? "Location permission denied. Please enable GPS access."
            : "Unable to track the ambulance live location."
        );
        setStatusMessage("Tracking paused.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 20000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [vehicleNumber, isTracking]);

  const geofenceColor = useMemo(() => {
    switch (geofenceStatus) {
      case "ARRIVED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "EN_ROUTE":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "COMPLETED":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default:
        return "bg-red-500/20 text-red-300 border-red-500/30";
    }
  }, [geofenceStatus]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                <Truck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">
                  Driver Terminal
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  {vehicleNumber}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTracking((current) => !current)}
              className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition ${
                isTracking
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30"
                  : "bg-red-500 text-white shadow-lg shadow-red-500/30"
              }`}
            >
              {isTracking ? "Stop Trip" : "Start GPS Tracking"}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Left Column — Status & Vitals */}
          <section className="space-y-5">
            {/* GPS Status */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Navigation className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">Live GPS Feed</h2>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Current Position
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {coordinates
                      ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
                      : "Waiting for GPS..."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </p>
                  <p className="mt-2 text-white">{statusMessage}</p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${geofenceColor}`}
                    >
                      {geofenceStatus}
                    </span>
                  </div>
                </div>

                {/* Live Stopwatch */}
                {dispatchStartTime && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-emerald-400" />
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                        Time En Route
                      </p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-emerald-300 tabular-nums">
                      {formatStopwatch(elapsedMs)}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    ETA to Patient
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">{eta}</p>
                </div>
              </div>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Active Emergency */}
            {activeEmergency ? (
              <div
                className={`rounded-3xl border p-5 ${
                  activeEmergency.priority === "RED"
                    ? "border-red-500/30 bg-red-500/5"
                    : activeEmergency.priority === "YELLOW"
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Siren className="h-5 w-5 text-red-400" />
                  <h2 className="text-lg font-semibold">Active Emergency</h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${
                        activeEmergency.priority === "RED"
                          ? "bg-red-500/20 text-red-300"
                          : activeEmergency.priority === "YELLOW"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {activeEmergency.priority}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                      {activeEmergency.status}
                    </span>
                    {activeEmergency.severityScore && (
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">
                        Score: {activeEmergency.severityScore}/10
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Patient
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {activeEmergency.patientName || "Unknown"}
                    </p>
                    <p className="text-sm text-slate-300">
                      {activeEmergency.symptoms?.join(", ") || "Emergency"}
                    </p>
                  </div>

                  {activeEmergency.patientContact && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Phone className="h-3 w-3" />
                      {activeEmergency.patientContact}
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Destination Hospital
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {activeEmergency.destinationHospitalName || "TBD"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Emergency ID
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {activeEmergency.emergencyId}
                    </p>
                  </div>
                </div>

                {/* Status Update Buttons */}
                <div className="mt-5 space-y-3">
                  {activeEmergency.status === "ASSIGNED" && (
                    <button
                      type="button"
                      onClick={() => updateEmergencyStatus("EN_ROUTE")}
                      disabled={isUpdatingStatus}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-yellow-400 disabled:opacity-50"
                    >
                      {isUpdatingStatus ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      Patient Picked Up
                    </button>
                  )}

                  {(activeEmergency.status === "EN_ROUTE" ||
                    activeEmergency.status === "ASSIGNED") && (
                    <button
                      type="button"
                      onClick={() => updateEmergencyStatus("ARRIVED")}
                      disabled={isUpdatingStatus}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {isUpdatingStatus ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Arrived at ER
                    </button>
                  )}

                  {activeEmergency.status === "ARRIVED" && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-300">
                      <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                      <p className="font-semibold">Awaiting Hospital Handover</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center text-slate-400">
                <Truck className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-medium text-slate-300">
                  No active dispatch
                </p>
                <p className="mt-2 text-sm">
                  Waiting for an emergency assignment...
                </p>
              </div>
            )}

            {/* Vitals Telemetry */}
            {vitals && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="mb-4 text-lg font-semibold">
                  Patient Vitals (Simulated)
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                    <Heart className="mx-auto mb-1 h-4 w-4 text-red-400" />
                    <p className="text-xs text-slate-400">Heart Rate</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {vitals.heartRate} bpm
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                    <Stethoscope className="mx-auto mb-1 h-4 w-4 text-blue-400" />
                    <p className="text-xs text-slate-400">SpO₂</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {vitals.spo2}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                    <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-emerald-400" />
                    <p className="text-xs text-slate-400">Updated</p>
                    <p className="mt-1 text-xs font-bold text-white">
                      {vitals.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right Column — Map */}
          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
              <h2 className="mb-3 text-lg font-semibold">Live Navigation</h2>
              <DriverMap
                patientLocation={patientCoordinates}
                ambulanceLocation={coordinates}
                center={
                  coordinates ??
                  patientCoordinates ?? { lat: 17.6868, lng: 83.2185 }
                }
                zoom={14}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
