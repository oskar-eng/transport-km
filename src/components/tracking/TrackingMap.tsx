"use client";
import { useEffect, useState, useCallback } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function TrackingMap() {
  const [units, setUnits] = useState<TrackingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking");
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
        setLastUpdate(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 15000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-600">
            {units.length} unidad{units.length !== 1 ? "es" : ""} activa{units.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={12} />
          {lastUpdate
            ? `Actualizado ${format(lastUpdate, "HH:mm:ss", { locale: es })}`
            : "Actualizando..."}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Cargando mapa...
        </div>
      ) : units.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
          <MapPin size={32} />
          <p className="text-sm">No hay unidades activas con ubicación GPS registrada</p>
        </div>
      ) : (
        <MapView units={units} />
      )}

      {/* Lista de unidades */}
      {units.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {units.map((u) => (
            <div key={u.orderId} className="bg-white rounded-xl shadow-sm p-4 text-sm border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-1">
                <p className="font-bold text-gray-900">{u.unit.plate}</p>
                <span className="text-xs text-gray-400">{u.orderNumber}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">{u.driver.name} · {u.clientName}</p>
              <p className="text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-0.5 inline-block">
                {u.lastEvent.label}
              </p>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{format(new Date(u.lastEvent.timestamp), "dd/MM HH:mm", { locale: es })}</span>
                {u.lastEvent.odometer && <span>{u.lastEvent.odometer.toLocaleString()} km</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
