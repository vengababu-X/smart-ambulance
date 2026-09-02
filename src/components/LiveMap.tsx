"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";

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
  hospitalLocations?: HospitalMarker[];
  center?: Coordinate;
  zoom?: number;
}

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



export default function LiveMap({
  patientLocation,
  ambulanceLocation,
  hospitalLocations,
  center,
  zoom = 13,
}: LiveMapProps) {
  const mapCenter =
    center ??
    patientLocation ??
    ambulanceLocation ?? { lat: 17.6868, lng: 83.2185 };

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
