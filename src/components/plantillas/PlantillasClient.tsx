"use client";
import { useState } from "react";
import { Plus, X, Layers, Trash2, Pencil } from "lucide-react";

interface Part { id: string; code: string; name: string; unit: string }
interface Item { id?: string; partId: string | null; partName: string; quantity: number }
interface Template { id: string; brand: string; type: string; name: string; notes: string | null; items: Item[] }

const TYPES = ["A","B","C","OTRO"];
const EMPTY = { brand:"", type:"A", name:"", notes:"" };

export default function PlantillasClient({ templates: initial, parts, userRole }: { templates: Template[]; parts: Part[]; userRole: string }) {
  const canEdit = ["ADMINISTRADOR","JEFE_TRANSPORTE","SUPERVISOR"].includes(userRole);
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() { setEditing(null); setForm({ ...EMPTY }); setItems([]); setError(""); setShowForm(true); }
  function openEdit(t: Template) { setEditing(t); setForm({ brand:t.brand, type:t.type, name:t.name, notes:t.notes ?? "" }); setItems(t.items.map(i=>({...i}))); setError(""); setShowForm(true); }

  function addItem() { setItems(p => [...p, { partId: null, partName: "", quantity: 1 }]); }
  function setItem(idx: number, field: string, value: string) {
    setItems(p => p.map((it,i) => {
      if (i !== idx) return it;
      if (field === "partId") { const part = parts.find(x=>x.id===value); return { ...it, partId: value || null, partName: part ? part.name : it.partName }; }
      if (field === "quantity") return { ...it, quantity: Number(value) };
      return { ...it, partName: value };
    }));
  }
  function removeItem(idx: number) { setItems(p => p.filter((_,i)=>i!==idx)); }

  async function save() {
    if (!form.brand || !form.type || !form.name) { setError("Marca, tipo y nombre son obligatorios"); return; }
    setSaving(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
    const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...form, items }) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setTemplates(p => editing ? p.map(t=>t.id===saved.id?saved:t) : [...p, saved]); setShowForm(false); }
    else { const d = await res.json(); setError(d.error ?? "Error"); }
  }
  async function del(id: string) { if(!confirm("¿Eliminar plantilla?"))return; await fetch(`/api/templates/${id}`,{method:"DELETE"}); setTemplates(p=>p.filter(t=>t.id!==id)); }

  // Agrupar por marca
  const byBrand = templates.reduce((acc, t) => { (acc[t.brand] ??= []).push(t); return acc; }, {} as Record<string, Template[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Plantillas de Mantenimiento</h1><p className="text-sm text-gray-400 mt-0.5">Define los materiales de cada tipo de mantenimiento por marca (ej: Foton Tipo A)</p></div>
        {canEdit && <button onClick={openNew} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Nueva Plantilla</button>}
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"><Layers size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No hay plantillas. Crea una para que las órdenes de trabajo carguen los materiales automáticamente.</p></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byBrand).map(([brand, tpls]) => (
            <div key={brand}>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">{brand}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tpls.map(t => (
                  <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div><span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Tipo {t.type}</span><p className="font-semibold text-gray-900 mt-1.5">{t.name}</p></div>
                      {canEdit && <div className="flex gap-1"><button onClick={()=>openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={13}/></button><button onClick={()=>del(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button></div>}
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1 mt-2">
                      {t.items.length === 0 ? <li className="text-gray-300 italic">Sin materiales</li> : t.items.map((it,i)=>(<li key={i} className="flex justify-between"><span>• {it.partName}</span><span className="text-gray-400">x{it.quantity}</span></li>))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">{editing ? "Editar" : "Nueva"} Plantilla</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Marca *</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="Foton" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Tipo *</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 block mb-1">Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Mantenimiento Preventivo Tipo A" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-xs font-semibold text-gray-700">Materiales / accesorios</label><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> Agregar</button></div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="text-xs text-gray-400 italic">Agrega los repuestos que se usan en este mantenimiento</p>}
                  {items.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={it.partId ?? ""} onChange={e=>setItem(idx,"partId",e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">— Manual / texto —</option>
                        {parts.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                      </select>
                      {!it.partId && <input value={it.partName} onChange={e=>setItem(idx,"partName",e.target.value)} placeholder="Nombre" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>}
                      <input type="number" value={it.quantity} onChange={e=>setItem(idx,"quantity",e.target.value)} className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                      <button type="button" onClick={()=>removeItem(idx)} className="text-gray-400 hover:text-red-600"><X size={15}/></button>
                    </div>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button onClick={save} disabled={saving} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving?"Guardando…":"Guardar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
