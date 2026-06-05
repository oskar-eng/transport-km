"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface GpsPoint {
  lat: number;
  lng: number;
  label: string;
  timestamp: string;
}

interface Props {
  gpsPoints: GpsPoint[];
  plate: string;
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

// Ícono con la placa de la unidad
function plateIcon(plate: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="background:#1d4ed8;color:#fff;font-weight:700;font-size:11px;font-family:monospace;
                    padding:2px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);
                    border:2px solid #fff;">🚛 ${plate}</div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
                    border-top:7px solid #1d4ed8;"></div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function OrderMapView({ gpsPoints, plate }: Props) {
  useEffect(() => { fixIcons(); }, []);

  if (gpsPoints.length === 0) return null;

  const last = gpsPoints[gpsPoints.length - 1];
  const polylinePoints: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);
  const center: [number, number] = [last.lat, last.lng];

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "16px" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Trayectoria trazada con líneas */}
      {polylinePoints.length > 1 && (
        <Polyline positions={polylinePoints} color="#2563eb" weight={4} opacity={0.75} />
      )}

      {/* Puntos de cada actualización */}
      {gpsPoints.slice(0, -1).map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={6}
          color="#2563eb" fillColor="#93c5fd" fillOpacity={0.95} weight={2}>
          <Tooltip>{i + 1}. {p.label}</Tooltip>
          <Popup>
            <p style={{ fontWeight: "bold", marginBottom: 2 }}>{i + 1}. {p.label}</p>
            <p style={{ fontSize: 11, color: "#1d4ed8", fontFamily: "monospace" }}>🚛 {plate}</p>
            <p style={{ fontSize: 11, color: "#666" }}>{format(new Date(p.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}</p>
          </Popup>
        </CircleMarker>
      ))}

      {/* Posición actual con la placa visible */}
      <Marker position={center} icon={plateIcon(plate)}>
        <Popup>
          <p style={{ fontWeight: "bold", color: "#1d4ed8", marginBottom: 2 }}>📍 {last.label}</p>
          <p style={{ fontSize: 11, color: "#1d4ed8", fontFamily: "monospace" }}>🚛 {plate}</p>
          <p style={{ fontSize: 11, color: "#666" }}>{format(new Date(last.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}</p>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
