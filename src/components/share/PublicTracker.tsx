"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, Truck, MapPin, Gauge, Package, RefreshCw } from "lucide-react";

const PublicMapView = dynamic(() => import("./PublicMapView"), { ssr: false });

interface TimelineItem {
  key: string;
  label: string;
  index: number;
  registered: boolean;
  timestamp: string | null;
  odometer: number | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface GpsPoint {
  lat: number;
  lng: number;
  label: string;
  timestamp: string;
}

interface OrderData {
  orderNumber: string;
  type: string;
  status: string;
  clientName: string;
  origin: string | null;
  destination: string | null;
  containerNumber: string | null;
  driver: string;
  unit: string;
  timeline: TimelineItem[];
  gpsPoints: GpsPoint[];
  lastGps: GpsPoint | null;
}

function formatDate(ts: string) {
  return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: es });
}

export default function PublicTracker({ token }: { token: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/share/${token}`);
    if (res.ok) {
      setData(await res.json());
      setLastUpdate(new Date());
    } else {
      setError("Enlace inválido o expirado.");
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const registeredCount = data?.timeline.filter((t) => t.registered).length ?? 0;
  const totalCount = data?.timeline.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((registeredCount / totalCount) * 100) : 0;
  const nextItem = data?.timeline.find((t) => !t.registered);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={20} />
            <span className="text-sm font-medium text-blue-200">TransportKM — Seguimiento de Orden</span>
          </div>
          <h1 className="text-2xl font-bold">Orden {data.orderNumber}</h1>
          <p className="text-blue-200 text-sm mt-0.5">
            {data.type === "IMPORTACION" ? "Importación" : "Exportación"} · {data.clientName}
          </p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>{registeredCount} de {totalCount} estados completados</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 bg-blue-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-3">
            {data.status === "COMPLETADO" ? (
              <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                <CheckCircle2 size={12} /> Servicio Completado
              </span>
            ) : nextItem ? (
              <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                <Clock size={12} /> En curso: {nextItem.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Info rápida */}
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Unidad</p>
            <p className="font-semibold text-gray-800">{data.unit}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Conductor</p>
            <p className="font-semibold text-gray-800">{data.driver}</p>
          </div>
          {data.containerNumber && (
            <div>
              <p className="text-xs text-gray-400">Contenedor</p>
              <p className="font-semibold font-mono text-gray-800">{data.containerNumber}</p>
            </div>
          )}
          {data.origin && (
            <div>
              <p className="text-xs text-gray-400">Origen</p>
              <p className="font-semibold text-gray-800">{data.origin}</p>
            </div>
          )}
          {data.destination && (
            <div>
              <p className="text-xs text-gray-400">Destino</p>
              <p className="font-semibold text-gray-800">{data.destination}</p>
            </div>
          )}
        </div>

        {/* Mapa de trayectoria */}
        {data.lastGps ? (
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-blue-600" />
              <p className="text-sm font-semibold text-gray-800">Trayectoria en tiempo real</p>
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                {lastUpdate ? format(lastUpdate, "HH:mm:ss") : ""}
              </span>
            </div>
            <div style={{ height: 320 }}>
              <PublicMapView gpsPoints={data.gpsPoints} lastGps={data.lastGps} />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Se actualiza automáticamente cada 15 segundos
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3 text-gray-400">
            <MapPin size={20} />
            <p className="text-sm">El mapa estará disponible cuando el conductor registre el primer estado con GPS.</p>
          </div>
        )}

        {/* Timeline de estados */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Estados del Servicio</h2>
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
            <div className="space-y-4">
              {data.timeline.map((item) => {
                const isNext = !item.registered && item.key === nextItem?.key;
                return (
                  <div key={item.key} className="flex items-start gap-3 relative">
                    <div className={`z-10 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.registered ? "bg-green-500" : isNext ? "bg-blue-500" : "bg-gray-100"
                    }`}>
                      {item.registered ? (
                        <CheckCircle2 size={14} className="text-white" />
                      ) : isNext ? (
                        <Clock size={14} className="text-white" />
                      ) : (
                        <Circle size={14} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${item.registered ? "text-gray-900" : "text-gray-400"}`}>
                          {item.index}. {item.label}
                        </p>
                        {item.timestamp && (
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(item.timestamp)}</span>
                        )}
                      </div>
                      {item.odometer != null && (
                        <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                          <Gauge size={10} /> {item.odometer.toLocaleString()} km
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">{item.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-6">
          TransportKM · Enlace de solo lectura · Actualización automática cada 15 s
        </p>
      </div>
    </div>
  );
}
