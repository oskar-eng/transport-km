"use client";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Fuel, TrendingUp, TrendingDown, Minus, AlertTriangle, ScanLine, Loader2, CheckCircle2, X, Receipt } from "lucide-react";
import dynamic from "next/dynamic";

const FuelEfficiencyChart = dynamic(() => import("./FuelEfficiencyChart"), { ssr: false });

const FUEL_TYPES: Record<string, string> = { DIESEL: "Diésel", GASOLINA: "Gasolina", GNV: "GNV" };
const EMPTY_FORM = { unitId: "", date: "", liters: "", pricePerLiter: "", totalCost: "", odometer: "", station: "", fuelType: "DIESEL", notes: "" };

interface Unit    { id: string; plate: string; model: string }
interface FuelRec {
  id: string; unitId: string; date: string; liters: number;
  pricePerLiter: number | null; totalCost: number | null; odometer: number;
  station: string | null; fuelType: string; notes: string | null;
  kmPerLiter: number | null;
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

  // Scan state
  const [scanning, setScanning]     = useState(false);
  const [scanned, setScanned]       = useState(false);
  const [scanPreview, setScanPreview] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

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
    setScanned(false); setScanPreview(""); setError(""); setShowForm(true);
  }
  function openEdit(r: FuelRec) {
    setEditing(r);
    setForm({
      unitId: r.unitId, date: format(new Date(r.date), "yyyy-MM-dd"),
      liters: String(r.liters), pricePerLiter: r.pricePerLiter ? String(r.pricePerLiter) : "",
      totalCost: r.totalCost ? String(r.totalCost) : "", odometer: String(r.odometer),
      station: r.station ?? "", fuelType: r.fuelType, notes: r.notes ?? "",
    });
    setScanned(false); setScanPreview(""); setError(""); setShowForm(true);
  }

  /* ── Scan voucher with AI ── */
  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true); setScanned(false); setError("");
    setScanPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/parse-fuel", { method: "POST", body: fd });
    const data = await res.json();
    setScanning(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo leer el voucher");
      setScanPreview(""); return;
    }

    // Match plate to unit
    let detectedUnitId = form.unitId;
    if (data.plate) {
      const match = units.find(u => u.plate.replace(/[-\s]/g, "").toUpperCase() === data.plate.replace(/[-\s]/g, "").toUpperCase());
      if (match) detectedUnitId = match.id;
    }

    setForm(f => ({
      ...f,
      unitId:       detectedUnitId || f.unitId,
      date:         data.date         ?? f.date,
      liters:       data.liters       != null ? String(data.liters) : f.liters,
      totalCost:    data.totalCost    != null ? String(data.totalCost) : f.totalCost,
      odometer:     data.odometer     != null ? String(data.odometer) : f.odometer,
      station:      data.station      ?? f.station,
      fuelType:     data.fuelType     ?? f.fuelType,
    }));
    setScanned(true);
    if (scanRef.current) scanRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.date || !form.liters || !form.odometer) {
      setError("Unidad, fecha, litros y odómetro son obligatorios"); return;
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
          { label: "Litros totales",    value: `${totalLiters.toLocaleString()} L`,    color: "bg-indigo-500" },
          { label: "Gasto total",       value: totalCost > 0 ? `S/ ${totalCost.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "—", color: "bg-emerald-500" },
          { label: "Rendimiento prom.", value: avgKmL ? `${avgKmL} km/L` : "—",       color: "bg-purple-500" },
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
              {alerts.length} carga{alerts.length > 1 ? "s" : ""} con rendimiento inferior al 80% del promedio ({avgKmL} km/L).
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
                      {["Fecha","Unidad","Litros","Precio/L","Costo total","Odómetro","Rendimiento","Grifo",""].map(h => (
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
                            <p className="text-xs text-gray-400">{FUEL_TYPES[r.fuelType]}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold text-gray-900">{r.unit.plate}</p>
                            <p className="text-xs text-gray-400">{r.unit.model}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{r.liters} L</td>
                          <td className="px-4 py-3 text-gray-600">{r.pricePerLiter ? `S/ ${r.pricePerLiter}` : "—"}</td>
                          <td className="px-4 py-3 font-semibold">{r.totalCost ? `S/ ${r.totalCost.toLocaleString("es-PE", { maximumFractionDigits: 2 })}` : "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{r.odometer.toLocaleString()} km</td>
                          <td className="px-4 py-3">
                            {r.kmPerLiter != null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                trend === "up" ? "bg-green-100 text-green-700" : trend === "down" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                                {trend === "up" ? <TrendingUp size={10}/> : trend === "down" ? <TrendingDown size={10}/> : <Minus size={10}/>}
                                {r.kmPerLiter} km/L
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{r.station ?? "—"}</td>
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
                    <div><p className="text-lg font-bold text-blue-700">{u.totalLiters.toLocaleString()} L</p><p className="text-xs text-gray-400">Total litros</p></div>
                    <div><p className="text-lg font-bold text-emerald-700">{u.totalCost > 0 ? `S/ ${u.totalCost.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "—"}</p><p className="text-xs text-gray-400">Gasto</p></div>
                    <div><p className="text-lg font-bold text-purple-700">{u.avgKmL ? `${u.avgKmL} km/L` : "—"}</p><p className="text-xs text-gray-400">Rendimiento</p></div>
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

              {/* ── Escanear voucher ── */}
              {!editing && (
                <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-xl shrink-0">
                      <Receipt size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800">Escanear voucher de carga</p>
                      <p className="text-xs text-amber-700 mt-0.5">Sube la foto del recibo Repsol, Primax, Niubiz, etc. La IA extrae automáticamente los datos</p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <button type="button" onClick={() => scanRef.current?.click()} disabled={scanning}
                          className="flex items-center gap-2 text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {scanning
                            ? <><Loader2 size={14} className="animate-spin"/> Analizando voucher…</>
                            : <><ScanLine size={14}/> Subir foto del voucher</>}
                        </button>
                        {scanned && (
                          <span className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                            <CheckCircle2 size={14}/> Datos extraídos ✓
                          </span>
                        )}
                      </div>
                      {/* Miniatura del voucher escaneado */}
                      {scanPreview && (
                        <div className="mt-3 flex items-start gap-2">
                          <img src={scanPreview} alt="voucher" className="w-20 h-28 object-cover rounded-lg border border-amber-200 shadow-sm" />
                          {scanned && (
                            <div className="text-xs text-amber-800 bg-amber-100 rounded-lg p-2">
                              <p className="font-semibold mb-1">Datos detectados:</p>
                              {form.unitId && <p>📍 Placa: <strong>{units.find(u => u.id === form.unitId)?.plate}</strong></p>}
                              {form.date && <p>📅 Fecha: <strong>{form.date}</strong></p>}
                              {form.liters && <p>⛽ Litros: <strong>{form.liters} L</strong></p>}
                              {form.totalCost && <p>💰 Total: <strong>S/ {form.totalCost}</strong></p>}
                              {form.odometer && <p>🛣️ KM: <strong>{Number(form.odometer).toLocaleString()}</strong></p>}
                              {form.station && <p>🏪 Grifo: <strong>{form.station}</strong></p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
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
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Litros cargados *</label>
                  <input type="number" step="0.01" value={form.liters} onChange={e => set("liters", e.target.value)} required placeholder="Ej: 120.5"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Precio por litro</label>
                  <input type="number" step="0.01" value={form.pricePerLiter} onChange={e => set("pricePerLiter", e.target.value)} placeholder="Ej: 5.20"
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
                      className="w-full border border-gray-200 rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Grifo / Estación</label>
                  <input value={form.station} onChange={e => set("station", e.target.value)} placeholder="Ej: Repsol Callao"
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
              <button type="button" onClick={handleSubmit} disabled={loading || scanning}
                className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Guardando…" : "Confirmar y Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
