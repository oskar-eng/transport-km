"use client";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, X, ClipboardCheck, Trash2, Upload, Loader2, Wrench, Camera, FileDown, CheckCircle2 } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

interface Unit { id: string; plate: string; model: string; brand: string | null }
interface Part { id: string; code: string; name: string; unit: string; stock: number; cost: number | null }
interface Material { partId: string | null; partName: string; quantity: number; unitCost: number | null }
interface WO {
  id: string; numero: number; unitId: string; type: string; maintType: string | null; status: string;
  description: string | null; diagnosis: string | null; mechanic: string | null; laborCost: number | null;
  odometer: number | null; evidenceUrl: string | null; testsDone: string | null;
  openedAt: string; closedAt: string | null; unit: { plate: string; model: string; brand: string | null }; materials: Material[];
}

const EST: Record<string,{label:string;color:string}> = { ABIERTA:{label:"Abierta",color:"bg-blue-500 text-white"}, EN_PROCESO:{label:"En proceso",color:"bg-amber-400 text-amber-900"}, CERRADA:{label:"Cerrada",color:"bg-green-500 text-white"} };
const money = (n: number) => `S/ ${n.toLocaleString("es-PE",{minimumFractionDigits:2})}`;

export default function OrdenesTrabajoClient({ workOrders: initial, units, parts, userRole }: {
  workOrders: WO[]; units: Unit[]; parts: Part[]; userRole: string;
}) {
  const canEdit = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const [wos, setWos] = useState<WO[]>(initial);
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState<WO | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ unitId:"", type:"PREVENTIVO", maintType:"A", description:"", diagnosis:"", mechanic:"", laborCost:"", odometer:"", testsDone:"", evidenceUrl:"" });
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedUnit = units.find(u => u.id === form.unitId);

  function openNew() { setForm({ unitId:"", type:"PREVENTIVO", maintType:"A", description:"", diagnosis:"", mechanic:"", laborCost:"", odometer:"", testsDone:"", evidenceUrl:"" }); setMaterials([]); setError(""); setShow(true); }

  async function cargarPlantilla() {
    if (!selectedUnit?.brand) { setError("La unidad no tiene marca registrada para buscar plantilla"); return; }
    setLoadingTpl(true); setError("");
    const res = await fetch(`/api/templates?brand=${encodeURIComponent(selectedUnit.brand)}&type=${form.maintType}`);
    setLoadingTpl(false);
    if (res.ok) {
      const tpls = await res.json();
      if (tpls.length === 0) { setError(`No hay plantilla para ${selectedUnit.brand} Tipo ${form.maintType}`); return; }
      const items = tpls[0].items.map((i: { partId: string|null; partName: string; quantity: number }) => {
        const part = i.partId ? parts.find(p=>p.id===i.partId) : null;
        return { partId: i.partId, partName: i.partName, quantity: i.quantity, unitCost: part?.cost ?? null };
      });
      setMaterials(items);
    }
  }

  function addMat() { setMaterials(p => [...p, { partId:null, partName:"", quantity:1, unitCost:null }]); }
  function setMat(idx:number, field:string, value:string) {
    setMaterials(p => p.map((m,i)=>{ if(i!==idx)return m;
      if(field==="partId"){ const part=parts.find(x=>x.id===value); return {...m, partId:value||null, partName:part?part.name:m.partName, unitCost:part?.cost??m.unitCost}; }
      if(field==="quantity")return {...m,quantity:Number(value)};
      if(field==="unitCost")return {...m,unitCost:value?Number(value):null};
      return {...m,partName:value};
    }));
  }
  function removeMat(idx:number){ setMaterials(p=>p.filter((_,i)=>i!==idx)); }

  async function handleEvidence(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "ot");
    const res = await fetch("/api/upload", { method:"POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) setForm(f=>({...f, evidenceUrl:data.url}));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.unitId) { setError("Selecciona la unidad"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/work-orders", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...form, materials }) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setWos(p=>[saved,...p]); setShow(false); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function patch(id:string, body:Record<string,unknown>) {
    const res = await fetch(`/api/work-orders/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (res.ok) { const saved = await res.json(); setWos(p=>p.map(w=>w.id===id?saved:w)); if(detail?.id===id) setDetail(saved); }
  }
  async function del(id:string){ if(!confirm("¿Eliminar OT?"))return; await fetch(`/api/work-orders/${id}`,{method:"DELETE"}); setWos(p=>p.filter(w=>w.id!==id)); }

  const matTotal = (m: Material[]) => m.reduce((s,x)=>s+(x.unitCost??0)*x.quantity,0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1><p className="text-sm text-gray-400 mt-0.5">Preventivas y correctivas — materiales descuentan del almacén</p></div>
        {canEdit && <button onClick={openNew} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Nueva OT</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {label:"Total OT",value:wos.length,color:"bg-blue-500"},
          {label:"Abiertas",value:wos.filter(w=>w.status==="ABIERTA").length,color:"bg-blue-400"},
          {label:"En proceso",value:wos.filter(w=>w.status==="EN_PROCESO").length,color:"bg-amber-500"},
          {label:"Cerradas",value:wos.filter(w=>w.status==="CERRADA").length,color:"bg-green-500"},
        ].map(k=>(<div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"><div className={`${k.color} p-2.5 rounded-xl shrink-0`}><ClipboardCheck size={18} className="text-white"/></div><div><p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div></div>))}
      </div>

      {wos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><ClipboardCheck size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay órdenes de trabajo</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{["OT","Fecha","Unidad","Tipo","Mecánico","Materiales","Estado",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {wos.map(w=>{ const est=EST[w.status]??EST.ABIERTA; return (
              <tr key={w.id} className="hover:bg-gray-50 cursor-pointer" onClick={()=>setDetail(w)}>
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">OT-{w.numero}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(w.openedAt),"dd/MM/yyyy",{locale:es})}</td>
                <td className="px-4 py-3"><span className="font-mono font-semibold text-gray-900">{w.unit.plate}</span><p className="text-xs text-gray-400">{w.unit.brand} {w.unit.model}</p></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${w.type==="PREVENTIVO"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700"}`}>{w.type === "PREVENTIVO" ? `Preventivo ${w.maintType ?? ""}` : "Correctivo"}</span></td>
                <td className="px-4 py-3 text-gray-600">{w.mechanic ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{w.materials.length} ítems</td>
                <td className="px-4 py-3"><span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${est.color}`}>{est.label}</span></td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>{["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole) && <button onClick={()=>del(w.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
              </tr>
            );})}
          </tbody>
        </table></div></div>
      )}

      {/* Modal nueva OT */}
      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Nueva Orden de Trabajo</h2><button onClick={()=>setShow(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label><select value={form.unitId} onChange={e=>setForm(f=>({...f,unitId:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Seleccionar unidad</option>{units.map(u=><option key={u.id} value={u.id}>{u.plate} — {u.brand} {u.model}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Tipo *</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="PREVENTIVO">Preventivo</option><option value="CORRECTIVO">Correctivo</option></select></div>
                {form.type === "PREVENTIVO" && (
                  <div><label className="text-xs font-semibold text-gray-700 block mb-1">Tipo de mantenimiento</label>
                    <div className="flex gap-2"><select value={form.maintType} onChange={e=>setForm(f=>({...f,maintType:e.target.value}))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="A">Tipo A</option><option value="B">Tipo B</option><option value="C">Tipo C</option></select>
                    <button type="button" onClick={cargarPlantilla} disabled={loadingTpl || !form.unitId} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 rounded-lg disabled:opacity-50 whitespace-nowrap flex items-center gap-1">{loadingTpl?<Loader2 size={12} className="animate-spin"/>:<FileDown size={12}/>} Cargar plantilla</button></div>
                  </div>
                )}
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Odómetro (km)</label><input type="number" value={form.odometer} onChange={e=>setForm(f=>({...f,odometer:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Mecánico</label><input value={form.mechanic} onChange={e=>setForm(f=>({...f,mechanic:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Mano de obra (S/)</label><input type="number" step="0.01" value={form.laborCost} onChange={e=>setForm(f=>({...f,laborCost:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Descripción del trabajo</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Diagnóstico mecánico</label><textarea value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>

              {/* Materiales */}
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-xs font-semibold text-gray-700">Materiales utilizados (descuentan del almacén)</label><button type="button" onClick={addMat} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> Agregar</button></div>
                <div className="space-y-2">
                  {materials.length === 0 && <p className="text-xs text-gray-400 italic">Carga una plantilla o agrega materiales manualmente</p>}
                  {materials.map((m,idx)=>(
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={m.partId??""} onChange={e=>setMat(idx,"partId",e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">— Manual / texto —</option>{parts.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name} (stock {p.stock})</option>)}
                      </select>
                      {!m.partId && <input value={m.partName} onChange={e=>setMat(idx,"partName",e.target.value)} placeholder="Nombre" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>}
                      <input type="number" value={m.quantity} onChange={e=>setMat(idx,"quantity",e.target.value)} className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" title="Cantidad"/>
                      <button type="button" onClick={()=>removeMat(idx)} className="text-gray-400 hover:text-red-600"><X size={15}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Pruebas realizadas</label><input value={form.testsDone} onChange={e=>setForm(f=>({...f,testsDone:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Evidencia fotográfica</label>
                {form.evidenceUrl ? <div className="flex items-center gap-2"><img src={form.evidenceUrl} alt="" className="w-20 h-16 object-cover rounded-lg border"/><button onClick={()=>setForm(f=>({...f,evidenceUrl:""}))} className="text-xs text-red-600">Quitar</button></div>
                  : <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{uploading?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Camera size={15}/> Subir foto</>}</button>}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEvidence}/></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShow(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving||uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Crear OT"}</button></div>
          </div>
        </div>
      )}

      {/* Modal detalle OT */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">OT-{detail.numero}</h2><div className="flex items-center gap-2"><span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${EST[detail.status]?.color}`}>{EST[detail.status]?.label}</span><button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div></div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3 text-sm">
              <p><span className="text-gray-400 text-xs">Unidad:</span> <strong>{detail.unit.plate}</strong> · {detail.unit.brand} {detail.unit.model}</p>
              <p><span className="text-gray-400 text-xs">Tipo:</span> {detail.type === "PREVENTIVO" ? `Preventivo Tipo ${detail.maintType}` : "Correctivo"}</p>
              {detail.mechanic && <p><span className="text-gray-400 text-xs">Mecánico:</span> {detail.mechanic}</p>}
              {detail.odometer && <p><span className="text-gray-400 text-xs">Odómetro:</span> {detail.odometer.toLocaleString()} km</p>}
              {detail.description && <p><span className="text-gray-400 text-xs">Trabajo:</span> {detail.description}</p>}
              {detail.diagnosis && <p><span className="text-gray-400 text-xs">Diagnóstico:</span> {detail.diagnosis}</p>}
              {detail.testsDone && <p><span className="text-gray-400 text-xs">Pruebas:</span> {detail.testsDone}</p>}
              <div><p className="text-gray-400 text-xs mb-1">Materiales:</p>{detail.materials.length===0?<p className="text-gray-300 italic text-xs">Sin materiales</p>:<ul className="text-xs space-y-1">{detail.materials.map((m,i)=><li key={i} className="flex justify-between border-b border-gray-50 py-0.5"><span>• {m.partName} x{m.quantity}</span>{m.unitCost!=null && <span className="text-gray-500">{money(m.unitCost*m.quantity)}</span>}</li>)}</ul>}</div>
              <div className="flex justify-between font-semibold pt-1"><span>Total materiales:</span><span>{money(matTotal(detail.materials))}</span></div>
              {detail.laborCost != null && <div className="flex justify-between"><span className="text-gray-500">Mano de obra:</span><span>{money(detail.laborCost)}</span></div>}
              <div className="flex justify-between font-bold text-blue-800 border-t pt-1"><span>TOTAL OT:</span><span>{money(matTotal(detail.materials) + (detail.laborCost ?? 0))}</span></div>
              {detail.evidenceUrl && <button onClick={()=>setPreview(detail.evidenceUrl)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Camera size={12}/> Ver evidencia</button>}
            </div>
            {canEdit && detail.status !== "CERRADA" && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                {detail.status === "ABIERTA" && <button onClick={()=>patch(detail.id,{status:"EN_PROCESO"})} className="flex-1 bg-amber-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-600">Marcar en proceso</button>}
                <button onClick={()=>patch(detail.id,{status:"CERRADA"})} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle2 size={15}/> Cerrar OT</button>
              </div>
            )}
          </div>
        </div>
      )}
      {preview && <FilePreview url={preview} title="Evidencia OT" onClose={()=>setPreview(null)} />}
    </div>
  );
}
