"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// ═══ Default center: Kavali, Andhra Pradesh, India ═══
const KAVALI_CENTER: Coordinate = { lat: 14.9132, lng: 79.9929 };

interface Coordinate {
  lat: number;
  lng: number;
}

interface HospitalMarker {
  id: string;
  name: string;
  location: Coordinate;
  availableBeds?: number;
}

interface LiveMapProps {
  patientLocation?: Coordinate | null;
  ambulanceLocation?: Coordinate | null;
  hospitalLocation?: Coordinate | null;
  hospitalLocations?: HospitalMarker[];
  center?: Coordinate;
  zoom?: number;
  showRoute?: boolean;
}

// ═══ Custom icons ═══
const patientIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      border: 3px solid white;
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 800;
    ">P</div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const ambulanceIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #22c55e, #15803d);
      border: 3px solid white;
      box-shadow: 0 8px 24px rgba(34, 197, 94, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 800;
    ">A</div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const hospitalIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border: 3px solid white;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 800;
    ">H</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

// ═══ Map auto-pan controller ═══
// Dynamically pans the map when tracked locations update
function MapUpdater({
  patientLocation,
  ambulanceLocation,
  hospitalLocation,
}: {
  patientLocation?: Coordinate | null;
  ambulanceLocation?: Coordinate | null;
  hospitalLocation?: Coordinate | null;
}) {
  const map = useMap();
  const hasPannedRef = useRef(false);

  useEffect(() => {
    // On first location update, pan and zoom to fit all markers
    const locations: Coordinate[] = [];
    if (ambulanceLocation) locations.push(ambulanceLocation);
    if (patientLocation) locations.push(patientLocation);
    if (hospitalLocation) locations.push(hospitalLocation);

    if (locations.length === 0) return;

    if (locations.length === 1) {
      // Single marker: center on it
      map.flyTo([locations[0].lat, locations[0].lng], 14, {
        animate: true,
        duration: 1.0,
      });
    } else if (!hasPannedRef.current) {
      // Multiple markers on first load: fit bounds
      const bounds = L.latLngBounds(
        locations.map((loc) => [loc.lat, loc.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasPannedRef.current = true;
    } else {
      // Subsequent updates: gentle fly to ambulance (the moving marker)
      if (ambulanceLocation) {
        map.flyTo([ambulanceLocation.lat, ambulanceLocation.lng], map.getZoom(), {
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [map, patientLocation, ambulanceLocation, hospitalLocation]);

  return null;
}

export default function LiveMap({
  patientLocation,
  ambulanceLocation,
  hospitalLocation,
  hospitalLocations,
  center,
  zoom = 13,
  showRoute = false,
}: LiveMapProps) {
  // Default to Kavali, AP when no center or locations provided
  const mapCenter = center ?? patientLocation ?? ambulanceLocation ?? KAVALI_CENTER;

  // Build route polyline points: ambulance → patient → hospital
  const routePoints: [number, number][] = [];
  if (showRoute) {
    if (ambulanceLocation) {
      routePoints.push([ambulanceLocation.lat, ambulanceLocation.lng]);
    }
    if (patientLocation) {
      routePoints.push([patientLocation.lat, patientLocation.lng]);
    }
    if (hospitalLocation) {
      routePoints.push([hospitalLocation.lat, hospitalLocation.lng]);
    }
  }

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/50">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dynamic map pan controller */}
        <MapUpdater
          patientLocation={patientLocation}
          ambulanceLocation={ambulanceLocation}
          hospitalLocation={hospitalLocation}
        />

        {/* Route polyline: ambulance → patient → hospital */}
        {routePoints.length >= 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: "#3b82f6",
              weight: 4,
              opacity: 0.8,
              dashArray: "10, 8",
              lineCap: "round",
            }}
          />
        )}

        {patientLocation && (
          <Marker
            position={[patientLocation.lat, patientLocation.lng]}
            icon={patientIcon}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-red-600">Patient Location</p>
                <p>
                  {patientLocation.lat.toFixed(5)},{" "}
                  {patientLocation.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {ambulanceLocation && (
          <Marker
            position={[ambulanceLocation.lat, ambulanceLocation.lng]}
            icon={ambulanceIcon}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-600">
                  Ambulance Location
                </p>
                <p>
                  {ambulanceLocation.lat.toFixed(5)},{" "}
                  {ambulanceLocation.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Single hospital location (driver view) */}
        {hospitalLocation && (
          <Marker
            position={[hospitalLocation.lat, hospitalLocation.lng]}
            icon={hospitalIcon}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-blue-600">
                  Destination Hospital
                </p>
                <p>
                  {hospitalLocation.lat.toFixed(5)},{" "}
                  {hospitalLocation.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Multiple hospital markers (admin view) */}
        {hospitalLocations?.map((hospital) => (
          <Marker
            key={hospital.id}
            position={[hospital.location.lat, hospital.location.lng]}
            icon={hospitalIcon}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-blue-600">{hospital.name}</p>
                {hospital.availableBeds !== undefined && (
                  <p>Beds: {hospital.availableBeds} available</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
