"use client";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, X, ShoppingCart, Trash2, Upload, Loader2, FileText } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

interface Item { partName: string; quantity: number; unitCost: number | null }
interface PO {
  id: string; numero: number; supplier: string; status: string; date: string;
  description: string | null; total: number | null; receiptUrl: string | null; createdByName: string | null; items: Item[];
}

const EST: Record<string,{label:string;color:string}> = {
  SOLICITUD:{label:"Solicitud",color:"bg-gray-200 text-gray-700"}, COTIZADO:{label:"Cotizado",color:"bg-blue-400 text-white"},
  ORDENADO:{label:"Ordenado",color:"bg-amber-400 text-amber-900"}, RECIBIDO:{label:"Recibido",color:"bg-green-500 text-white"}, ANULADO:{label:"Anulado",color:"bg-red-400 text-white"},
};
const money = (n: number) => `S/ ${n.toLocaleString("es-PE",{minimumFractionDigits:2})}`;
const EMPTY = { supplier:"", date:new Date().toISOString().slice(0,10), description:"", notes:"" };

export default function ComprasClient({ purchases: initial, userRole }: { purchases: PO[]; userRole: string }) {
  const canEdit = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const [pos, setPos] = useState<PO[]>(initial);
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState<PO | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [items, setItems] = useState<Item[]>([]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addItem(){ setItems(p=>[...p,{partName:"",quantity:1,unitCost:null}]); }
  function setItem(idx:number,field:string,value:string){ setItems(p=>p.map((it,i)=>i!==idx?it:(field==="quantity"?{...it,quantity:Number(value)}:field==="unitCost"?{...it,unitCost:value?Number(value):null}:{...it,partName:value}))); }
  function removeItem(idx:number){ setItems(p=>p.filter((_,i)=>i!==idx)); }
  const total = items.reduce((s,i)=>s+(i.unitCost??0)*i.quantity,0);

  async function handleReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "compras");
    const res = await fetch("/api/upload", { method:"POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) setReceiptUrl(data.url); if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.supplier || !form.date) { setError("Proveedor y fecha son obligatorios"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/purchases", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...form, items, receiptUrl }) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setPos(p=>[saved,...p]); setShow(false); setForm({...EMPTY}); setItems([]); setReceiptUrl(""); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }
  async function patch(id:string,status:string){ const res=await fetch(`/api/purchases/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}); if(res.ok){const s=await res.json(); setPos(p=>p.map(x=>x.id===id?s:x)); if(detail?.id===id)setDetail(s);} }
  async function del(id:string){ if(!confirm("¿Eliminar compra?"))return; await fetch(`/api/purchases/${id}`,{method:"DELETE"}); setPos(p=>p.filter(x=>x.id!==id)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Compras / Requerimientos</h1><p className="text-sm text-gray-400 mt-0.5">Solicitudes, cotizaciones, órdenes de compra, recepción y proveedores</p></div>
        {canEdit && <button onClick={()=>{setForm({...EMPTY});setItems([]);setReceiptUrl("");setError("");setShow(true);}} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Nueva Compra</button>}
      </div>

      {pos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><ShoppingCart size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay compras registradas</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{["Nro","Fecha","Proveedor","Ítems","Total","Estado","Comprob.",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {pos.map(p=>{ const est=EST[p.status]??EST.SOLICITUD; return (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={()=>setDetail(p)}>
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">OC-{p.numero}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(p.date),"dd/MM/yyyy",{locale:es})}</td>
                <td className="px-4 py-3 text-gray-800">{p.supplier}</td>
                <td className="px-4 py-3 text-gray-600">{p.items.length}</td>
                <td className="px-4 py-3 font-semibold">{p.total!=null?money(p.total):"—"}</td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>{canEdit ? <select value={p.status} onChange={e=>patch(p.id,e.target.value)} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${est.color}`}>{Object.entries(EST).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select> : <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${est.color}`}>{est.label}</span>}</td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>{p.receiptUrl?<button onClick={()=>setPreview(p.receiptUrl)} className="text-xs text-blue-600 hover:underline">Ver</button>:<span className="text-gray-300 text-xs">—</span>}</td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>{["ADMINISTRADOR","JEFE_TRANSPORTE"].includes(userRole) && <button onClick={()=>del(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
              </tr>
            );})}
          </tbody>
        </table></div></div>
      )}

      {/* Modal nueva compra */}
      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Nueva Compra / Requerimiento</h2><button onClick={()=>setShow(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Proveedor *</label><input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Descripción</label><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-xs font-semibold text-gray-700">Ítems</label><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> Agregar</button></div>
                <div className="space-y-2">
                  {items.length===0 && <p className="text-xs text-gray-400 italic">Agrega los productos a comprar</p>}
                  {items.map((it,idx)=>(<div key={idx} className="flex gap-2 items-center">
                    <input value={it.partName} onChange={e=>setItem(idx,"partName",e.target.value)} placeholder="Producto" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <input type="number" value={it.quantity} onChange={e=>setItem(idx,"quantity",e.target.value)} className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" title="Cant."/>
                    <input type="number" step="0.01" value={it.unitCost??""} onChange={e=>setItem(idx,"unitCost",e.target.value)} placeholder="P.U." className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"/>
                    <button type="button" onClick={()=>removeItem(idx)} className="text-gray-400 hover:text-red-600"><X size={15}/></button>
                  </div>))}
                </div>
                {items.length>0 && <p className="text-right text-sm font-semibold mt-2">Total: {money(total)}</p>}
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Comprobante / factura</label>
                {receiptUrl ? <div className="flex items-center gap-2 text-sm text-green-700"><FileText size={15}/> Cargado <button onClick={()=>setReceiptUrl("")} className="text-xs text-red-600 ml-2">Quitar</button></div>
                  : <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{uploading?<><Loader2 size={15} className="animate-spin"/> Subiendo…</>:<><Upload size={15}/> Subir comprobante</>}</button>}
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleReceipt}/></div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShow(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving||uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Guardar"}</button></div>
          </div>
        </div>
      )}

      {/* Detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">OC-{detail.numero}</h2><button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="px-6 py-5 space-y-2 text-sm">
              <p><span className="text-gray-400 text-xs">Proveedor:</span> <strong>{detail.supplier}</strong></p>
              <p><span className="text-gray-400 text-xs">Fecha:</span> {format(new Date(detail.date),"dd/MM/yyyy",{locale:es})}</p>
              {detail.description && <p><span className="text-gray-400 text-xs">Descripción:</span> {detail.description}</p>}
              <div className="pt-2"><p className="text-gray-400 text-xs mb-1">Ítems:</p><ul className="text-xs space-y-1">{detail.items.map((it,i)=><li key={i} className="flex justify-between border-b border-gray-50 py-0.5"><span>• {it.partName} x{it.quantity}</span>{it.unitCost!=null&&<span className="text-gray-500">{money(it.unitCost*it.quantity)}</span>}</li>)}</ul></div>
              {detail.total!=null && <p className="flex justify-between font-bold text-blue-800 border-t pt-1"><span>Total:</span><span>{money(detail.total)}</span></p>}
              {detail.receiptUrl && <button onClick={()=>setPreview(detail.receiptUrl)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><FileText size={12}/> Ver comprobante</button>}
            </div>
          </div>
        </div>
      )}
      {preview && <FilePreview url={preview} title="Comprobante" onClose={()=>setPreview(null)} />}
    </div>
  );
}
