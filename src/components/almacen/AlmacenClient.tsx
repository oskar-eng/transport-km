"use client";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Package, Plus, X, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Search, Boxes, Trash2, TrendingUp, TrendingDown } from "lucide-react";

interface Part {
  id: string; code: string; name: string; category: string | null; brand: string | null;
  unit: string; stock: number; minStock: number; cost: number | null; location: string | null;
}
interface Mov {
  id: string; partId: string; type: string; quantity: number; reason: string | null;
  reference: string | null; cost: number | null; balance: number; createdByName: string | null;
  createdAt: string; part: { code: string; name: string; unit: string };
}

const CATEGORIES = ["FILTROS","FRENOS","MOTOR","ELECTRICO","SUSPENSION","LLANTAS","OTRO"];
const CAT_LABEL: Record<string,string> = { FILTROS:"Filtros", FRENOS:"Frenos", MOTOR:"Motor", ELECTRICO:"Eléctrico", SUSPENSION:"Suspensión", LLANTAS:"Llantas", OTRO:"Otro" };
const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
const EMPTY_PART = { code:"", name:"", category:"OTRO", brand:"", unit:"UND", stock:"", minStock:"", cost:"", location:"" };

export default function AlmacenClient({ parts: initialParts, movements: initialMovs, userRole }: {
  parts: Part[]; movements: Mov[]; userRole: string;
}) {
  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(userRole);
  const [tab, setTab] = useState<"catalogo" | "movimientos" | "critico">("catalogo");
  const [parts, setParts] = useState<Part[]>(initialParts);
  const [movs, setMovs] = useState<Mov[]>(initialMovs);
  const [search, setSearch] = useState("");

  const [showPart, setShowPart] = useState(false);
  const [partForm, setPartForm] = useState({ ...EMPTY_PART });
  const [showMov, setShowMov] = useState<null | "INGRESO" | "SALIDA">(null);
  const [movForm, setMovForm] = useState({ partId: "", quantity: "", reason: "", reference: "", cost: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => parts.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q);
  }), [parts, search]);

  const critical = parts.filter(p => p.stock <= p.minStock);
  const totalValor = parts.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);

  async function savePart() {
    if (!partForm.code || !partForm.name) { setError("Código y nombre son obligatorios"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/spare-parts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partForm) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setParts(p => [...p, saved].sort((a,b)=>a.name.localeCompare(b.name))); setShowPart(false); setPartForm({ ...EMPTY_PART }); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function saveMov() {
    if (!movForm.partId || !movForm.quantity) { setError("Repuesto y cantidad son obligatorios"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/stock-movements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...movForm, type: showMov }) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setMovs(m => [saved, ...m]);
      setParts(ps => ps.map(p => p.id === saved.partId ? { ...p, stock: saved.balance } : p));
      setShowMov(null); setMovForm({ partId: "", quantity: "", reason: "", reference: "", cost: "" });
    } else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function deletePart(id: string) {
    if (!confirm("¿Eliminar este repuesto y su historial?")) return;
    await fetch(`/api/spare-parts/${id}`, { method: "DELETE" });
    setParts(p => p.filter(x => x.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almacén de Repuestos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Catálogo, ingresos, salidas, kardex y stock crítico</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowMov("INGRESO")} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"><ArrowDownCircle size={16} /> Ingreso</button>
            <button onClick={() => setShowMov("SALIDA")} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"><ArrowUpCircle size={16} /> Salida</button>
            <button onClick={() => { setPartForm({ ...EMPTY_PART }); setError(""); setShowPart(true); }} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"><Plus size={16} /> Repuesto</button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Repuestos", value: parts.length, color: "bg-blue-500", icon: Boxes },
          { label: "Stock crítico", value: critical.length, color: "bg-red-500", icon: AlertTriangle },
          { label: "Valor inventario", value: money(totalValor), color: "bg-emerald-500", icon: Package },
          { label: "Movimientos", value: movs.length, color: "bg-indigo-500", icon: TrendingUp },
        ].map(k => { const I = k.icon; return (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><I size={18} className="text-white" /></div>
            <div><p className="text-base font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          </div>
        ); })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {([["catalogo","Catálogo"],["movimientos","Kardex / Movimientos"],["critico","Stock crítico"]] as const).map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {label}{k === "critico" && critical.length > 0 && <span className="ml-1 text-red-500 font-bold">({critical.length})</span>}
          </button>
        ))}
      </div>

      {/* Catálogo */}
      {tab === "catalogo" && (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, nombre o marca…" className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><Boxes size={36} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No hay repuestos registrados</p></div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Código","Repuesto","Categoría","Marca","Stock","Mín","Costo","Ubicación",""].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {filtered.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.stock <= p.minStock ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{p.code}</td>
                    <td className="px-4 py-3 text-gray-800">{p.name}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{CAT_LABEL[p.category ?? "OTRO"] ?? p.category}</span></td>
                    <td className="px-4 py-3 text-gray-600">{p.brand ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`font-bold ${p.stock <= p.minStock ? "text-red-600" : "text-gray-800"}`}>{p.stock} {p.unit}</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.minStock}</td>
                    <td className="px-4 py-3 text-gray-600">{p.cost != null ? money(p.cost) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.location ?? "—"}</td>
                    <td className="px-4 py-3">{["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole) && <button onClick={() => deletePart(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          )}
        </>
      )}

      {/* Movimientos / Kardex */}
      {tab === "movimientos" && (
        movs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><TrendingUp size={36} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sin movimientos registrados</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{["Fecha","Tipo","Repuesto","Cantidad","Saldo","Motivo","Referencia","Registró"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {movs.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</td>
                  <td className="px-4 py-3">{m.type === "INGRESO" ? <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><TrendingDown size={12} className="rotate-180"/>Ingreso</span> : <span className="flex items-center gap-1 text-amber-700 text-xs font-semibold"><TrendingDown size={12}/>Salida</span>}</td>
                  <td className="px-4 py-3"><span className="font-mono text-gray-700">{m.part.code}</span><p className="text-xs text-gray-400">{m.part.name}</p></td>
                  <td className={`px-4 py-3 font-bold ${m.type === "INGRESO" ? "text-green-600" : "text-amber-600"}`}>{m.type === "INGRESO" ? "+" : "−"}{m.quantity} {m.part.unit}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{m.balance} {m.part.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{m.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{m.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.createdByName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        )
      )}

      {/* Stock crítico */}
      {tab === "critico" && (
        critical.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><AlertTriangle size={36} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No hay repuestos en stock crítico ✓</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-red-500 text-white"><tr>{["Código","Repuesto","Stock actual","Stock mínimo","Faltante"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {critical.map(p => (
                <tr key={p.id} className="hover:bg-red-50/40">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{p.code}</td>
                  <td className="px-4 py-3 text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{p.stock} {p.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{p.minStock} {p.unit}</td>
                  <td className="px-4 py-3 font-semibold text-red-700">{Math.max(0, p.minStock - p.stock)} {p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        )
      )}

      {/* Modal nuevo repuesto */}
      {showPart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Nuevo Repuesto</h2><button onClick={() => setShowPart(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="overflow-y-auto flex-1 px-6 py-5 grid grid-cols-2 gap-4">
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Código *</label><input value={partForm.code} onChange={e => setPartForm(f => ({...f, code: e.target.value.toUpperCase()}))} placeholder="FIL-001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Unidad</label><input value={partForm.unit} onChange={e => setPartForm(f => ({...f, unit: e.target.value}))} placeholder="UND" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="col-span-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Nombre *</label><input value={partForm.name} onChange={e => setPartForm(f => ({...f, name: e.target.value}))} placeholder="Filtro de aceite" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Categoría</label><select value={partForm.category} onChange={e => setPartForm(f => ({...f, category: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">{CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Marca compatible</label><input value={partForm.brand} onChange={e => setPartForm(f => ({...f, brand: e.target.value}))} placeholder="Foton" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Stock inicial</label><input type="number" value={partForm.stock} onChange={e => setPartForm(f => ({...f, stock: e.target.value}))} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Stock mínimo</label><input type="number" value={partForm.minStock} onChange={e => setPartForm(f => ({...f, minStock: e.target.value}))} placeholder="5" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Costo unitario</label><input type="number" step="0.01" value={partForm.cost} onChange={e => setPartForm(f => ({...f, cost: e.target.value}))} placeholder="S/ 0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Ubicación</label><input value={partForm.location} onChange={e => setPartForm(f => ({...f, location: e.target.value}))} placeholder="Estante A-3" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={() => setShowPart(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={savePart} disabled={saving} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button></div>
          </div>
        </div>
      )}

      {/* Modal ingreso/salida */}
      {showMov && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">{showMov === "INGRESO" ? <ArrowDownCircle size={18} className="text-green-600"/> : <ArrowUpCircle size={18} className="text-amber-600"/>} Registrar {showMov === "INGRESO" ? "Ingreso" : "Salida"}</h2><button onClick={() => setShowMov(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Repuesto *</label><select value={movForm.partId} onChange={e => setMovForm(f => ({...f, partId: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Seleccionar repuesto</option>{parts.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} (stock: {p.stock})</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Cantidad *</label><input type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({...f, quantity: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                {showMov === "INGRESO" && <div><label className="text-xs font-semibold text-gray-700 block mb-1">Costo unit.</label><input type="number" step="0.01" value={movForm.cost} onChange={e => setMovForm(f => ({...f, cost: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Motivo</label><input value={movForm.reason} onChange={e => setMovForm(f => ({...f, reason: e.target.value}))} placeholder={showMov === "INGRESO" ? "Compra / devolución" : "Orden de trabajo / ajuste"} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Referencia (Nro OT / factura)</label><input value={movForm.reference} onChange={e => setMovForm(f => ({...f, reference: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={() => setShowMov(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={saveMov} disabled={saving} className={`flex-1 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 ${showMov === "INGRESO" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}`}>{saving ? "Guardando…" : "Registrar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
