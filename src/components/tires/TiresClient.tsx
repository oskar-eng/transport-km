"use client";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

const POSITIONS: Record<string, string> = {
  DEL_IZQ:      "Delantera Izq.",
  DEL_DER:      "Delantera Der.",
  TRA_IZQ_EXT:  "Trasera Izq. Ext.",
  TRA_IZQ_INT:  "Trasera Izq. Int.",
  TRA_DER_EXT:  "Trasera Der. Ext.",
  TRA_DER_INT:  "Trasera Der. Int.",
  REPUESTO:     "Repuesto",
};

const STATUSES: Record<string, { label: string; color: string }> = {
  ACTIVO:     { label: "Activo",      color: "bg-green-100 text-green-700" },
  DESGASTADO: { label: "Desgastado",  color: "bg-yellow-100 text-yellow-700" },
  REPARACION: { label: "Reparación",  color: "bg-blue-100 text-blue-700" },
  BAJA:       { label: "De baja",     color: "bg-red-100 text-red-700" },
};

// Alerta si km recorridos > 80,000
const KM_ALERT = 80000;

interface Unit { id: string; plate: string; model: string }
interface Tire {
  id: string; unitId: string; brand: string; size: string; position: string;
  installDate: string; installOdometer: number; currentOdometer: number;
  status: string; notes: string | null;
  unit: { plate: string; model: string };
}

const EMPTY = { unitId: "", brand: "", size: "", position: "DEL_IZQ", installDate: "", installOdometer: "", currentOdometer: "", status: "ACTIVO", notes: "" };

