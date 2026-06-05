"use client";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Receipt, Upload, Loader2, X, DollarSign, Fuel, Wrench, Disc, Zap, Wrench as Wr, Package, MoreHorizontal } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

const CATEGORIES: Record<string, { label: string; icon: typeof Disc; color: string }> = {
  LLANTAS:   { label: "Llantas (parche/cambio)", icon: Disc,   color: "bg-slate-100 text-slate-700" },
  ELECTRICO: { label: "Eléctrico / Luces",       icon: Zap,    color: "bg-amber-100 text-amber-700" },
  REPUESTOS: { label: "Repuestos / Mecánica",    icon: Package,color: "bg-blue-100 text-blue-700" },
  OTROS:     { label: "Otros",                   icon: MoreHorizontal, color: "bg-gray-100 text-gray-700" },
};

interface Unit { id: string; plate: string; model: string }
interface Expense {
  id: string; unitId: string; category: string; description: string;
  amount: number; date: string; receiptUrl: string | null; createdByName: string | null;
  unit: { plate: string; model: string };
}
interface Summary {
  unitId: string; plate: string; model: string;
  combustible: number; mantenimiento: number; gastos: Record<string, number>; total: number;
}

const EMPTY = { unitId: "", category: "LLANTAS", description: "", amount: "", date: new Date().toISOString().slice(0, 10), receiptUrl: "" };
const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GastosClient({ expenses: initial, units, summary, userRole, defaultUnitId }: {
  expenses: Expense[]; units: Unit[]; summary: Summary[]; userRole: string; defaultUnitId: string | null;
}) {
  const isDriver = userRole === "CONDUCTOR";
  const canDelete = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);

  const [expenses, setExpenses] = useState<Expense[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, unitId: defaultUnitId ?? "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [filterUnit, setFilterUnit] = useState("TODOS");
  const fileRef = useRef<HTMLInputElement>(null);

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }

  function openNew() {
    setForm({ ...EMPTY, unitId: defaultUnitId ?? "" });
    setError(""); setShowForm(true);
  }

  async function handleReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "expenses");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("receiptUrl", data.url); else setError(data.error ?? "Error al subir comprobante");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.unitId || !form.description || !form.amount || !form.date) {
      setError("Unidad, descripción, monto y fecha son obligatorios"); return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setExpenses(p => [saved, ...p]); setShowForm(false); }
    else { const d = await res.json(); setError(d.error ?? "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setExpenses(p => p.filter(e => e.id !== id));
  }

  const filtered = useMemo(() =>
    expenses.filter(e => filterUnit === "TODOS" || e.unitId === filterUnit),
    [expenses, filterUnit]);

  const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos por Unidad</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isDriver ? "Registra los gastos de tu unidad con su comprobante" : "Llantas, eléctrico, repuestos y otros — consolidado con combustible y mantenimiento"}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Registrar Gasto
        </button>
      </div>

      {/* Consolidado por unidad — solo admin */}
      {!isDriver && summary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Costo total por unidad (consolidado)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Unidad","Combustible","Mantenimiento","Gastos","TOTAL"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.map(u => {
                  const gastosTotal = Object.values(u.gastos).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={u.unitId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-gray-900">{u.plate}</p>
                        <p className="text-xs text-gray-400">{u.model}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700"><span className="flex items-center gap-1"><Fuel size={12} className="text-indigo-500"/>{money(u.combustible)}</span></td>
                      <td className="px-4 py-3 text-gray-700"><span className="flex items-center gap-1"><Wrench size={12} className="text-amber-500"/>{money(u.mantenimiento)}</span></td>
                      <td className="px-4 py-3 text-gray-700"><span className="flex items-center gap-1"><Receipt size={12} className="text-slate-500"/>{money(gastosTotal)}</span></td>
                      <td className="px-4 py-3 font-bold text-blue-800">{money(u.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total gastos", value: money(totalGastos), color: "bg-blue-500" },
          { label: "Registros",    value: expenses.length,    color: "bg-emerald-500" },
          ...Object.entries(CATEGORIES).slice(0, 2).map(([k, c]) => ({
            label: c.label.split(" ")[0],
            value: money(expenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0)),
            color: "bg-slate-400",
          })),
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><DollarSign size={18} className="text-white" /></div>
            <div><p className="text-base font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      {!isDriver && (
        <div className="mb-4">
          <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="TODOS">Todas las unidades</option>
            {summary.map(u => <option key={u.unitId} value={u.unitId}>{u.plate} — {u.model}</option>)}
          </select>
        </div>
      )}

      {/* Lista de gastos */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <Receipt size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay gastos registrados</p>
          <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Registrar primer gasto</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Fecha","Unidad","Categoría","Descripción","Monto","Comprobante","Registró",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(e => {
                  const cat = CATEGORIES[e.category] ?? CATEGORIES.OTROS;
                  const Icon = cat.icon;
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(e.date), "dd/MM/yyyy", { locale: es })}</td>
                      <td className="px-4 py-3"><p className="font-mono font-semibold text-gray-900">{e.unit.plate}</p></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                          <Icon size={11} /> {cat.label.split(" ")[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{money(e.amount)}</td>
                      <td className="px-4 py-3">
                        {e.receiptUrl
                          ? <button onClick={() => setPreview(e.receiptUrl)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Receipt size={12}/> Ver</button>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.createdByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {(canDelete) && (
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
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

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Registrar Gasto</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label>
                  <select value={form.unitId} onChange={e => set("unitId", e.target.value)} disabled={isDriver}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                    <option value="">Seleccionar unidad</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Categoría *</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">¿Qué se realizó? *</label>
                  <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Ej: Parche de llanta delantera derecha"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Monto (S/) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="Ej: 50.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Comprobante (foto)</label>
                  {form.receiptUrl ? (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt size={16} className="text-green-600" />
                        <span className="text-sm text-green-700 font-medium flex-1">Comprobante cargado ✓</span>
                        <button type="button" onClick={() => set("receiptUrl", "")} className="text-gray-400 hover:text-red-600"><X size={16}/></button>
                      </div>
                      <img src={form.receiptUrl} alt="comprobante" className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-white" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-60">
                      {uploading ? <><Loader2 size={16} className="animate-spin"/> Subiendo…</> : <><Upload size={16}/> Subir foto del comprobante</>}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="application/pdf,image/*" capture="environment" className="hidden" onChange={handleReceipt} />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving || uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal vista comprobante */}
      {preview && <FilePreview url={preview} title="Comprobante" onClose={() => setPreview(null)} />}
    </div>
  );
}
