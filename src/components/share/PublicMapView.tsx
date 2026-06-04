"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface GpsPoint {
  lat: number;
  lng: number;
  label: string;
  timestamp: string;
}

interface Props {
  gpsPoints: GpsPoint[];
  lastGps: GpsPoint | null;
}

function fixIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export default function PublicMapView({ gpsPoints, lastGps }: Props) {
  useEffect(() => { fixIcons(); }, []);

  if (!lastGps) return null;

  const polylinePoints: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);
  const center: [number, number] = [lastGps.lat, lastGps.lng];

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "16px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Trayectoria */}
      {polylinePoints.length > 1 && (
        <Polyline positions={polylinePoints} color="#2563eb" weight={3} opacity={0.7} />
      )}

      {/* Puntos intermedios */}
      {gpsPoints.slice(0, -1).map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={5}
          color="#2563eb"
          fillColor="#93c5fd"
          fillOpacity={0.9}
          weight={2}
        >
          <Popup>
            <p style={{ fontWeight: "bold", marginBottom: 2 }}>{p.label}</p>
            <p style={{ fontSize: 11, color: "#666" }}>
              {format(new Date(p.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          </Popup>
        </CircleMarker>
      ))}

      {/* Posición actual (último punto) */}
      <Marker position={center}>
        <Popup>
          <p style={{ fontWeight: "bold", color: "#1d4ed8", marginBottom: 2 }}>
            📍 Posición actual
          </p>
          <p style={{ fontSize: 12, marginBottom: 2 }}>{lastGps.label}</p>
          <p style={{ fontSize: 11, color: "#666" }}>
            {format(new Date(lastGps.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
