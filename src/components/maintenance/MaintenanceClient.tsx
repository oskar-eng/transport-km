"use client";
import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Wrench, Clock, CheckCircle2, AlertTriangle, Filter, ChevronDown } from "lucide-react";

const TYPES: Record<string, { label: string; color: string }> = {
  PREVENTIVO: { label: "Preventivo",  color: "bg-blue-100 text-blue-700" },
  CORRECTIVO: { label: "Correctivo",  color: "bg-red-100 text-red-700" },
  PREDICTIVO: { label: "Predictivo",  color: "bg-purple-100 text-purple-700" },
};

const STATUSES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE:   { label: "Pendiente",   color: "bg-yellow-100 text-yellow-700", icon: Clock },
  EN_PROCESO:  { label: "En proceso",  color: "bg-blue-100 text-blue-700",     icon: Wrench },
  COMPLETADO:  { label: "Completado",  color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
};

interface Unit { id: string; plate: string; model: string }
interface Maint {
  id: string; unitId: string; type: string; status: string; description: string;
  date: string; odometer: number; workshop: string | null; technician: string | null;
  cost: number | null; nextDate: string | null; nextOdometer: number | null; notes: string | null;
  unit: { plate: string; model: string };
}

const EMPTY = {
  unitId: "", type: "PREVENTIVO", status: "PENDIENTE", description: "",
  date: "", odometer: "", workshop: "", technician: "", cost: "",
  nextDate: "", nextOdometer: "", notes: "",
};

