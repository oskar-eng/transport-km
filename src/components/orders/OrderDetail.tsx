"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getEvents } from "@/lib/events";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, ArrowLeft, Download, Gauge, MapPin, Loader2, Share2, Check, XCircle } from "lucide-react";

const OrderMap = dynamic(() => import("./OrderMapView"), { ssr: false });

interface Event {
  id: string;
  eventType: string;
  timestamp: string;
  odometer: number | null;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  clientName: string;
  origin: string | null;
  destination: string | null;
  containerNumber: string | null;
  driver: { id: string; name: string };
  unit: { id: string; plate: string; model: string; year: number };
  events: Event[];
}

function formatDate(ts: string) {
  return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: es });
}

export default function OrderDetail({
  order,
  userRole,
  userId,
}: {
  order: Order;
  userRole: string;
  userId: string;
}) {
  const router = useRouter();
  const events = getEvents(order.type);
  const registeredKeys = order.events.map((e) => e.eventType);
  const nextKey = events.find((e) => !registeredKeys.includes(e.key))?.key;
  const [loading, setLoading] = useState(false);
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "getting" | "ok" | "error">("idle");
  const [localEvents, setLocalEvents] = useState<Event[]>(order.events);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeOdometer, setCloseOdometer] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState("");

  const isDriver = userRole === "CONDUCTOR" && userId === order.driver.id;
  const canRegister = isDriver && order.status === "ACTIVO";

  function getPosition(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      setGpsStatus("getting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus("ok");
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGpsStatus("error");
          resolve(null);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  async function registerEvent(eventType: string) {
    if (!odometer) {
      setError("El odómetro es obligatorio");
      return;
    }
    setLoading(true);
    setError("");
    const position = await getPosition();
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: order.id,
        eventType,
        odometer: Number(odometer),
        notes,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      const newEvent = await res.json();
      setLocalEvents((prev) => [...prev, newEvent]);
      setOdometer("");
      setNotes("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al registrar");
    }
  }

  async function shareOrder() {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/share`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.token) {
        const url = `${window.location.origin}/share/${data.token}`;
        setShareUrl(url);
      } else {
        alert("Error al generar el link: " + (data.error ?? res.status));
      }
    } catch (e) {
      alert("Error de red al generar el link");
      console.error(e);
    } finally {
      setShareLoading(false);
    }
  }

  async function closeOrderEarly() {
    if (!closeReason.trim()) { setCloseError("La razón es obligatoria"); return; }
    setCloseLoading(true);
    setCloseError("");
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close_early",
        reason: closeReason.trim(),
        odometer: closeOdometer || null,
      }),
    });
    setCloseLoading(false);
    if (res.ok) {
      setShowCloseModal(false);
      router.refresh();
    } else {
      const data = await res.json();
      setCloseError(data.error ?? "Error al cerrar la orden");
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  async function exportExcel() {
    const { utils, writeFile } = await import("xlsx");
    const rows = events.map((ev) => {
      const reg = localEvents.find((e) => e.eventType === ev.key);
      return {
        Estado: ev.label,
        Hora: reg ? formatDate(reg.timestamp) : "",
        "Odómetro (km)": reg?.odometer ?? "",
        Notas: reg?.notes ?? "",
      };
    });
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Orden");
    writeFile(wb, `Orden_${order.orderNumber}.xlsx`);
  }

  const registeredMap = Object.fromEntries(localEvents.map((e) => [e.eventType, e]));

  // Puntos GPS para el mapa (eventos con ubicación), ordenados por hora
  const gpsPoints = [...localEvents]
    .filter((e) => e.latitude != null && e.longitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((e) => ({
      lat: e.latitude as number,
      lng: e.longitude as number,
      label: events.find((d) => d.key === e.eventType)?.label ?? e.eventType,
      timestamp: e.timestamp,
    }));

  // Calcular km recorridos si hay odómetro en primer y último evento registrado
  const firstEvent = localEvents[0];
  const lastEvent = localEvents[localEvents.length - 1];
  const kmRecorridos =
    firstEvent?.odometer && lastEvent?.odometer && localEvents.length > 1
      ? lastEvent.odometer - firstEvent.odometer
      : null;

  return (
    <div className="flex gap-6 items-start">
     <div className="flex-1 max-w-3xl min-w-0">

      {/* Modal cierre anticipado */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle size={18} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Cerrar orden anticipadamente</h3>
                <p className="text-xs text-gray-500">La unidad no retornará a cochera en este servicio</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 my-4 text-xs text-orange-700">
              ⚠️ Esta acción marca la orden como <strong>Completada</strong> aunque no se hayan registrado todos los estados. Usa esto cuando la unidad toma un nuevo servicio directo sin pasar por cochera.
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Razón del cierre <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Ej: Toma nuevo servicio directo desde cliente, Queda en patio de contenedores..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Odómetro al cierre <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <Gauge size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={closeOdometer}
                    onChange={(e) => setCloseOdometer(e.target.value)}
                    placeholder="Ej: 128500"
                    min={0}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                </div>
              </div>
            </div>

            {closeError && <p className="text-red-600 text-xs mb-3">{closeError}</p>}

            <div className="flex gap-3">
              <button
                onClick={closeOrderEarly}
                disabled={closeLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white transition-colors"
              >
                {closeLoading ? <><Loader2 size={14} className="animate-spin" /> Cerrando...</> : <><XCircle size={14} /> Confirmar cierre</>}
              </button>
              <button
                onClick={() => { setShowCloseModal(false); setCloseReason(""); setCloseOdometer(""); setCloseError(""); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de compartir */}
      {shareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Share2 size={18} className="text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Link de seguimiento</h3>
                <p className="text-xs text-gray-500">Comparte este link con tu cliente</p>
              </div>
            </div>

            {/* Link display */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
              <p className="text-sm text-blue-700 break-all flex-1 font-mono select-all">{shareUrl}</p>
            </div>

            {/* Info */}
            <ul className="text-xs text-gray-500 space-y-1 mb-5">
              <li className="flex items-center gap-1.5">✅ No requiere cuenta ni contraseña</li>
              <li className="flex items-center gap-1.5">🗺️ Muestra mapa con trayectoria en tiempo real</li>
              <li className="flex items-center gap-1.5">🔄 Se actualiza automáticamente cada 15 segundos</li>
              <li className="flex items-center gap-1.5">👁️ Solo lectura — el cliente no puede modificar nada</li>
            </ul>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={copyShareUrl}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  shareCopied
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-blue-800 hover:bg-blue-700 text-white"
                }`}
              >
                {shareCopied ? <><Check size={15} /> ¡Copiado!</> : <><Check size={15} className="opacity-0 w-0" /><Share2 size={15} /> Copiar link</>}
              </button>
              <button
                onClick={() => { setShareUrl(null); setShareCopied(false); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Orden {order.orderNumber}</h1>
          <p className="text-sm text-gray-500">
            {order.type === "IMPORTACION" ? "Importación" : "Exportación"} · {order.clientName}
          </p>
        </div>
        {userRole !== "CONDUCTOR" && order.status === "ACTIVO" && (
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <XCircle size={15} /> Cerrar orden
          </button>
        )}
        {userRole !== "CONDUCTOR" && (
          <button
            onClick={shareOrder}
            disabled={shareLoading}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {shareLoading
              ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
              : <><Share2 size={15} /> Compartir</>
            }
          </button>
        )}
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 text-sm border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50"
        >
          <Download size={15} /> Excel
        </button>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><p className="text-gray-400 text-xs">Unidad</p><p className="font-semibold">{order.unit.plate}</p></div>
        <div><p className="text-gray-400 text-xs">Modelo</p><p className="font-semibold">{order.unit.model}</p></div>
        <div><p className="text-gray-400 text-xs">Conductor</p><p className="font-semibold">{order.driver.name}</p></div>
        {order.containerNumber && (
          <div><p className="text-gray-400 text-xs">Contenedor</p><p className="font-semibold font-mono">{order.containerNumber}</p></div>
        )}
        {order.origin && (
          <div><p className="text-gray-400 text-xs">Origen</p><p className="font-semibold">{order.origin}</p></div>
        )}
        {order.destination && (
          <div><p className="text-gray-400 text-xs">Destino</p><p className="font-semibold">{order.destination}</p></div>
        )}
        {kmRecorridos !== null && (
          <div className="sm:col-span-3 flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Gauge size={16} className="text-blue-700" />
            <p className="text-xs text-blue-700">
              <span className="font-bold text-blue-900">{kmRecorridos.toLocaleString()} km</span> recorridos en este servicio
            </p>
          </div>
        )}
      </div>

      {/* Events */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Estados del Servicio</h2>

        {canRegister && nextKey && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-800 mb-3">
              Siguiente: {events.find((e) => e.key === nextKey)?.label}
            </p>

            {/* Odómetro */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-blue-800 mb-1">
                Odómetro / km actual <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Gauge size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="number"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="Ej: 125430"
                  min={0}
                  className="w-full border border-blue-200 rounded-lg pl-9 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">km</span>
              </div>
            </div>

            {/* Notas */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-blue-800 mb-1">
                Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: tráfico, demora en aduana..."
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                rows={2}
              />
            </div>

            {/* GPS status */}
            <div className="flex items-center gap-2 mb-3 text-xs">
              {gpsStatus === "idle" && (
                <span className="flex items-center gap-1 text-blue-500"><MapPin size={12} /> Se capturará ubicación GPS al registrar</span>
              )}
              {gpsStatus === "getting" && (
                <span className="flex items-center gap-1 text-yellow-600"><Loader2 size={12} className="animate-spin" /> Obteniendo ubicación...</span>
              )}
              {gpsStatus === "ok" && (
                <span className="flex items-center gap-1 text-green-600"><MapPin size={12} /> Ubicación capturada ✓</span>
              )}
              {gpsStatus === "error" && (
                <span className="flex items-center gap-1 text-orange-500"><MapPin size={12} /> Sin GPS — se registrará sin ubicación</span>
              )}
            </div>

            {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
            <button
              onClick={() => registerEvent(nextKey)}
              disabled={loading}
              className="bg-blue-800 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg w-full transition-colors"
            >
              {loading ? "Registrando..." : `✓ Registrar: ${events.find((e) => e.key === nextKey)?.label}`}
            </button>
          </div>
        )}

        {order.status === "COMPLETADO" && (
          <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">
            <CheckCircle2 size={18} /> Orden completada
          </div>
        )}

        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {events.map((ev, idx) => {
              const reg = registeredMap[ev.key];
              const isNext = ev.key === nextKey;
              return (
                <div key={ev.key} className="flex items-start gap-4 relative">
                  <div className={`z-10 mt-0.5 rounded-full flex items-center justify-center w-8 h-8 flex-shrink-0 ${
                    reg ? "bg-green-500" : isNext ? "bg-blue-500" : "bg-gray-200"
                  }`}>
                    {reg ? (
                      <CheckCircle2 size={16} className="text-white" />
                    ) : isNext ? (
                      <Clock size={16} className="text-white" />
                    ) : (
                      <Circle size={16} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className={`text-sm font-medium ${reg ? "text-gray-900" : "text-gray-400"}`}>
                        {idx + 1}. {ev.label}
                      </p>
                      {reg && (
                        <span className="text-xs text-gray-500">{formatDate(reg.timestamp)}</span>
                      )}
                    </div>
                    {reg?.odometer != null && (
                      <p className="text-xs text-blue-700 mt-0.5 flex items-center gap-1">
                        <Gauge size={11} /> {reg.odometer.toLocaleString()} km
                      </p>
                    )}
                    {(reg as Event & { latitude?: number; longitude?: number })?.latitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${(reg as Event & { latitude: number }).latitude},${(reg as Event & { longitude: number }).longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 mt-0.5 flex items-center gap-1 hover:underline"
                      >
                        <MapPin size={11} /> Ver en mapa
                      </a>
                    )}
                    {reg?.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">{reg.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
     </div>

      {/* Mapa — lado derecho, solo en web (oculto en celular) */}
      {gpsPoints.length > 0 && (
        <div className="hidden lg:block w-[440px] shrink-0">
          <div className="sticky top-6">
            <div className="bg-white rounded-2xl shadow-sm p-2 h-[calc(100vh-7rem)]">
              <div className="px-2 py-1.5 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <MapPin size={15} className="text-blue-700" /> Ruta del servicio
                </h2>
                <span className="text-xs font-mono font-bold text-blue-700">🚛 {order.unit.plate}</span>
              </div>
              <div className="h-[calc(100%-2.5rem)]">
                <OrderMap gpsPoints={gpsPoints} plate={order.unit.plate} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
