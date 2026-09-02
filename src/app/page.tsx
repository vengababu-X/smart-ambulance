"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Siren,
  Activity,
  Brain,
  Clock,
  X,
  Shield,
  Info,
  Phone,
  Truck,
  Timer,
  Ban,
  Zap,
  Heart,
  Stethoscope,
  ArrowRight,
  User,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading map...
      </div>
    </div>
  ),
});

type SymptomOption = { label: string; value: string };
const symptomOptions: SymptomOption[] = [
  { label: "Severe chest pain", value: "Severe chest pain" },
  { label: "Road accident / trauma", value: "Road accident / trauma" },
  { label: "Difficulty breathing", value: "Difficulty breathing" },
  { label: "Stroke symptoms", value: "Stroke symptoms" },
  { label: "Severe bleeding", value: "Severe bleeding" },
  { label: "Allergic reaction", value: "Allergic reaction" },
  { label: "Dizziness / fainting", value: "Dizziness / fainting" },
  { label: "Heart attack", value: "Heart attack" },
  { label: "Seizure", value: "Seizure" },
  { label: "Other (type below)", value: "OTHER" },
];

type QuickEmergencyOption = {
  id: string;
  label: string;
  sublabel: string;
  symptoms: string[];
  icon: typeof Heart;
  gradient: string;
  shadow: string;
  ring: string;
};
const quickEmergencyOptions: QuickEmergencyOption[] = [
  {
    id: "chest-pain",
    label: "Heart Attack / Chest Pain",
    sublabel: "Severe chest pain, pressure, or cardiac symptoms",
    symptoms: ["Severe chest pain", "Heart attack"],
    icon: Heart,
    gradient: "from-red-600 via-red-500 to-rose-600",
    shadow: "shadow-red-900/40",
    ring: "ring-red-500/30",
  },
  {
    id: "accident",
    label: "Accident / Severe Injury",
    sublabel: "Road accident, trauma, or major physical injury",
    symptoms: ["Road accident / trauma", "Severe bleeding"],
    icon: AlertTriangle,
    gradient: "from-orange-600 via-amber-500 to-yellow-600",
    shadow: "shadow-orange-900/40",
    ring: "ring-orange-500/30",
  },
  {
    id: "breathing",
    label: "Severe Breathing Trouble",
    sublabel: "Difficulty breathing, choking, or respiratory distress",
    symptoms: ["Difficulty breathing"],
    icon: Activity,
    gradient: "from-blue-600 via-blue-500 to-cyan-600",
    shadow: "shadow-blue-900/40",
    ring: "ring-blue-500/30",
  },
  {
    id: "unknown",
    label: "Emergency / Unknown",
    sublabel: "General emergency or unsure of the condition",
    symptoms: ["Emergency / Unknown condition"],
    icon: Siren,
    gradient: "from-purple-600 via-violet-500 to-fuchsia-600",
    shadow: "shadow-purple-900/40",
    ring: "ring-purple-500/30",
  },
];

