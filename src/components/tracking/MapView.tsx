"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect } from "react";

interface TrackingUnit {
  orderId: string;
  orderNumber: string;
  type: string;
  status: string;
  clientName: string;
  driver: { name: string };
  unit: { plate: string; model: string };
  kmRecorridos: number | null;
  lastEvent: {
    eventType: string;
    label: string;
    timestamp: string;
    odometer: number | null;
    latitude: number;
    longitude: number;
  };
}

// Fix default marker icons for webpack/Next.js
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export default function MapView({ units }: { units: TrackingUnit[] }) {
  useEffect(() => { fixLeafletIcons(); }, []);

  const center: [number, number] = units.length > 0
    ? [units[0].lastEvent.latitude, units[0].lastEvent.longitude]
    : [-33.45, -70.65]; // Santiago, Chile default

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "420px", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {units.map((u) => (
        <Marker
          key={u.orderId}
          position={[u.lastEvent.latitude, u.lastEvent.longitude]}
        >
          <Popup>
            <div style={{ minWidth: 210, fontSize: 12, lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: "bold", fontSize: 14, fontFamily: "monospace" }}>{u.unit.plate}</span>
                <span style={{ fontSize: 10, fontWeight: "bold", background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 999 }}>{u.status}</span>
              </div>
              <table style={{ width: "100%" }}>
                <tbody>
                  <tr><td style={{ color: "#888", paddingRight: 8 }}>Conductor</td><td style={{ fontWeight: 600 }}>{u.driver.name}</td></tr>
                  <tr><td style={{ color: "#888" }}>Orden</td><td style={{ fontWeight: 600 }}>{u.orderNumber} · {u.clientName}</td></tr>
                  <tr><td style={{ color: "#888" }}>Estatus</td><td style={{ fontWeight: 600, color: "#173a73" }}>{u.lastEvent.label}</td></tr>
                  <tr><td style={{ color: "#888" }}>Km recorridos</td><td style={{ fontWeight: 600 }}>{u.kmRecorridos != null ? `${u.kmRecorridos.toLocaleString()} km` : "—"}</td></tr>
                  <tr><td style={{ color: "#888" }}>Fecha/hora</td><td style={{ fontWeight: 600 }}>{format(new Date(u.lastEvent.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}</td></tr>
                </tbody>
              </table>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