export default function TiresClient({ tires: initial, units, userRole }: { tires: Tire[]; units: Unit[]; userRole: string }) {
  const [tires, setTires]       = useState<Tire[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Tire | null>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [filterUnit, setFilterUnit] = useState("TODOS");
  const [view, setView]             = useState<"lista" | "diagrama">("lista");

  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(userRole);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  function openNew() { setEditing(null); setForm({ ...EMPTY }); setError(""); setShowForm(true); }
  function openEdit(t: Tire) {
    setEditing(t);
    setForm({
      unitId: t.unitId, brand: t.brand, size: t.size, position: t.position,
      installDate: format(new Date(t.installDate), "yyyy-MM-dd"),
      installOdometer: String(t.installOdometer),
      currentOdometer: String(t.currentOdometer),
      status: t.status, notes: t.notes ?? "",
    });
    setError(""); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.brand || !form.installDate || !form.installOdometer || !form.currentOdometer) {
      setError("Unidad, marca, fecha e odómetros son obligatorios"); return;
    }
    setLoading(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url    = editing ? `/api/tires/${editing.id}` : "/api/tires";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) setTires((p) => p.map((t) => t.id === saved.id ? saved : t));
      else         setTires((p) => [...p, saved]);
      setShowForm(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este neumático?")) return;
    await fetch(`/api/tires/${id}`, { method: "DELETE" });
    setTires((p) => p.filter((t) => t.id !== id));
  }

  const filtered = useMemo(() =>
    tires.filter((t) => filterUnit === "TODOS" || t.unitId === filterUnit),
    [tires, filterUnit]
  );

  const kmRecorridos = (t: Tire) => t.currentOdometer - t.installOdometer;
  const pctDesgaste  = (t: Tire) => Math.min(100, Math.round((kmRecorridos(t) / KM_ALERT) * 100));
  const alerts       = filtered.filter((t) => kmRecorridos(t) >= KM_ALERT && t.status === "ACTIVO");

  // Vista diagrama: agrupar por unidad
  const byUnit = useMemo(() => {
    const map: Record<string, { plate: string; model: string; tires: Tire[] }> = {};
    for (const t of filtered) {
      if (!map[t.unitId]) map[t.unitId] = { plate: t.unit.plate, model: t.unit.model, tires: [] };
      map[t.unitId].tires.push(t);
    }
    return Object.values(map);
  }, [filtered]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Neumáticos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control por posición y kilometraje recorrido</p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Plus size={16} /> Registrar Neumático
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUSES).map(([k, v]) => {
          const count = tires.filter((t) => t.status === k).length;
          return (
            <div key={k} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className={`w-2 h-10 rounded-full flex-shrink-0 ${k === "ACTIVO" ? "bg-green-500" : k === "DESGASTADO" ? "bg-yellow-500" : k === "REPARACION" ? "bg-blue-500" : "bg-red-500"}`} />
              <div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{v.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              {alerts.length} neumático{alerts.length > 1 ? "s" : ""} con más de {KM_ALERT.toLocaleString()} km — revisar desgaste
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {alerts.map((t) => `${t.unit.plate} (${POSITIONS[t.position]})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Filtro + tabs */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todas las unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
        </select>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["lista", "diagrama"] as const).map((t) => (
            <button key={t} onClick={() => setView(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${view === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "lista" ? "Lista" : "Por unidad"}
            </button>
          ))}
        </div>
      </div>

      {/* Vista lista */}
      {view === "lista" && (
        filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
            <p className="text-sm">No hay neumáticos registrados</p>
            {canEdit && <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Registrar primero</button>}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Unidad", "Posición", "Marca / Medida", "Instalación", "Km recorridos", "Desgaste", "Estado", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((t) => {
                    const km  = kmRecorridos(t);
                    const pct = pctDesgaste(t);
                    const st  = STATUSES[t.status] ?? { label: t.status, color: "bg-gray-100 text-gray-700" };
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold text-gray-900">{t.unit.plate}</p>
                          <p className="text-xs text-gray-400">{t.unit.model}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{POSITIONS[t.position] ?? t.position}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{t.brand}</p>
                          <p className="text-xs text-gray-400 font-mono">{t.size}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{format(new Date(t.installDate), "dd/MM/yyyy", { locale: es })}</p>
                          <p className="text-xs text-gray-400">{t.installOdometer.toLocaleString()} km</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-semibold ${km >= KM_ALERT ? "text-red-600" : "text-gray-800"}`}>
                            {km.toLocaleString()} km
                          </p>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-green-500"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={13} /></button>
                              <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13} /></button>
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
        )
      )}

      {/* Vista por unidad / diagrama */}
      {view === "diagrama" && (
        <div className="space-y-5">
          {byUnit.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
              <p className="text-sm">No hay neumáticos registrados</p>
            </div>
          ) : byUnit.map((u) => (
            <div key={u.plate} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <p className="font-mono font-bold text-lg text-gray-900">{u.plate}</p>
                <p className="text-gray-500 text-sm">{u.model}</p>
                <span className="ml-auto text-xs text-gray-400">{u.tires.length} neumáticos registrados</span>
              </div>
              {/* Diagrama visual del camión */}
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                {/* Eje delantero */}
                <p className="col-span-2 text-xs text-center text-gray-400 font-semibold uppercase tracking-wide">— Eje Delantero —</p>
                {["DEL_IZQ", "DEL_DER"].map((pos) => {
                  const tire = u.tires.find((t) => t.position === pos);
                  return <TireSlot key={pos} pos={pos} tire={tire ?? null} onEdit={canEdit ? openEdit : undefined} />;
                })}
                {/* Eje trasero */}
                <p className="col-span-2 text-xs text-center text-gray-400 font-semibold uppercase tracking-wide mt-2">— Eje Trasero —</p>
                {["TRA_IZQ_EXT", "TRA_IZQ_INT", "TRA_DER_INT", "TRA_DER_EXT"].map((pos) => {
                  const tire = u.tires.find((t) => t.position === pos);
                  return <TireSlot key={pos} pos={pos} tire={tire ?? null} onEdit={canEdit ? openEdit : undefined} />;
                })}
                {/* Repuesto */}
                <p className="col-span-2 text-xs text-center text-gray-400 font-semibold uppercase tracking-wide mt-2">— Repuesto —</p>
                {["REPUESTO"].map((pos) => {
                  const tire = u.tires.find((t) => t.position === pos);
                  return <TireSlot key={pos} pos={pos} tire={tire ?? null} onEdit={canEdit ? openEdit : undefined} />;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editing ? "Editar Neumático" : "Registrar Neumático"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label>
                <select value={form.unitId} onChange={(e) => set("unitId", e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar unidad</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Posición *</label>
                <select value={form.position} onChange={(e) => set("position", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Estado</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Marca *</label>
                <input value={form.brand} onChange={(e) => set("brand", e.target.value)} required placeholder="Ej: Michelin"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Medida *</label>
                <input value={form.size} onChange={(e) => set("size", e.target.value)} required placeholder="Ej: 295/80R22.5"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha instalación *</label>
                <input type="date" value={form.installDate} onChange={(e) => set("installDate", e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro instalación *</label>
                <div className="relative">
                  <input type="number" value={form.installOdometer} onChange={(e) => set("installOdometer", e.target.value)} required placeholder="Ej: 120000"
                    className="w-full border rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro actual *</label>
                <div className="relative">
                  <input type="number" value={form.currentOdometer} onChange={(e) => set("currentOdometer", e.target.value)} required placeholder="Ej: 135000"
                    className="w-full border rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Componente de slot en diagrama
function TireSlot({ pos, tire, onEdit }: { pos: string; tire: Tire | null; onEdit?: (t: Tire) => void }) {
  const POSITIONS: Record<string, string> = {
    DEL_IZQ: "Del. Izq.", DEL_DER: "Del. Der.",
    TRA_IZQ_EXT: "Tra. Iz. Ext.", TRA_IZQ_INT: "Tra. Iz. Int.",
    TRA_DER_EXT: "Tra. Dr. Ext.", TRA_DER_INT: "Tra. Dr. Int.",
    REPUESTO: "Repuesto",
  };
  const km  = tire ? tire.currentOdometer - tire.installOdometer : 0;
  const pct = tire ? Math.min(100, Math.round((km / 80000) * 100)) : 0;

  if (!tire) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center text-gray-300">
        <p className="text-xs font-medium">{POSITIONS[pos]}</p>
        <p className="text-xs mt-1">Sin registrar</p>
      </div>
    );
  }

  const statusColor = tire.status === "ACTIVO" ? "border-green-300 bg-green-50"
    : tire.status === "DESGASTADO" ? "border-yellow-300 bg-yellow-50"
    : tire.status === "REPARACION" ? "border-blue-300 bg-blue-50"
    : "border-red-300 bg-red-50";

  return (
    <div className={`border-2 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow ${statusColor}`}
      onClick={() => onEdit?.(tire)}>
      <p className="text-xs font-semibold text-gray-600 mb-1">{POSITIONS[pos]}</p>
      <p className="text-sm font-bold text-gray-900">{tire.brand}</p>
      <p className="text-xs text-gray-500 font-mono">{tire.size}</p>
      <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-green-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{km.toLocaleString()} km</p>
    </div>
  );
}
