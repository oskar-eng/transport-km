"use client";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Fuel, TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, CheckCircle2, X, Receipt, Camera, AlertCircle, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import FilePreview from "@/components/common/FilePreview";

const FuelEfficiencyChart = dynamic(() => import("./FuelEfficiencyChart"), { ssr: false });

const FUEL_TYPES: Record<string, string> = { DIESEL: "Diésel", GASOLINA: "Gasolina", GNV: "GNV" };
const EMPTY_FORM = { unitId: "", date: "", liters: "", pricePerLiter: "", totalCost: "", odometer: "", station: "", stationName: "", stationAddress: "", fuelType: "DIESEL", loadType: "TRACTO", notes: "", driverName: "", driverDni: "", receiptDispatchUrl: "", receiptPaymentUrl: "" };
// Umbral: si el km del comprobante es muy bajo, la carga es para el generador (no tiene odómetro real)
const GENERADOR_KM_MAX = 100;
// Nota: el campo "liters" en DB almacena galones (unidad de la empresa)

type SlotKey = "DESPACHO" | "PAGO";
interface SlotState { scanning: boolean; preview: string; url: string; done: boolean; error: string }
const EMPTY_SLOT: SlotState = { scanning: false, preview: "", url: "", done: false, error: "" };
const SLOT_INFO: Record<SlotKey, { label: string; hint: string }> = {
  DESPACHO: { label: "Vale de despacho (grifo)", hint: "El ticket del grifo con los galones y el tipo de combustible" },
  PAGO:     { label: "Comprobante de pago (Niubiz)", hint: "El voucher de la tarjeta con el monto pagado" },
};

interface Unit    { id: string; plate: string; model: string }
interface FuelRec {
  id: string; unitId: string; date: string; liters: number;
  pricePerLiter: number | null; totalCost: number | null; odometer: number;
  station: string | null; stationName?: string | null; stationAddress?: string | null; fuelType: string; loadType?: string; notes: string | null;
  kmPerLiter: number | null;
  driverName?: string | null; driverDni?: string | null;
  receiptDispatchUrl?: string | null; receiptPaymentUrl?: string | null;
  unit: { plate: string; model: string };
}