export default function MaintenanceClient({ records: initial, units, userRole }: { records: Maint[]; units: Unit[]; userRole: string }) {
  const [records, setRecords] = useState<Maint[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Maint | null>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [filterUnit,   setFilterUnit]   = useState("TODOS");
  const [filterType,   setFilterType]   = useState("TODOS");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [expanded, setExpanded]         = useState<string | null>(null);

  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(userRole);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  function openNew() { setEditing(null); setForm({ ...EMPTY }); setError(""); setShowForm(true); }
  function openEdit(r: Maint) {
    setEditing(r);
    setForm({
      unitId: r.unitId, type: r.type, status: r.status, description: r.description,
      date: format(new Date(r.date), "yyyy-MM-dd"),
      odometer: String(r.odometer),
      workshop: r.workshop ?? "", technician: r.technician ?? "",
      cost: r.cost ? String(r.cost) : "",
      nextDate: r.nextDate ? format(new Date(r.nextDate), "yyyy-MM-dd") : "",
      nextOdometer: r.nextOdometer ? String(r.nextOdometer) : "",
      notes: r.notes ?? "",
    });
    setError(""); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.description || !form.date || !form.odometer) {
      setError("Unidad, descripción, fecha y odómetro son obligatorios"); return;
    }
    setLoading(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url    = editing ? `/api/maintenance/${editing.id}` : "/api/maintenance";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) setRecords((p) => p.map((r) => r.id === saved.id ? saved : r));
      else         setRecords((p) => [saved, ...p]);
      setShowForm(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro de mantenimiento?")) return;
    await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
    setRecords((p) => p.filter((r) => r.id !== id));
  }

  async function updateStatus(id: string, status: string) {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    const res = await fetch(`/api/maintenance/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rec, status }),
    });
    if (res.ok) {
      const saved = await res.json();
      setRecords((p) => p.map((r) => r.id === saved.id ? saved : r));
    }
  }

  const filtered = useMemo(() => records.filter((r) => {
    return (filterUnit   === "TODOS" || r.unitId === filterUnit) &&
           (filterType   === "TODOS" || r.type   === filterType) &&
           (filterStatus === "TODOS" || r.status === filterStatus);
  }), [records, filterUnit, filterType, filterStatus]);

  // KPIs
  const pendiente  = records.filter((r) => r.status === "PENDIENTE").length;
  const enProceso  = records.filter((r) => r.status === "EN_PROCESO").length;
  const completado = records.filter((r) => r.status === "COMPLETADO").length;
  const totalCosto = records.filter((r) => r.status === "COMPLETADO" && r.cost).reduce((s, r) => s + (r.cost ?? 0), 0);

  // Próximos mantenimientos (nextDate en los próximos 30 días)
  const now = new Date();
  const proximos = records.filter((r) => {
    if (!r.nextDate) return false;
    const days = differenceInDays(new Date(r.nextDate), now);
    return days >= 0 && days <= 30;
  }).sort((a, b) => new Date(a.nextDate!).getTime() - new Date(b.nextDate!).getTime());

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mantenimiento</h1>
          <p className="text-sm text-gray-400 mt-0.5">Preventivo, correctivo y predictivo por unidad</p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Plus size={16} /> Nuevo Mantenimiento
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pendientes",   value: pendiente,  color: "bg-yellow-500" },
          { label: "En proceso",   value: enProceso,  color: "bg-blue-500" },
          { label: "Completados",  value: completado, color: "bg-green-500" },
          { label: "Costo total",  value: totalCosto > 0 ? `S/ ${totalCosto.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "—", color: "bg-purple-500" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} w-2 h-10 rounded-full flex-shrink-0`} />
            <div>
              <p className="text-xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta próximos mantenimientos */}
      {proximos.length > 0 && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">
              {proximos.length} mantenimiento{proximos.length > 1 ? "s" : ""} programado{proximos.length > 1 ? "s" : ""} en los próximos 30 días
            </p>
          </div>
          <div className="space-y-2">
            {proximos.slice(0, 3).map((r) => {
              const days = differenceInDays(new Date(r.nextDate!), now);
              return (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div>
                    <span className="font-mono font-semibold text-sm text-gray-800">{r.unit.plate}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-sm text-gray-600">{r.description}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${days <= 7 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {days === 0 ? "Hoy" : `En ${days} días`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todas las unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todos los tipos</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todos los estados</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterUnit !== "TODOS" || filterType !== "TODOS" || filterStatus !== "TODOS") && (
          <button onClick={() => { setFilterUnit("TODOS"); setFilterType("TODOS"); setFilterStatus("TODOS"); }}
            className="text-xs text-blue-600 hover:underline">Limpiar</button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <Wrench size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay registros de mantenimiento</p>
          {canEdit && <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Agregar primero</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const type   = TYPES[r.type]   ?? { label: r.type,   color: "bg-gray-100 text-gray-700" };
            const status = STATUSES[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-700", icon: Wrench };
            const StatusIcon = status.icon;
            const isOpen = expanded === r.id;

            return (
              <div key={r.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Fila principal */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Wrench size={18} className="text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-mono font-bold text-gray-900">{r.unit.plate}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${type.color}`}>{type.label}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                        <StatusIcon size={10} /> {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{r.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(r.date), "dd/MM/yyyy", { locale: es })} · {r.odometer.toLocaleString()} km
                      {r.cost ? ` · S/ ${r.cost.toLocaleString("es-PE", { maximumFractionDigits: 2 })}` : ""}
                      {r.workshop ? ` · ${r.workshop}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Cambio rápido de estado */}
                    {canEdit && r.status !== "COMPLETADO" && (
                      <button onClick={() => updateStatus(r.id, r.status === "PENDIENTE" ? "EN_PROCESO" : "COMPLETADO")}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                        {r.status === "PENDIENTE" ? "▶ Iniciar" : "✓ Completar"}
                      </button>
                    )}
                    <button onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50">
                      <ChevronDown size={15} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Detalle expandido */}
                {isOpen && (
                  <div className="border-t bg-gray-50 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-xs text-gray-400 mb-0.5">Taller</p><p className="font-medium text-gray-700">{r.workshop ?? "—"}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Técnico</p><p className="font-medium text-gray-700">{r.technician ?? "—"}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Costo</p><p className="font-medium text-gray-700">{r.cost ? `S/ ${r.cost.toLocaleString("es-PE", { maximumFractionDigits: 2 })}` : "—"}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Odómetro</p><p className="font-medium text-gray-700">{r.odometer.toLocaleString()} km</p></div>
                    {r.nextDate && (
                      <div><p className="text-xs text-gray-400 mb-0.5">Próximo servicio</p>
                        <p className="font-medium text-blue-700">{format(new Date(r.nextDate), "dd/MM/yyyy", { locale: es })}</p>
                      </div>
                    )}
                    {r.nextOdometer && (
                      <div><p className="text-xs text-gray-400 mb-0.5">Próximo odómetro</p>
                        <p className="font-medium text-blue-700">{r.nextOdometer.toLocaleString()} km</p>
                      </div>
                    )}
                    {r.notes && (
                      <div className="col-span-2 sm:col-span-4"><p className="text-xs text-gray-400 mb-0.5">Notas</p>
                        <p className="text-gray-600 italic">{r.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editing ? "Editar Mantenimiento" : "Nuevo Mantenimiento"}</h2>
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Tipo *</label>
                <select value={form.type} onChange={(e) => set("type", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Estado</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Descripción *</label>
                <input value={form.description} onChange={(e) => set("description", e.target.value)} required
                  placeholder="Ej: Cambio de aceite y filtros, revisión de frenos..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label>
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro *</label>
                <div className="relative">
                  <input type="number" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} required
                    placeholder="Ej: 125000"
                    className="w-full border rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Taller</label>
                <input value={form.workshop} onChange={(e) => set("workshop", e.target.value)}
                  placeholder="Nombre del taller"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Técnico responsable</label>
                <input value={form.technician} onChange={(e) => set("technician", e.target.value)}
                  placeholder="Nombre del técnico"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Costo (S/)</label>
                <input type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximo mantenimiento</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha programada</label>
                    <input type="date" value={form.nextDate} onChange={(e) => set("nextDate", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro programado</label>
                    <div className="relative">
                      <input type="number" value={form.nextOdometer} onChange={(e) => set("nextOdometer", e.target.value)}
                        placeholder="Ej: 130000"
                        className="w-full border rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Notas adicionales</label>
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
