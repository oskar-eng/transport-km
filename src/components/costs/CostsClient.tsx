"use client";
import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Truck, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import CostBreakdownChart from "./CostBreakdownChart";

interface Unit { id: string; plate: string; model: string; }
interface OtherCost {
  id: string; unitId: string; category: string; description: string;
  amount: number; date: string; notes?: string | null;
  unit: { plate: string; model: string };
}
interface UnitSummary {
  unit: Unit;
  fuelTotal: number;
  maintenanceTotal: number;
  otherByCategory: Record<string, number>;
  otherTotal: number;
  grandTotal: number;
}

interface Props {
  units: Unit[];
  fuelByUnit: Record<string, number>;
  maintenanceByUnit: Record<string, number>;
  initialCosts: OtherCost[];
}

const CATEGORIES = [
  { value: "PEAJE",          label: "Peajes" },
  { value: "SEGURO",         label: "Seguros" },
  { value: "LLANTAS",        label: "Llantas" },
  { value: "CONDUCTOR",      label: "Conductor" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "OTRO",           label: "Otros" },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const empty = { unitId: "", category: "PEAJE", description: "", amount: "", date: new Date().toISOString().slice(0, 10), notes: "" };

export default function CostsClient({ units, fuelByUnit, maintenanceByUnit, initialCosts }: Props) {
  const [costs, setCosts]         = useState<OtherCost[]>(initialCosts);
  const [filterUnit, setFilterUnit] = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<OtherCost | null>(null);
  const [form, setForm]           = useState({ ...empty });
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);

  /* ── summaries per unit ── */
  const summaries: UnitSummary[] = useMemo(() => {
    return units.map(unit => {
      const fuelTotal        = fuelByUnit[unit.id] ?? 0;
      const maintenanceTotal = maintenanceByUnit[unit.id] ?? 0;
      const unitCosts        = costs.filter(c => c.unitId === unit.id);
      const otherByCategory: Record<string, number> = {};
      let otherTotal = 0;
      for (const c of unitCosts) {
        otherByCategory[c.category] = (otherByCategory[c.category] ?? 0) + c.amount;
        otherTotal += c.amount;
      }
      return { unit, fuelTotal, maintenanceTotal, otherByCategory, otherTotal, grandTotal: fuelTotal + maintenanceTotal + otherTotal };
    }).sort((a, b) => b.grandTotal - a.grandTotal);
  }, [units, fuelByUnit, maintenanceByUnit, costs]);

  const totalGeneral = summaries.reduce((s, u) => s + u.grandTotal, 0);
  const totalFuel    = summaries.reduce((s, u) => s + u.fuelTotal, 0);
  const totalMaint   = summaries.reduce((s, u) => s + u.maintenanceTotal, 0);
  const totalOther   = summaries.reduce((s, u) => s + u.otherTotal, 0);

  const filteredCosts = filterUnit ? costs.filter(c => c.unitId === filterUnit) : costs;

  /* ── form helpers ── */
  const openNew = () => { setEditing(null); setForm({ ...empty }); setShowForm(true); };
  const openEdit = (c: OtherCost) => {
    setEditing(c);
    setForm({ unitId: c.unitId, category: c.category, description: c.description, amount: String(c.amount), date: c.date.slice(0,10), notes: c.notes ?? "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.unitId || !form.description || !form.amount || !form.date) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/costs/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const updated = await res.json();
        setCosts(prev => prev.map(c => c.id === editing.id ? updated : c));
      } else {
        const res = await fetch("/api/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const created = await res.json();
        setCosts(prev => [created, ...prev]);
      }
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este costo?")) return;
    await fetch(`/api/costs/${id}`, { method: "DELETE" });
    setCosts(prev => prev.filter(c => c.id !== id));
  };

  const fmt = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Costo Total",      value: fmt(totalGeneral), color: "blue" },
          { label: "Combustible",      value: fmt(totalFuel),    color: "amber" },
          { label: "Mantenimiento",    value: fmt(totalMaint),   color: "orange" },
          { label: "Otros Costos",     value: fmt(totalOther),   color: "purple" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold text-${k.color}-600`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Per-unit cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Desglose por Unidad</h2>
        {summaries.filter(s => s.grandTotal > 0).map(s => (
          <div key={s.unit.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === s.unit.id ? null : s.unit.id)}
            >
              <div className="flex items-center gap-3">
                <Truck size={18} className="text-blue-500" />
                <div className="text-left">
                  <p className="font-semibold text-gray-800">{s.unit.plate}</p>
                  <p className="text-xs text-gray-500">{s.unit.model}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-800">{fmt(s.grandTotal)}</span>
                {expanded === s.unit.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {expanded === s.unit.id && (
              <div className="border-t border-gray-100 px-5 py-4 grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Combustible</span><span className="font-medium text-amber-600">{fmt(s.fuelTotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Mantenimiento</span><span className="font-medium text-orange-600">{fmt(s.maintenanceTotal)}</span></div>
                  {Object.entries(s.otherByCategory).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-gray-500">{CAT_LABEL[cat] ?? cat}</span>
                      <span className="font-medium text-purple-600">{fmt(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
                    <span>Total</span><span>{fmt(s.grandTotal)}</span>
                  </div>
                </div>
                <CostBreakdownChart fuel={s.fuelTotal} maintenance={s.maintenanceTotal} other={s.otherByCategory} />
              </div>
            )}
          </div>
        ))}
        {summaries.every(s => s.grandTotal === 0) && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            Sin costos registrados aún
          </div>
        )}
      </div>

      {/* Other costs table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Otros Costos</h2>
          <div className="flex items-center gap-3">
            <select
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las unidades</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
            </select>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Fecha","Unidad","Categoría","Descripción","Monto",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCosts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{c.date.slice(0,10)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{c.unit.plate}</span>
                    <span className="text-gray-400 ml-1 text-xs">{c.unit.model}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{CAT_LABEL[c.category] ?? c.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.description}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(c.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCosts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-800">{editing ? "Editar Costo" : "Nuevo Costo"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unidad *</label>
                <select
                  value={form.unitId}
                  onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar unidad</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoría *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Peaje Ancón – Huacho"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto (S/) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Observaciones opcionales..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
