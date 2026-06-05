"use client";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, X, AlertTriangle, Upload, Loader2, Trash2, Truck, Camera } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

interface Unit { id: string; plate: string; model: string }
interface Incident {
  id: string; numero: number; unitId: string | null; driverName: string | null; date: string;
  description: string; severity: string; status: string; photoUrl: string | null;
  unit: { plate: string; model: string } | null;
}

const SEV: Record<string,{label:string;color:string}> = { BAJA:{label:"Baja",color:"bg-blue-100 text-blue-700"}, MEDIA:{label:"Media",color:"bg-amber-100 text-amber-700"}, ALTA:{label:"Alta",color:"bg-red-100 text-red-700"} };
const EST: Record<string,{label:string;color:string}> = { ABIERTA:{label:"Abierta",color:"bg-red-500 text-white"}, EN_REVISION:{label:"En revisión",color:"bg-amber-400 text-amber-900"}, RESUELTA:{label:"Resuelta",color:"bg-green-500 text-white"} };
const EMPTY = { unitId:"", date:new Date().toISOString().slice(0,10), description:"", severity:"MEDIA", photoUrl:"" };

export default function IncidenciasClient({ incidents: initial, units, userRole, defaultUnitId }: {
  incidents: Incident[]; units: Unit[]; userRole: string; defaultUnitId: string | null;
}) {
  const isDriver = userRole === "CONDUCTOR";
  const canManage = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const canDelete = ["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole);
  const [incidents, setIncidents] = useState<Incident[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, unitId: defaultUnitId ?? "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(f:string,v:string){ setForm(p=>({...p,[f]:v})); }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "incidencias");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("photoUrl", data.url);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.description || !form.date) { setError("Descripción y fecha son obligatorias"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/incidents", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setIncidents(p=>[saved,...p]); setShowForm(false); setForm({...EMPTY, unitId: defaultUnitId ?? ""}); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function changeStatus(id:string, status:string) {
    const res = await fetch(`/api/incidents/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({status}) });
    if (res.ok) { const saved = await res.json(); setIncidents(p=>p.map(i=>i.id===id?saved:i)); }
  }
  async function del(id:string) { if(!confirm("¿Eliminar incidencia?"))return; await fetch(`/api/incidents/${id}`,{method:"DELETE"}); setIncidents(p=>p.filter(i=>i.id!==id)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Incidencias de Conductores</h1><p className="text-sm text-gray-400 mt-0.5">Reportes con evidencia fotográfica y seguimiento</p></div>
        <button onClick={()=>{setForm({...EMPTY,unitId:defaultUnitId??""});setError("");setShowForm(true);}} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Reportar Incidencia</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {label:"Total",value:incidents.length,color:"bg-blue-500"},
          {label:"Abiertas",value:incidents.filter(i=>i.status==="ABIERTA").length,color:"bg-red-500"},
          {label:"En revisión",value:incidents.filter(i=>i.status==="EN_REVISION").length,color:"bg-amber-500"},
          {label:"Resueltas",value:incidents.filter(i=>i.status==="RESUELTA").length,color:"bg-green-500"},
        ].map(k=>(<div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"><div className={`${k.color} p-2.5 rounded-xl shrink-0`}><AlertTriangle size={18} className="text-white"/></div><div><p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div></div>))}
      </div>

      {incidents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><AlertTriangle size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay incidencias registradas</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{["Nro","Fecha","Unidad","Conductor","Descripción","Gravedad","Foto","Estado",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {incidents.map(i=>{ const sev=SEV[i.severity]??SEV.MEDIA; const est=EST[i.status]??EST.ABIERTA; return (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{i.numero}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(i.date),"dd/MM/yyyy",{locale:es})}</td>
                <td className="px-4 py-3">{i.unit?<span className="font-mono font-semibold text-gray-800 flex items-center gap-1"><Truck size={12} className="text-gray-400"/>{i.unit.plate}</span>:"—"}</td>
                <td className="px-4 py-3 text-gray-700">{i.driverName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{i.description}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.color}`}>{sev.label}</span></td>
                <td className="px-4 py-3">{i.photoUrl?<button onClick={()=>setPreview(i.photoUrl)} className="text-xs text-blue-600 hover:underline">Ver foto</button>:<span className="text-gray-300 text-xs">—</span>}</td>
                <td className="px-4 py-3">{canManage ? <select value={i.status} onChange={e=>changeStatus(i.id,e.target.value)} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${est.color}`}>{Object.entries(EST).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select> : <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${est.color}`}>{est.label}</span>}</td>
                <td className="px-4 py-3">{canDelete && <button onClick={()=>del(i.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
              </tr>
            );})}
          </tbody>
        </table></div></div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Reportar Incidencia</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Unidad</label><select value={form.unitId} onChange={e=>set("unitId",e.target.value)} disabled={isDriver && !!defaultUnitId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"><option value="">— Seleccionar —</option>{units.map(u=><option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Gravedad</label><select value={form.severity} onChange={e=>set("severity",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">{Object.entries(SEV).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Descripción *</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Describe la falla o incidencia…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Foto (evidencia)</label>
                {form.photoUrl ? <div className="flex items-center gap-2"><img src={form.photoUrl} alt="" className="w-20 h-16 object-cover rounded-lg border"/><button onClick={()=>set("photoUrl","")} className="text-xs text-red-600">Quitar</button></div>
                  : <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{uploading?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Camera size={15}/> Subir foto</>}</button>}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving||uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Reportar"}</button></div>
          </div>
        </div>
      )}
      {preview && <FilePreview url={preview} title="Evidencia" onClose={()=>setPreview(null)} />}
    </div>
  );
}
