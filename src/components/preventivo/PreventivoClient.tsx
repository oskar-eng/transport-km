"use client";
import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, X, CalendarClock, Trash2, AlertTriangle, CheckCircle2, Clock, Truck } from "lucide-react";

interface Unit { id: string; plate: string; model: string; brand: string | null }
interface Plan {
  id: string; unitId: string; maintType: string; scheduledDate: string | null; scheduledKm: number | null;
  intervalKm: number | null; intervalDays: number | null; status: string; notes: string | null;
  unit: { plate: string; model: string; brand: string | null };
}

const EMPTY = { unitId:"", maintType:"A", scheduledDate:"", scheduledKm:"", intervalKm:"", intervalDays:"", notes:"" };

function planStatus(p: Plan) {
  if (p.status === "REALIZADO") return { label: "Realizado", color: "bg-green-500 text-white", urgent: false };
  if (p.status === "CANCELADO") return { label: "Cancelado", color: "bg-gray-300 text-gray-600", urgent: false };
  if (p.scheduledDate) {
    const days = differenceInDays(new Date(p.scheduledDate), new Date());
    if (days < 0) return { label: `Vencido ${Math.abs(days)}d`, color: "bg-red-500 text-white", urgent: true };
    if (days <= 7) return { label: `En ${days}d`, color: "bg-amber-400 text-amber-900", urgent: true };
    return { label: `En ${days}d`, color: "bg-blue-100 text-blue-700", urgent: false };
  }
  return { label: "Programado", color: "bg-blue-100 text-blue-700", urgent: false };
}

export default function PreventivoClient({ plans: initial, units, userRole }: { plans: Plan[]; units: Unit[]; userRole: string }) {
  const canEdit = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const [plans, setPlans] = useState<Plan[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(f:string,v:string){ setForm(p=>({...p,[f]:v})); }
  async function save() {
    if (!form.unitId) { setError("Selecciona la unidad"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/preventive-plans", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setPlans(p=>[...p,saved]); setShowForm(false); setForm({...EMPTY}); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }
  async function patch(id:string, status:string) { const res = await fetch(`/api/preventive-plans/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}); if(res.ok){const s=await res.json(); setPlans(p=>p.map(x=>x.id===id?s:x));} }
  async function del(id:string){ if(!confirm("¿Eliminar programación?"))return; await fetch(`/api/preventive-plans/${id}`,{method:"DELETE"}); setPlans(p=>p.filter(x=>x.id!==id)); }

  const alertas = plans.filter(p => planStatus(p).urgent && p.status === "PROGRAMADO");

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Programación Preventiva</h1><p className="text-sm text-gray-400 mt-0.5">Mantenimientos Tipo A/B/C programados por fecha y kilometraje</p></div>
        {canEdit && <button onClick={()=>{setForm({...EMPTY});setError("");setShowForm(true);}} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Programar</button>}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div><p className="text-sm font-semibold text-amber-800">{alertas.length} mantenimiento{alertas.length>1?"s":""} próximo{alertas.length>1?"s":""} o vencido{alertas.length>1?"s":""}</p>
            <p className="text-xs text-amber-700 mt-0.5">{alertas.slice(0,3).map(a=>`${a.unit.plate} (Tipo ${a.maintType})`).join(", ")}{alertas.length>3?` y ${alertas.length-3} más`:""}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {label:"Total",value:plans.length,color:"bg-blue-500"},
          {label:"Programados",value:plans.filter(p=>p.status==="PROGRAMADO").length,color:"bg-indigo-500"},
          {label:"Por vencer/vencidos",value:alertas.length,color:"bg-red-500"},
          {label:"Realizados",value:plans.filter(p=>p.status==="REALIZADO").length,color:"bg-green-500"},
        ].map(k=>(<div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"><div className={`${k.color} p-2.5 rounded-xl shrink-0`}><CalendarClock size={18} className="text-white"/></div><div><p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div></div>))}
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><CalendarClock size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay mantenimientos programados</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{["Unidad","Tipo","Fecha programada","Km programado","Intervalo","Estado",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {plans.map(p=>{ const st=planStatus(p); return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className="font-mono font-semibold text-gray-900 flex items-center gap-1"><Truck size={12} className="text-gray-400"/>{p.unit.plate}</span><p className="text-xs text-gray-400">{p.unit.brand} {p.unit.model}</p></td>
                <td className="px-4 py-3"><span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Tipo {p.maintType}</span></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.scheduledDate ? format(new Date(p.scheduledDate),"dd/MM/yyyy",{locale:es}) : "—"}</td>
                <td className="px-4 py-3 text-gray-600">{p.scheduledKm != null ? `${p.scheduledKm.toLocaleString()} km` : "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.intervalKm ? `c/${p.intervalKm.toLocaleString()} km` : ""}{p.intervalDays ? ` c/${p.intervalDays}d` : ""}{!p.intervalKm && !p.intervalDays ? "—" : ""}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${st.color}`}>{st.urgent && <Clock size={10}/>}{st.label}</span></td>
                <td className="px-4 py-3">
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {p.status === "PROGRAMADO" && <button onClick={()=>patch(p.id,"REALIZADO")} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="Marcar realizado"><CheckCircle2 size={14}/></button>}
                      {["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole) && <button onClick={()=>del(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}
                    </div>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table></div></div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Programar Mantenimiento</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label><select value={form.unitId} onChange={e=>set("unitId",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Seleccionar</option>{units.map(u=><option key={u.id} value={u.id}>{u.plate} — {u.brand} {u.model}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Tipo</label><select value={form.maintType} onChange={e=>set("maintType",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="A">Tipo A</option><option value="B">Tipo B</option><option value="C">Tipo C</option></select></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Fecha programada</label><input type="date" value={form.scheduledDate} onChange={e=>set("scheduledDate",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Km programado</label><input type="number" value={form.scheduledKm} onChange={e=>set("scheduledKm",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Intervalo (km)</label><input type="number" value={form.intervalKm} onChange={e=>set("intervalKm",e.target.value)} placeholder="10000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Notas</label><input value={form.notes} onChange={e=>set("notes",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Programar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