interface Coordinates { lat: number; lng: number }
interface DispatchResponse {
  success: boolean; message?: string;
  emergency?: { emergencyId: string; priority: string; status: string; assignedAmbulanceVehicle: string; destinationHospitalName: string; createdAt: string; dispatchedAt?: string; };
  ambulance?: { vehicleNumber: string; driverName: string; driverPhone?: string; location?: { coordinates?: [number, number] }; };
  hospital?: { name: string }; error?: string;
}
interface AIResponse { success: boolean; score?: number; category?: string; notes?: string; source?: string; error?: string }
interface AIGuideResponse { success: boolean; instructions?: string[]; calmingMessage?: string; checklist?: string[]; source?: string; error?: string }
interface AmbulanceRecord { _id: string; vehicleNumber: string; location?: { coordinates?: [number, number] }; status?: string }

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180; const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180; const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function formatStopwatch(ms: number): string {
  const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════
// LANDING PAGE COMPONENT (unauthenticated)
// ═══════════════════════════════════════════════════════
function LandingPage() {
  const router = useRouter();
  const [counters, setCounters] = useState({ response: 0, lives: 0, triage: 0, tracking: 0 });

  useEffect(() => {
    const targets = { response: 3, lives: 2847, triage: 24, tracking: 100 };
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounters({
        response: Math.round(targets.response * ease),
        lives: Math.round(targets.lives * ease),
        triage: Math.round(targets.triage * ease),
        tracking: Math.round(targets.tracking * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm text-red-300">
            <Zap className="h-4 w-4" />
            AI-Powered Emergency Response
          </div>
          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            Smart Ambulance
            <span className="block bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              AI & Emergency Response
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
            Rapid spatial dispatch meets AI clinical triage. One-touch SOS connects you
            to the nearest available ambulance in seconds — with real-time GPS tracking
            and AI-powered first-aid guidance while you wait.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => router.push("/login")} className="flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-red-900/30 transition hover:shadow-red-700/40 hover:scale-[1.02]">
              <Siren className="h-5 w-5" />
              Request Emergency SOS
              <ArrowRight className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => router.push("/login")} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-8 py-4 text-lg font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">
              <User className="h-5 w-5" />
              Staff Login
            </button>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="border-y border-slate-800/50 bg-slate-900/30 px-6 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: `${counters.response}-Min`, label: "Avg Response Time", color: "text-red-400" },
            { value: counters.lives.toLocaleString(), label: "Lives Saved", color: "text-emerald-400" },
            { value: `${counters.triage}/7`, label: "AI Triage Active", color: "text-blue-400" },
            { value: `${counters.tracking}%`, label: "Real-Time GPS Tracking", color: "text-amber-400" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="mt-2 text-sm text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">How It Works</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Three-Step Emergency Response</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: Siren, title: "One-Touch SOS", desc: "Tap the emergency button, select your symptoms, and our AI instantly assesses severity and dispatches the nearest ambulance.", color: "red" },
              { icon: Brain, title: "AI Clinical Triage", desc: "Powered by Llama 3 AI, our system scores your condition 1-10 and generates real-time first-aid guidance while you wait.", color: "blue" },
              { icon: Activity, title: "Live Tracking & Dispatch", desc: "Track your ambulance in real-time on an interactive map. Hospital ER queues receive priority-sorted incoming cases automatically.", color: "emerald" },
            ].map((feature) => (
              <div key={feature.title} className={`rounded-3xl border border-${feature.color}-500/20 bg-${feature.color}-500/5 p-8 transition hover:border-${feature.color}-500/40`}>
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-${feature.color}-500/10 text-${feature.color}-400`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-400">Platform Features</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Built for Emergency Response</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: "3-Tier Dispatch Fallback", desc: "Spatial query → any available → emergency override. An ambulance is always dispatched." },
              { icon: Heart, title: "Real-Time Vitals", desc: "Simulated patient telemetry with heart rate and SpO₂ monitoring during transport." },
              { icon: MapPin, title: "Geofence Detection", desc: "Automatic status updates when the ambulance enters the patient's proximity zone." },
              { icon: Stethoscope, title: "Hospital ER Queue", desc: "Priority-sorted incoming cases with bed capacity tracking and handover workflows." },
              { icon: Shield, title: "Role-Based Access", desc: "Strict portal isolation: patients, drivers, hospital staff, and admins see only their view." },
              { icon: Clock, title: "3-Second Safety Countdown", desc: "False-alarm protection with a cancelable countdown before dispatch triggers." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700">
                <f.icon className="h-5 w-5 text-blue-400" />
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Siren className="h-4 w-4 text-red-400" />
            Smart Ambulance — AI-Enabled Emergency Response System
          </div>
          <p className="text-xs text-slate-600">Built with Next.js 14, MongoDB, Leaflet.js &amp; Ollama AI</p>
        </div>
      </footer>
    </main>
  );
}

// ═══════════════════════════════════════════════════════
// PATIENT SOS PORTAL (authenticated patient)
// ═══════════════════════════════════════════════════════
function SOSPortal() {
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const [selectedSymptom, setSelectedSymptom] = useState(symptomOptions[0].value);
  const [customSymptom, setCustomSymptom] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [patientLocation, setPatientLocation] = useState<Coordinates | null>(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState<Coordinates | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchResponse | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const executeDispatchRef = useRef<(() => Promise<void>) | null>(null);
  const [dispatchStartTime, setDispatchStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const stopwatchRef = useRef<NodeJS.Timeout | null>(null);
  const [showAIGuide, setShowAIGuide] = useState(false);
  const [aiGuide, setAIGuide] = useState<AIGuideResponse | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [activeQuickOption, setActiveQuickOption] = useState<string | null>(null);

  useEffect(() => {
    if (sessionUser && !nameInitialized) {
      if (sessionUser.name) setPatientName(sessionUser.name);
      if (sessionUser.phone) setPatientPhone(sessionUser.phone);
      setNameInitialized(true);
    }
  }, [sessionUser, nameInitialized]);

  useEffect(() => { return () => { if (countdownRef.current) clearInterval(countdownRef.current); if (stopwatchRef.current) clearInterval(stopwatchRef.current); }; }, []);
  useEffect(() => { if (dispatchStartTime) { stopwatchRef.current = setInterval(() => setElapsedMs(Date.now() - dispatchStartTime), 1000); return () => { if (stopwatchRef.current) clearInterval(stopwatchRef.current); }; } }, [dispatchStartTime]);

  const patientCoordinateText = useMemo(() => !patientLocation ? "Waiting for GPS" : `${patientLocation.lat.toFixed(5)}, ${patientLocation.lng.toFixed(5)}`, [patientLocation]);
  const effectiveSymptoms = useMemo(() => selectedSymptom === "OTHER" && customSymptom.trim() ? [customSymptom.trim()] : [selectedSymptom], [selectedSymptom, customSymptom]);

  const fetchAmbulanceLocation = useCallback(async () => {
    if (!dispatchData?.ambulance?.vehicleNumber) return null;
    try { const r = await fetch("/api/ambulances", { cache: "no-store" }); if (!r.ok) return null; const d = await r.json(); const a: AmbulanceRecord[] = d.ambulances ?? []; const m = a.find((x) => x.vehicleNumber === dispatchData.ambulance?.vehicleNumber); if (m?.location?.coordinates) { const [lng, lat] = m.location.coordinates; setAmbulanceLocation({ lat, lng }); } } catch { /* */ } return null;
  }, [dispatchData?.ambulance?.vehicleNumber]);
  usePolling(useCallback(async () => { if (!dispatchData) return null; return fetchAmbulanceLocation(); }, [dispatchData, fetchAmbulanceLocation]), dispatchData ? 3000 : 999999);

  const { liveETA, liveDistance } = useMemo(() => {
    if (!patientLocation || !ambulanceLocation) return { liveETA: null, liveDistance: null };
    const d = haversineDistance(ambulanceLocation, patientLocation); const km = (d / 1000).toFixed(1); const min = Math.ceil((d / 1000 / 30) * 60);
    return { liveETA: min <= 1 ? "Arriving now" : `~${min} min`, liveDistance: `${km} km` };
  }, [patientLocation, ambulanceLocation]);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) { setErrorMessage("Geolocation is not supported."); return; }
    setIsGettingLocation(true); setErrorMessage(""); setStatusMessage("Acquiring GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPatientLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setIsGettingLocation(false); setStatusMessage("GPS acquired."); },
      (e) => { setIsGettingLocation(false); setErrorMessage(e.code === 1 ? "Location permission denied." : "Unable to read location."); setStatusMessage(""); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  const resolvedPatientName = useMemo(() => sessionUser?.name?.trim() || patientName.trim() || "Unknown Patient", [sessionUser?.name, patientName]);
  const resolvedPatientContact = useMemo(() => sessionUser?.phone?.trim() || patientPhone.trim() || "0000000000", [sessionUser?.phone, patientPhone]);

  const startCountdown = useCallback(() => {
    if (!patientLocation) { getCurrentLocation(); setErrorMessage("Please allow GPS access before sending an SOS request."); return; }
    setErrorMessage(""); setCountdown(3);
    countdownRef.current = setInterval(() => { setCountdown((prev) => { if (prev === null || prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); setTimeout(() => executeDispatchRef.current?.(), 0); return null; } return prev - 1; }); }, 1000);
  }, [patientLocation, getCurrentLocation]);
  const cancelCountdown = useCallback(() => { if (countdownRef.current) clearInterval(countdownRef.current); setCountdown(null); setStatusMessage("SOS cancelled."); }, []);

  const executeDispatch = useCallback(async (overrideSymptoms?: string[]) => {
    if (!patientLocation) return;
    const symptomsToUse = overrideSymptoms || effectiveSymptoms;
    setIsDispatching(true); setIsSuccess(false); setErrorMessage(""); setStatusMessage("Running AI triage assessment..."); setAiResponse(null); setDispatchData(null);
    try {
      const ai = await (await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptoms: symptomsToUse }) })).json() as AIResponse;
      setAiResponse(ai);
      setStatusMessage("Dispatching EMS...");
      const sos = await (await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: patientLocation.lat, longitude: patientLocation.lng, symptoms: symptomsToUse, severityScore: ai.score || 5, patientName: resolvedPatientName, patientContact: resolvedPatientContact, aiTriageNotes: ai.notes || "" }) })).json() as DispatchResponse;
      if (!sos.success || !sos.ambulance) throw new Error(sos.error || sos.message || "Dispatch failed.");
      setDispatchData(sos);
      if (sos.ambulance?.location?.coordinates) { const [lng, lat] = sos.ambulance.location.coordinates; setAmbulanceLocation({ lat, lng }); }
      setDispatchStartTime(sos.emergency?.dispatchedAt ? new Date(sos.emergency.dispatchedAt).getTime() : Date.now());
      setStatusMessage("Emergency dispatched!"); setIsSuccess(true);
    } catch (e) { setErrorMessage(e instanceof Error ? e.message : "Something went wrong."); setStatusMessage(""); setIsSuccess(false); }
    finally { setIsDispatching(false); }
  }, [patientLocation, effectiveSymptoms, resolvedPatientName, resolvedPatientContact]);
  executeDispatchRef.current = executeDispatch;

  // ═══ 1-Click Quick Emergency handler ═══
  const handleQuickEmergency = useCallback(
    async (option: QuickEmergencyOption) => {
      // Ensure GPS is available
      if (!patientLocation) {
        getCurrentLocation();
        setErrorMessage(
          "Acquiring GPS location. Please wait a moment and try again."
        );
        return;
      }
      setActiveQuickOption(option.id);
      setErrorMessage("");
      setStatusMessage(
        `Dispatching for: ${option.symptoms[0]}...`
      );
      // Trigger dispatch instantly with preset symptoms — no countdown
      await executeDispatch(option.symptoms);
      // Reset quick option state after dispatch completes
      setActiveQuickOption(null);
    },
    [patientLocation, getCurrentLocation, executeDispatch]
  );

  const fetchAIGuide = useCallback(async () => {
    setIsLoadingGuide(true); setAIGuide(null); setShowAIGuide(true);
    try { setAIGuide(await (await fetch("/api/ai/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptoms: effectiveSymptoms, patientName: resolvedPatientName, priority: aiResponse?.category || "URGENT" }) })).json()); }
    catch { setAIGuide({ success: false, error: "Failed to load AI guidance." }); }
    finally { setIsLoadingGuide(false); }
  }, [effectiveSymptoms, resolvedPatientName, aiResponse?.category]);

  useEffect(() => { if (navigator.geolocation) getCurrentLocation(); }, [getCurrentLocation]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/30"><Siren className="h-7 w-7" /></div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Emergency Response</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Smart Ambulance SOS</h1>
              {sessionUser && <p className="mt-1 text-xs text-slate-500">Logged in as <span className="text-slate-300">{sessionUser.name}</span> ({sessionUser.email})</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300"><Navigation className="h-4 w-4" /> GPS Live</div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            {/* GPS */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-red-400" /><h2 className="text-lg font-semibold">Patient GPS</h2></div>
                <button type="button" onClick={getCurrentLocation} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700">{isGettingLocation ? "Locating..." : "Refresh GPS"}</button>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                <p className="text-slate-400">Current coordinates</p>
                <p className="mt-2 text-lg font-semibold text-white">{patientCoordinateText}</p>
              </div>
            </div>

            {/* Patient Info */}
            {!isSuccess && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Patient Details</h2>
                  {sessionUser && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Auto-filled from account</span>}
                </div>
                <div className="space-y-3">
                  <div><input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500" />
                    {sessionUser?.name && patientName === sessionUser.name && <p className="mt-1.5 text-xs text-emerald-400">✓ Using your account name: {sessionUser.name}</p>}
                  </div>
                  <div><input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Contact number" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500" />
                    {sessionUser?.phone && patientPhone === sessionUser.phone && <p className="mt-1.5 text-xs text-emerald-400">✓ Using your account phone</p>}
                  </div>
                </div>
              </div>
            )}

            {/* SOS */}
            {!isSuccess && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                <h2 className="mb-2 text-lg font-semibold">Emergency Dispatch</h2>
                <div className="space-y-4">
                  {/* ═══ 1-Click Quick Emergency ═══ */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <p className="text-sm font-bold uppercase tracking-wider text-amber-300">
                        1-Click Quick Emergency
                      </p>
                    </div>
                    <p className="mb-4 text-xs text-slate-400">
                      Tap a button below for instant dispatch — no typing needed.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {quickEmergencyOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = activeQuickOption === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleQuickEmergency(option)}
                            disabled={isDispatching || isGettingLocation || !!activeQuickOption}
                            className={`group relative flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                              isActive
                                ? `border-white/40 bg-gradient-to-br ${option.gradient} text-white scale-[1.02] shadow-lg ${option.shadow}`
                                : `border-slate-700 bg-slate-950/80 hover:border-slate-500 hover:bg-slate-800/80`
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-800 text-slate-300 group-hover:bg-slate-700"
                            }`}>
                              {isDispatching && isActive ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <p className={`text-sm font-bold leading-tight ${
                              isActive ? "text-white" : "text-slate-200"
                            }`}>
                              {option.label}
                            </p>
                            <p className={`mt-1 text-[11px] leading-snug ${
                              isActive ? "text-white/70" : "text-slate-500"
                            }`}>
                              {option.sublabel}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ═══ Divider ═══ */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-700" />
                    <span className="text-xs font-medium text-slate-500">or describe manually</span>
                    <div className="h-px flex-1 bg-slate-700" />
                  </div>

                  {/* ═══ Other / Custom Condition ═══ */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Other / Custom Condition
                    </label>
                    <input
                      value={customSymptom}
                      onChange={(e) => {
                        setCustomSymptom(e.target.value);
                        setSelectedSymptom("OTHER");
                        setActiveQuickOption(null);
                      }}
                      placeholder="Describe your symptoms..."
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-red-500"
                    />
                  </div>

                  {countdown !== null ? (
                    <div className="space-y-3">
                      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-red-500 bg-red-500/10 p-8">
                        <p className="text-sm font-bold uppercase tracking-wider text-red-300">Emergency triggering in</p>
                        <div className="text-7xl font-black text-red-400 tabular-nums">{countdown}</div>
                        <div className="flex gap-2">{[3, 2, 1].map((n) => <div key={n} className={`h-3 w-16 rounded-full transition-all duration-300 ${countdown >= n ? "bg-red-500" : "bg-slate-700"}`} />)}</div>
                      </div>
                      <button type="button" onClick={cancelCountdown} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-600 bg-slate-800 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-slate-300 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"><Ban className="h-5 w-5" /> Cancel SOS</button>
                    </div>
                  ) : (
                    <button type="button" onClick={startCountdown} disabled={isGettingLocation || isDispatching} className="flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-6 py-5 text-xl font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-900/50 transition hover:scale-[1.01] hover:shadow-red-700/40 disabled:cursor-not-allowed disabled:opacity-60">
                      {isDispatching ? <><Loader2 className="h-6 w-6 animate-spin" /> Dispatching...</> : <><Siren className="h-6 w-6" /> SOS Emergency</>}
                    </button>
                  )}

                  {(statusMessage || errorMessage) && !countdown && (
                    <div className={`rounded-2xl border p-4 text-sm ${errorMessage ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
                      <div className="flex items-center gap-2">{errorMessage ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<span>{errorMessage || statusMessage}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active Tracking */}
            {isSuccess && dispatchData?.emergency && (
              <>
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-5 shadow-xl shadow-blue-900/10">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3"><Activity className="h-5 w-5 text-blue-400" /><div><p className="text-sm text-blue-200">Emergency Active</p><p className="text-lg font-bold text-white">{dispatchData.emergency.emergencyId}</p></div></div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Dispatched</span>
                  </div>
                  <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center gap-2 mb-3"><Truck className="h-4 w-4 text-emerald-400" /><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Ambulance</span></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-slate-500">Vehicle ID</p><p className="mt-1 text-lg font-black text-white">{dispatchData.emergency.assignedAmbulanceVehicle}</p></div>
                      <div><p className="text-xs text-slate-500">Driver</p><p className="mt-1 font-bold text-white">{dispatchData.ambulance?.driverName || "Assigned"}</p></div>
                    </div>
                    {dispatchData.ambulance?.driverPhone && <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-800/50 px-3 py-2"><Phone className="h-3.5 w-3.5 text-blue-400" /><span className="text-sm text-slate-200">{dispatchData.ambulance.driverPhone}</span></div>}
                  {/* Manual Call Button */}
                  <div className="mt-3">
                    <a
                      href={`tel:${dispatchData.ambulance?.driverPhone || "+919876543210"}`}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition hover:from-green-500 hover:to-green-400 hover:shadow-green-700/40"
                    >
                      <Phone className="h-4 w-4" />
                      Call Emergency Driver Now
                    </a>
                  </div>
                  </div>
                  <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Destination Hospital</p><p className="mt-1 font-bold text-white">{dispatchData.emergency.destinationHospitalName || "Routing to nearest facility"}</p></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3"><div className="flex items-center gap-2"><Timer className="h-4 w-4 text-emerald-400" /><span className="text-xs font-medium text-emerald-300">Elapsed</span></div><p className="mt-1 text-xl font-black text-emerald-300 tabular-nums">{formatStopwatch(elapsedMs)}</p></div>
                    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" /><span className="text-xs font-medium text-blue-300">ETA</span></div><p className="mt-1 text-xl font-black text-blue-300">{liveETA || "—"}</p></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="text-xs font-medium text-slate-400">Distance</span></div><p className="mt-1 text-xl font-black text-white">{liveDistance || "—"}</p></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Clock className="h-3 w-3" /> Dispatched at {new Date(dispatchData.emergency.createdAt).toLocaleTimeString()}</div>
                </div>
                <button type="button" onClick={fetchAIGuide} disabled={isLoadingGuide} className="flex w-full items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 px-6 py-4 text-base font-bold text-blue-300 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:opacity-60">
                  {isLoadingGuide ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating first-aid guidance...</> : <><Brain className="h-5 w-5" /> 🤖 Ask AI: What Should I Do While Waiting?</>}
                </button>
              </>
            )}
          </section>

          <aside><div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30"><h2 className="mb-3 text-lg font-semibold">Emergency Map</h2><LiveMap patientLocation={patientLocation} ambulanceLocation={ambulanceLocation} /></div></aside>
        </div>

        {aiResponse && (
          <section className="mt-8 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><Brain className="h-5 w-5 text-blue-400" /><h2 className="text-lg font-semibold text-blue-200">AI Triage Assessment</h2></div>
              <div className="flex items-center gap-3">
                {aiResponse.source && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{aiResponse.source === "ollama" ? "Llama 3 AI" : "Rule-Based Triage"}</span>}
                {aiResponse.category && <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ${aiResponse.category === "CRITICAL" ? "bg-red-500/20 text-red-300" : aiResponse.category === "URGENT" ? "bg-yellow-500/20 text-yellow-300" : "bg-emerald-500/20 text-emerald-300"}`}>{aiResponse.category}</span>}
                {aiResponse.score && <span className="rounded-full bg-slate-800 px-3 py-1.5 text-sm font-bold text-white">Severity: {aiResponse.score}/10</span>}
              </div>
            </div>
            {aiResponse.notes && <div className="rounded-2xl border border-blue-400/20 bg-slate-900/40 p-4 text-sm leading-6 text-slate-100"><p>{aiResponse.notes}</p></div>}
            {aiResponse.error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{aiResponse.error}</div>}
          </section>
        )}

        {showAIGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Shield className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-white">AI Emergency Guide</h2><p className="text-xs text-slate-400">First-aid instructions while you wait</p></div></div>
                <button type="button" onClick={() => setShowAIGuide(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              {isLoadingGuide && <div className="flex flex-col items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /><p className="mt-4 text-sm text-slate-400">Generating personalized first-aid guidance...</p></div>}
              {aiGuide?.error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span>{aiGuide.error}</span></div></div>}
              {aiGuide?.success && !isLoadingGuide && (
                <div className="space-y-6">
                  {aiGuide.calmingMessage && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" /><p className="text-sm font-medium text-emerald-200 leading-relaxed">{aiGuide.calmingMessage}</p></div></div>}
                  {aiGuide.instructions && aiGuide.instructions.length > 0 && <div><h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-300"><Activity className="h-4 w-4" /> First-Aid Steps</h3><div className="space-y-2">{aiGuide.instructions.map((inst, i) => <div key={i} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">{i + 1}</span><p className="text-sm text-slate-200 leading-relaxed">{inst}</p></div>)}</div></div>}
                  {aiGuide.checklist && aiGuide.checklist.length > 0 && <div><h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-300"><CheckCircle2 className="h-4 w-4" /> Preparation Checklist</h3><div className="space-y-2">{aiGuide.checklist.map((item, i) => <div key={i} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-slate-600" /><p className="text-sm text-slate-200">{item}</p></div>)}</div></div>}
                  <div className="flex items-center justify-center gap-2 pt-2"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{aiGuide.source === "ollama" ? "Powered by Llama 3" : "Rule-Based Emergency Guide"}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">For informational purposes only</span></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE — routes based on auth state
// ═══════════════════════════════════════════════════════
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect non-patient authenticated users to their portal
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = session.user.role;
      if (role === "admin") router.replace("/admin");
      else if (role === "driver") router.replace(session.user.vehicleNumber ? `/driver/${session.user.vehicleNumber}` : "/profile");
      else if (role === "hospital") router.replace(session.user.hospitalId ? `/hospital/${session.user.hospitalId}` : "/profile");
      // patient stays on /
    }
  }, [status, session, router]);

  // Loading state
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-400" />
      </main>
    );
  }

  // Unauthenticated → Landing page
  if (status === "unauthenticated" || !session) {
    return <LandingPage />;
  }

  // Authenticated patient → SOS Portal
  const role = session.user?.role;
  if (role === "patient" || !role) {
    return <SOSPortal />;
  }

  // Other roles are being redirected by useEffect above — show loader
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <p className="text-sm text-slate-400">Redirecting to your portal...</p>
      </div>
    </main>
  );
}
