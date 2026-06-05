"use client";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, X, ScrollText, Upload, Loader2, Trash2, Truck, Camera, PackageCheck } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

interface Unit { id: string; plate: string; model: string }
interface Req {
  id: string; numero: number; unitId: string | null; requestedByName: string | null; date: string;
  material: string; quantity: number; status: string; photoUrl: string | null;
  productPhotoUrl: string | null; receiptUrl: string | null; notes: string | null;
  unit: { plate: string; model: string } | null;
}

const EST: Record<string,{label:string;color:string}> = {
  PENDIENTE:{label:"Pendiente",color:"bg-amber-400 text-amber-900"}, APROBADA:{label:"Aprobada",color:"bg-blue-500 text-white"},
  ENTREGADA:{label:"Entregada",color:"bg-green-500 text-white"}, RECHAZADA:{label:"Rechazada",color:"bg-red-500 text-white"},
};
const EMPTY = { unitId:"", date:new Date().toISOString().slice(0,10), material:"", quantity:"1", photoUrl:"", notes:"" };

export default function SolicitudMaterialesClient({ requests: initial, units, userRole }: {
  requests: Req[]; units: Unit[]; userRole: string;
}) {
  const canManage = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const canDelete = ["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole);
  const [reqs, setReqs] = useState<Req[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [recibir, setRecibir] = useState<Req | null>(null); // modal recepción
  const fileRef = useRef<HTMLInputElement>(null);

  function set(f:string,v:string){ setForm(p=>({...p,[f]:v})); }

  async function uploadTo(file: File, folder: string) {
    const fd = new FormData(); fd.append("file", file); fd.append("folder", folder);
    const res = await fetch("/api/upload", { method:"POST", body: fd });
    return res.ok ? (await res.json()).url as string : null;
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); const url = await uploadTo(file, "materiales"); setUploading(false);
    if (url) set("photoUrl", url); if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.material || !form.date) { setError("Material y fecha son obligatorios"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/material-requests", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setReqs(p=>[saved,...p]); setShowForm(false); setForm({...EMPTY}); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function patch(id:string, body: Record<string,unknown>) {
    const res = await fetch(`/api/material-requests/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (res.ok) { const saved = await res.json(); setReqs(p=>p.map(r=>r.id===id?saved:r)); return saved; }
  }
  async function del(id:string){ if(!confirm("¿Eliminar solicitud?"))return; await fetch(`/api/material-requests/${id}`,{method:"DELETE"}); setReqs(p=>p.filter(r=>r.id!==id)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Solicitud de Materiales</h1><p className="text-sm text-gray-400 mt-0.5">Los mecánicos solicitan repuestos por unidad; al recibir se adjunta foto y comprobante</p></div>
        <button onClick={()=>{setForm({...EMPTY});setError("");setShowForm(true);}} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Nueva Solicitud</button>
      </div>

      {reqs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><ScrollText size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay solicitudes registradas</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{["Nro","Fecha","Unidad","Material","Cant.","Solicitó","Foto","Estado","Recepción",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {reqs.map(r=>{ const est=EST[r.status]??EST.PENDIENTE; return (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{r.numero}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(r.date),"dd/MM/yyyy",{locale:es})}</td>
                <td className="px-4 py-3">{r.unit?<span className="font-mono font-semibold text-gray-800 flex items-center gap-1"><Truck size={12} className="text-gray-400"/>{r.unit.plate}</span>:"—"}</td>
                <td className="px-4 py-3 text-gray-800">{r.material}</td>
                <td className="px-4 py-3 text-gray-600">{r.quantity}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.requestedByName ?? "—"}</td>
                <td className="px-4 py-3">{r.photoUrl?<button onClick={()=>setPreview(r.photoUrl)} className="text-xs text-blue-600 hover:underline">Ver</button>:<span className="text-gray-300 text-xs">—</span>}</td>
                <td className="px-4 py-3">{canManage ? <select value={r.status} onChange={e=>patch(r.id,{status:e.target.value})} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${est.color}`}>{Object.entries(EST).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select> : <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${est.color}`}>{est.label}</span>}</td>
                <td className="px-4 py-3">
                  {r.productPhotoUrl || r.receiptUrl ? (
                    <div className="flex gap-1">
                      {r.productPhotoUrl && <button onClick={()=>setPreview(r.productPhotoUrl)} className="text-xs text-green-600 hover:underline">Producto</button>}
                      {r.receiptUrl && <button onClick={()=>setPreview(r.receiptUrl)} className="text-xs text-blue-600 hover:underline">Comprob.</button>}
                    </div>
                  ) : canManage ? <button onClick={()=>setRecibir(r)} className="flex items-center gap-1 text-xs border border-green-300 text-green-700 hover:bg-green-50 rounded-lg px-2 py-1"><PackageCheck size={12}/> Recibir</button> : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">{canDelete && <button onClick={()=>del(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
              </tr>
            );})}
          </tbody>
        </table></div></div>
      )}

      {/* Modal nueva solicitud */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Nueva Solicitud de Material</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Unidad (¿en qué unidad se usará?)</label><select value={form.unitId} onChange={e=>set("unitId",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">— Seleccionar —</option>{units.map(u=><option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Cantidad</label><input type="number" value={form.quantity} onChange={e=>set("quantity",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Material / accesorio *</label><input value={form.material} onChange={e=>set("material",e.target.value)} placeholder="Ej: Pastillas de freno delanteras" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Foto del material/accesorio</label>
                {form.photoUrl ? <div className="flex items-center gap-2"><img src={form.photoUrl} alt="" className="w-20 h-16 object-cover rounded-lg border"/><button onClick={()=>set("photoUrl","")} className="text-xs text-red-600">Quitar</button></div>
                  : <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{uploading?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Camera size={15}/> Subir foto</>}</button>}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Notas</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving||uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Solicitar"}</button></div>
          </div>
        </div>
      )}

      {/* Modal recepción */}
      {recibir && <RecepcionModal req={recibir} onClose={()=>setRecibir(null)} onDone={(saved)=>{ setReqs(p=>p.map(r=>r.id===saved.id?saved:r)); setRecibir(null); }} uploadTo={uploadTo} patch={patch} />}

      {preview && <FilePreview url={preview} title="Documento" onClose={()=>setPreview(null)} />}
    </div>
  );
}

function RecepcionModal({ req, onClose, onDone, uploadTo, patch }: {
  req: Req; onClose: () => void; onDone: (r: Req) => void;
  uploadTo: (f: File, folder: string) => Promise<string | null>;
  patch: (id: string, body: Record<string, unknown>) => Promise<Req | undefined>;
}) {
  const [productPhotoUrl, setProductPhotoUrl] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [up, setUp] = useState<"" | "prod" | "rec">("");
  const [saving, setSaving] = useState(false);
  const prodRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>, which: "prod" | "rec") {
    const file = e.target.files?.[0]; if (!file) return;
    setUp(which); const url = await uploadTo(file, "materiales"); setUp("");
    if (url) { which === "prod" ? setProductPhotoUrl(url) : setReceiptUrl(url); }
  }
  async function confirmar() {
    setSaving(true);
    const saved = await patch(req.id, { status: "ENTREGADA", productPhotoUrl, receiptUrl });
    setSaving(false);
    if (saved) onDone(saved);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><PackageCheck size={18} className="text-green-600"/> Recepción de Material</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Material: <strong>{req.material}</strong></p>
          <div><label className="text-xs font-semibold text-gray-700 block mb-1">Foto del producto recibido</label>
            {productPhotoUrl ? <div className="flex items-center gap-2"><img src={productPhotoUrl} alt="" className="w-20 h-16 object-cover rounded-lg border"/><button onClick={()=>setProductPhotoUrl("")} className="text-xs text-red-600">Quitar</button></div>
              : <button type="button" onClick={()=>prodRef.current?.click()} disabled={up==="prod"} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:border-green-400 transition-colors disabled:opacity-60">{up==="prod"?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Camera size={15}/> Foto del producto</>}</button>}
            <input ref={prodRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>pick(e,"prod")}/></div>
          <div><label className="text-xs font-semibold text-gray-700 block mb-1">Comprobante / factura</label>
            {receiptUrl ? <div className="flex items-center gap-2 text-sm text-green-700"><PackageCheck size={15}/> Comprobante cargado <button onClick={()=>setReceiptUrl("")} className="text-xs text-red-600 ml-2">Quitar</button></div>
              : <button type="button" onClick={()=>recRef.current?.click()} disabled={up==="rec"} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{up==="rec"?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Upload size={15}/> Subir comprobante</>}</button>}
            <input ref={recRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e=>pick(e,"rec")}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={confirmar} disabled={saving} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-60">{saving?"Guardando…":"Marcar como recibido"}</button></div>
      </div>
    </div>
  );
}
