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
  clientName: string;
  driver: { name: string };
  unit: { plate: string; model: string };
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
            <div style={{ minWidth: 180 }}>
              <p style={{ fontWeight: "bold", marginBottom: 4 }}>{u.unit.plate} — {u.unit.model}</p>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>{u.driver.name}</p>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{u.clientName} · {u.orderNumber}</p>
              <p style={{ fontSize: 12, background: "#eff6ff", color: "#1d4ed8", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>
                {u.lastEvent.label}
              </p>
              <br />
              <span style={{ fontSize: 11, color: "#888" }}>
                {format(new Date(u.lastEvent.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
              </span>
              {u.lastEvent.odometer && (
                <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
                  {u.lastEvent.odometer.toLocaleString()} km
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