export default function FuelClient({
  records: initial, units, userRole, defaultUnitId,
}: {
  records: FuelRec[]; units: Unit[]; userRole: string; defaultUnitId?: string;
}) {
  const [records, setRecords]       = useState<FuelRec[]>(initial);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<FuelRec | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [filterUnit, setFilterUnit] = useState("TODOS");
  const [activeTab, setActiveTab]   = useState<"lista" | "resumen">("lista");

  // Scan state — dos casillas (vale de despacho + comprobante de pago)
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({ DESPACHO: { ...EMPTY_SLOT }, PAGO: { ...EMPTY_SLOT } });
  const dispatchRef = useRef<HTMLInputElement>(null);
  const paymentRef  = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null); // visor de comprobantes en historial
  const [detectedPlate, setDetectedPlate] = useState(""); // placa leída del comprobante
  const [plateMatched, setPlateMatched]   = useState(false); // si coincidió con una unidad registrada

  const isDriver  = userRole === "CONDUCTOR";
  const canEdit   = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "CONDUCTOR"].includes(userRole);

  function set(f: string, v: string) {
    setForm(p => {
      const next = { ...p, [f]: v };
      if ((f === "liters" || f === "pricePerLiter") && next.liters && next.pricePerLiter) {
        next.totalCost = (parseFloat(next.liters) * parseFloat(next.pricePerLiter)).toFixed(2);
      }
      return next;
    });
  }

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, unitId: defaultUnitId ?? "" });
    setSlots({ DESPACHO: { ...EMPTY_SLOT }, PAGO: { ...EMPTY_SLOT } });
    setDetectedPlate(""); setPlateMatched(false);
    setError(""); setShowForm(true);
  }
  function openEdit(r: FuelRec) {
    setEditing(r);
    setForm({
      unitId: r.unitId, date: format(new Date(r.date), "yyyy-MM-dd"),
      liters: String(r.liters), pricePerLiter: r.pricePerLiter ? String(r.pricePerLiter) : "",
      totalCost: r.totalCost ? String(r.totalCost) : "", odometer: String(r.odometer),
      station: r.station ?? "", stationName: r.stationName ?? "", stationAddress: r.stationAddress ?? "", fuelType: r.fuelType, loadType: r.loadType ?? "TRACTO", notes: r.notes ?? "",
      driverName: r.driverName ?? "", driverDni: r.driverDni ?? "",
      receiptDispatchUrl: r.receiptDispatchUrl ?? "", receiptPaymentUrl: r.receiptPaymentUrl ?? "",
    });
    setSlots({ DESPACHO: { ...EMPTY_SLOT }, PAGO: { ...EMPTY_SLOT } });
    setDetectedPlate(""); setPlateMatched(false);
    setError(""); setShowForm(true);
  }

  const matchPlate = (plate?: string) => {
    if (!plate) return null;
    const norm = plate.replace(/[-\s]/g, "").toUpperCase();
    return units.find(u => u.plate.replace(/[-\s]/g, "").toUpperCase() === norm) ?? null;
  };

  function setSlot(slot: SlotKey, patch: Partial<SlotState>) {
    setSlots(prev => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  /* ── Escanear un comprobante (vale de despacho o pago) ── */
  async function handleScan(slot: SlotKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlot(slot, { scanning: true, done: false, error: "", preview: URL.createObjectURL(file) });
    setError("");

    // 1) Leer/validar con la IA
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expectedType", slot);
    const res  = await fetch("/api/parse-fuel", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setSlot(slot, { scanning: false, done: false, error: data.error ?? "No se pudo leer el comprobante", preview: "" });
      if (slot === "DESPACHO" && dispatchRef.current) dispatchRef.current.value = "";
      if (slot === "PAGO" && paymentRef.current) paymentRef.current.value = "";
      return;
    }

    // 2) Subir la foto a Cloudinary para guardarla como comprobante
    let uploadedUrl = "";
    try {
      const up = new FormData();
      up.append("file", file);
      up.append("folder", "combustible");
      const upRes = await fetch("/api/upload", { method: "POST", body: up });
      if (upRes.ok) uploadedUrl = (await upRes.json()).url ?? "";
    } catch { /* si falla la subida, igual usamos los datos extraídos */ }

    // 3) Combinar datos en el formulario según el tipo
    if (data.plate) {
      setDetectedPlate(String(data.plate).toUpperCase());
      setPlateMatched(!!matchPlate(data.plate));
    }
    setForm(f => {
      const next = { ...f };
      const match = matchPlate(data.plate);
      if (match) next.unitId = match.id; // selecciona la unidad automáticamente
      if (data.date) next.date = data.date;

      if (slot === "DESPACHO") {
        if (data.liters   != null) next.liters   = String(data.liters);
        if (data.fuelType)         next.fuelType = data.fuelType;
        if (data.station)          next.station  = data.station;
        if (data.stationName)      next.stationName = data.stationName;
        if (data.stationAddress)   next.stationAddress = data.stationAddress;
      } else { // PAGO
        if (data.totalCost != null) next.totalCost = String(data.totalCost);
        if (data.odometer  != null) {
          next.odometer = String(data.odometer); // km del comprobante de pago
          // Si el km es muy bajo (ej. 000001), es carga de generador (no tiene odómetro real)
          next.loadType = Number(data.odometer) <= GENERADOR_KM_MAX ? "GENERADOR" : "TRACTO";
        }
        if (data.driverName)        next.driverName = data.driverName;
        if (data.driverDni)         next.driverDni  = data.driverDni;
      }
      if (uploadedUrl) {
        if (slot === "DESPACHO") next.receiptDispatchUrl = uploadedUrl;
        else                     next.receiptPaymentUrl  = uploadedUrl;
      }
      // Recalcular precio por galón si tenemos total y galones
      const lit = parseFloat(next.liters), tot = parseFloat(next.totalCost);
      if (lit > 0 && tot > 0) next.pricePerLiter = (tot / lit).toFixed(2);
      return next;
    });
    setSlot(slot, { scanning: false, done: true, error: "", url: uploadedUrl });
    if (slot === "DESPACHO" && dispatchRef.current) dispatchRef.current.value = "";
    if (slot === "PAGO" && paymentRef.current) paymentRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.date || !form.liters || !form.odometer) {
      setError("Unidad, fecha, galones y odómetro son obligatorios"); return;
    }
    setLoading(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url    = editing ? `/api/fuel/${editing.id}` : "/api/fuel";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) setRecords(p => p.map(r => r.id === saved.id ? { ...saved, kmPerLiter: r.kmPerLiter } : r));
      else         setRecords(p => [...p, { ...saved, kmPerLiter: null }]);
      setShowForm(false);
    } else {
      const d = await res.json();
      setError(d.error ?? "Error al guardar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    await fetch(`/api/fuel/${id}`, { method: "DELETE" });
    setRecords(p => p.filter(r => r.id !== id));
  }

  const filtered = useMemo(() =>
    records.filter(r => filterUnit === "TODOS" || r.unitId === filterUnit),
    [records, filterUnit]
  );

  const unitSummary = useMemo(() => {
    const map: Record<string, { plate: string; model: string; totalLiters: number; totalCost: number; records: FuelRec[] }> = {};
    for (const r of records) {
      if (!map[r.unitId]) map[r.unitId] = { plate: r.unit.plate, model: r.unit.model, totalLiters: 0, totalCost: 0, records: [] };
      map[r.unitId].totalLiters += r.liters;
      map[r.unitId].totalCost   += r.totalCost ?? 0;
      map[r.unitId].records.push(r);
    }
    return Object.entries(map).map(([unitId, v]) => {
      const withKm = v.records.filter(r => r.kmPerLiter != null);
      const avgKmL = withKm.length > 0
        ? Math.round((withKm.reduce((s, r) => s + (r.kmPerLiter ?? 0), 0) / withKm.length) * 10) / 10
        : null;
      return { unitId, ...v, avgKmL };
    });
  }, [records]);

  const totalLiters = records.reduce((s, r) => s + r.liters, 0);
  const totalCost   = records.reduce((s, r) => s + (r.totalCost ?? 0), 0);
  const allKmL      = records.filter(r => r.kmPerLiter != null).map(r => r.kmPerLiter as number);
  const avgKmL      = allKmL.length > 0 ? Math.round((allKmL.reduce((a, b) => a + b, 0) / allKmL.length) * 10) / 10 : null;
  const alerts      = avgKmL ? records.filter(r => r.kmPerLiter != null && r.kmPerLiter < avgKmL * 0.8) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combustible</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isDriver ? "Registra tus cargas de combustible" : "Cargas, consumo y rendimiento por unidad"}
          </p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Registrar Carga
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total cargas",      value: records.length,                         color: "bg-blue-500" },
          { label: "Galones totales",   value: `${totalLiters.toLocaleString()} Gal`,  color: "bg-indigo-500" },
          { label: "Gasto total",       value: totalCost > 0 ? `S/ ${totalCost.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "—", color: "bg-emerald-500" },
          { label: "Rendimiento prom.", value: avgKmL ? `${avgKmL} km/Gal` : "—",     color: "bg-purple-500" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><Fuel size={18} className="text-white" /></div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta bajo rendimiento */}
      {alerts.length > 0 && (
        <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Rendimiento bajo detectado</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {alerts.length} carga{alerts.length > 1 ? "s" : ""} con rendimiento inferior al 80% del promedio ({avgKmL} km/Gal).
            </p>
          </div>
        </div>
      )}

      {/* Tabs — oculto para conductores */}
      {!isDriver && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          {(["lista", "resumen"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "lista" ? "Historial de cargas" : "Resumen por unidad"}
            </button>
          ))}
        </div>
      )}

      {/* Filtro unidad — solo para no conductores */}
      {!isDriver && (
        <div className="mb-4">
          <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="TODOS">Todas las unidades</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
          </select>
        </div>
      )}

      {/* Tab: Historial */}
      {(isDriver || activeTab === "lista") && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
              <Fuel size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay registros de combustible</p>
              {canEdit && <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Registrar primera carga</button>}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Fecha","Unidad","Destino","Tipo","Galones","Precio/Gal","Costo total","Odómetro","Rendimiento","Grifo","Dirección","Conductor","DNI","Comprob.",""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(r => {
                      const trend = r.kmPerLiter && avgKmL
                        ? r.kmPerLiter >= avgKmL * 1.1 ? "up" : r.kmPerLiter <= avgKmL * 0.8 ? "down" : "ok"
                        : null;
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-800">{format(new Date(r.date), "dd/MM/yyyy", { locale: es })}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold text-gray-900">{r.unit.plate}</p>
                            <p className="text-xs text-gray-400">{r.unit.model}</p>
                          </td>
                          <td className="px-4 py-3">
                            {(r.loadType === "GENERADOR" || r.odometer <= GENERADOR_KM_MAX) ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚡ Generador</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🚛 Tracto</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{FUEL_TYPES[r.fuelType] ?? r.fuelType}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{r.liters} Gal</td>
                          <td className="px-4 py-3 text-gray-600">{r.pricePerLiter ? `S/ ${r.pricePerLiter}` : "—"}</td>
                          <td className="px-4 py-3 font-semibold">{r.totalCost ? `S/ ${r.totalCost.toLocaleString("es-PE", { maximumFractionDigits: 2 })}` : "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{r.odometer.toLocaleString()} km</td>
                          <td className="px-4 py-3">
                            {r.kmPerLiter != null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                trend === "up" ? "bg-green-100 text-green-700" : trend === "down" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                                {trend === "up" ? <TrendingUp size={10}/> : trend === "down" ? <TrendingDown size={10}/> : <Minus size={10}/>}
                                {r.kmPerLiter} km/Gal
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[160px]">
                            {r.stationName ? <p className="text-gray-700 font-medium">{r.stationName}</p>
                              : r.station ? <p className="text-gray-700 font-medium">{r.station}</p>
                              : <span className="text-gray-300">—</span>}
                            {r.stationName && r.station && <p className="text-gray-400">{r.station}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">{r.stationAddress ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">{r.driverName ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{r.driverDni ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {r.receiptDispatchUrl && (
                                <button onClick={() => setPreview(r.receiptDispatchUrl!)} title="Vale de despacho"
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Receipt size={14}/></button>
                              )}
                              {r.receiptPaymentUrl && (
                                <button onClick={() => setPreview(r.receiptPaymentUrl!)} title="Comprobante de pago"
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><FileText size={14}/></button>
                              )}
                              {!r.receiptDispatchUrl && !r.receiptPaymentUrl && <span className="text-gray-300 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {canEdit && !isDriver && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Pencil size={13}/></button>
                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab: Resumen */}
      {!isDriver && activeTab === "resumen" && (
        <div className="space-y-4">
          {unitSummary.length === 0
            ? <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">Sin datos</div>
            : unitSummary.map(u => (
              <div key={u.unitId} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-gray-900 font-mono text-lg">{u.plate}</p>
                    <p className="text-sm text-gray-500">{u.model}</p>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div><p className="text-lg font-bold text-blue-700">{u.totalLiters.toLocaleString()} Gal</p><p className="text-xs text-gray-400">Total galones</p></div>
                    <div><p className="text-lg font-bold text-emerald-700">{u.totalCost > 0 ? `S/ ${u.totalCost.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "—"}</p><p className="text-xs text-gray-400">Gasto</p></div>
                    <div><p className="text-lg font-bold text-purple-700">{u.avgKmL ? `${u.avgKmL} km/Gal` : "—"}</p><p className="text-xs text-gray-400">Rendimiento</p></div>
                    <div><p className="text-lg font-bold text-gray-700">{u.records.length}</p><p className="text-xs text-gray-400">Cargas</p></div>
                  </div>
                </div>
                <FuelEfficiencyChart data={u.records} avg={u.avgKmL} />
              </div>
            ))
          }
        </div>
      )}

      {/* ── Modal Formulario ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Editar Carga" : "Registrar Carga de Combustible"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* ── Escanear comprobantes: 2 casillas ── */}
              {!editing && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={16} className="text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">Sube las fotos de los comprobantes</p>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">La IA lee los datos automáticamente. Puedes subir uno o los dos comprobantes.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(["DESPACHO", "PAGO"] as SlotKey[]).map(slot => {
                      const s = slots[slot];
                      const info = SLOT_INFO[slot];
                      const ref = slot === "DESPACHO" ? dispatchRef : paymentRef;
                      return (
                        <div key={slot} className={`rounded-xl border-2 border-dashed bg-white p-3 transition-colors ${s.done ? "border-green-300" : s.error ? "border-red-300" : "border-amber-200"}`}>
                          <p className="text-xs font-bold text-gray-700">{info.label}</p>
                          <p className="text-[11px] text-gray-400 leading-tight mt-0.5 mb-2">{info.hint}</p>

                          {s.preview && !s.error ? (
                            <div className="flex items-start gap-2">
                              <img src={s.preview} alt={slot} className="w-16 h-20 object-cover rounded-lg border border-gray-200 shadow-sm" />
                              <div className="text-[11px] flex-1">
                                {s.done && <p className="flex items-center gap-1 text-green-700 font-semibold mb-1"><CheckCircle2 size={12}/> Leído ✓</p>}
                                {slot === "DESPACHO" && (
                                  <>
                                    {form.liters && <p>⛽ <strong>{form.liters} Gal</strong></p>}
                                    {(form.stationName || form.station) && <p>🏪 <strong>{form.stationName || form.station}</strong></p>}
                                  </>
                                )}
                                {slot === "PAGO" && (
                                  <>
                                    {form.totalCost && <p>💰 <strong>S/ {form.totalCost}</strong></p>}
                                    {form.odometer && <p>🛣️ <strong>{Number(form.odometer).toLocaleString()} km</strong></p>}
                                    {form.driverName && <p>👤 <strong>{form.driverName}</strong></p>}
                                  </>
                                )}
                                <button type="button" onClick={() => ref.current?.click()} className="text-blue-600 hover:underline mt-1">Cambiar foto</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => ref.current?.click()} disabled={s.scanning}
                              className="w-full flex flex-col items-center justify-center gap-1.5 py-4 text-amber-600 hover:text-amber-700 disabled:opacity-60">
                              {s.scanning
                                ? <><Loader2 size={20} className="animate-spin"/> <span className="text-xs">Analizando…</span></>
                                : <><Camera size={22}/> <span className="text-xs font-medium">Tomar / subir foto</span></>}
                            </button>
                          )}

                          {s.error && (
                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 rounded-lg p-2">
                              <AlertCircle size={13} className="shrink-0 mt-0.5" />
                              <span>{s.error}</span>
                            </div>
                          )}
                          <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleScan(slot, e)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Formulario */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label>
                  <select value={form.unitId} onChange={e => set("unitId", e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar unidad</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                  </select>
                  {/* Aviso de placa detectada en el comprobante */}
                  {detectedPlate && plateMatched && form.unitId && (
                    <p className="text-[11px] text-green-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Unidad seleccionada automáticamente por la placa <strong>{detectedPlate}</strong>
                    </p>
                  )}
                  {detectedPlate && !plateMatched && (
                    <p className="text-[11px] text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> Placa detectada <strong>{detectedPlate}</strong>, pero no está registrada como unidad. Selecciónala manualmente o regístrala en Vehículos.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set("date", e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Tipo de combustible</label>
                  <select value={form.fuelType} onChange={e => set("fuelType", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(FUEL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Destino de la carga</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([["TRACTO", "🚛 Tracto"], ["GENERADOR", "⚡ Generador"]] as const).map(([val, label]) => (
                      <button key={val} type="button" onClick={() => set("loadType", val)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${form.loadType === val ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.loadType === "GENERADOR" && (
                    <p className="text-[11px] text-amber-600 mt-1">El generador no tiene odómetro; esta carga no afectará el rendimiento km/galón.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Galones cargados *</label>
                  <input type="number" step="0.01" value={form.liters} onChange={e => set("liters", e.target.value)} required placeholder="Ej: 31.8"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Precio por galón</label>
                  <input type="number" step="0.01" value={form.pricePerLiter} onChange={e => set("pricePerLiter", e.target.value)} placeholder="Ej: 19.70"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Costo total <span className="text-gray-400 font-normal">(auto)</span></label>
                  <input type="number" step="0.01" value={form.totalCost} onChange={e => set("totalCost", e.target.value)} placeholder="S/ 0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro al cargar *</label>
                  <div className="relative">
                    <input type="number" value={form.odometer} onChange={e => set("odometer", e.target.value)} required placeholder="Ej: 290743"
                      className="w-full border-2 border-blue-400 rounded-lg px-3 pr-10 py-2 text-base font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">km</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Empresa / Razón social</label>
                  <input value={form.station} onChange={e => set("station", e.target.value)} placeholder="Ej: REPSOL COMERCIAL S.A.C."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Nombre del grifo</label>
                  <input value={form.stationName} onChange={e => set("stationName", e.target.value)} placeholder="Ej: San Carlos"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Dirección del grifo</label>
                  <input value={form.stationAddress} onChange={e => set("stationAddress", e.target.value)} placeholder="Ej: Panamericana Norte Km 28.3, Puente Piedra"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Conductor <span className="text-gray-400 font-normal">(del voucher)</span></label>
                  <input value={form.driverName} onChange={e => set("driverName", e.target.value)} placeholder="Nombre"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">DNI conductor</label>
                  <input value={form.driverDni} onChange={e => set("driverDni", e.target.value)} placeholder="Ej: 41885898"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Notas</label>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleSubmit} disabled={loading || slots.DESPACHO.scanning || slots.PAGO.scanning}
                className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Guardando…" : "Confirmar y Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && <FilePreview url={preview} title="Comprobante de combustible" onClose={() => setPreview(null)} />}
    </div>
  );
}
