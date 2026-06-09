"use client";
import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, X, AlertOctagon, Upload, Loader2, FileText, Truck, UserRound, Search, ExternalLink, Copy, Check } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

// Portales oficiales gratuitos de consulta por placa (Perú)
const PORTALES = [
  { name: "MTC — Consulta de Papeletas", desc: "Papeletas e infracciones a nivel nacional", url: "https://scppp.mtc.gob.pe/" },
  { name: "SUTRAN — Récord de Infracciones", desc: "Infracciones de transporte (desde 2020)", url: "https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/" },
  { name: "SAT Lima — Papeletas", desc: "Papeletas y multas de tránsito (Lima)", url: "https://www.sat.gob.pe/websitev9/TributosMultas/Papeletas/ConsultasPapeletas" },
  { name: "SAT Lima — Órdenes de Captura", desc: "Verifica si el vehículo tiene captura", url: "https://www.sat.gob.pe/VirtualSAT/modulos/Capturas.aspx" },
  { name: "SUNARP — Consulta Vehicular", desc: "Propietario, marca, modelo, alerta de robo", url: "https://consultavehicular.sunarp.gob.pe/consulta-vehicular" },
  { name: "APESEG — Consulta SOAT", desc: "Verifica el SOAT vigente del vehículo", url: "https://www.apeseg.org.pe/consultas-soat/" },
];

const TYPES: Record<string, string> = { PAPELETA: "Papeleta", INFRACCION: "Infracción", OTRO: "Otro" };
const STATUS: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  PAGADA:    { label: "Pagada",    color: "bg-green-100 text-green-700" },
  ANULADA:   { label: "Anulada",   color: "bg-gray-100 text-gray-500" },
};

interface Unit { id: string; plate: string; model: string }
interface Driver { id: string; name: string }
interface Sancion {
  id: string; unitId: string | null; driverId: string | null; type: string;
  description: string; amount: number | null; date: string; status: string; documentUrl: string | null;
  unit: { plate: string; model: string } | null; driver: { name: string } | null;
}

const EMPTY = { unitId: "", driverId: "", type: "PAPELETA", description: "", amount: "", date: new Date().toISOString().slice(0, 10), status: "PENDIENTE", documentUrl: "" };
const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default function SancionesClient({ sanciones: initial, units, drivers, userRole }: {
  sanciones: Sancion[]; units: Unit[]; drivers: Driver[]; userRole: string;
}) {
  const canDelete = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);
  const [sanciones, setSanciones] = useState<Sancion[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Consulta externa por placa
  const [showConsulta, setShowConsulta] = useState(false);
  const [consultaPlaca, setConsultaPlaca] = useState("");
  const [copied, setCopied] = useState(false);

  function copyPlaca() {
    if (!consultaPlaca) return;
    navigator.clipboard?.writeText(consultaPlaca.toUpperCase().trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }

  async function handleDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "sanciones");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("documentUrl", data.url); else setError(data.error ?? "Error al subir");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.description || !form.date) { setError("Descripción y fecha son obligatorias"); return; }
    if (!form.unitId && !form.driverId) { setError("Asocia la sanción a una unidad o conductor"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/sanciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); setSanciones(p => [saved, ...p]); setShowForm(false); }
    else { const d = await res.json(); setError(d.error ?? "Error al guardar"); }
  }

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/sanciones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { const saved = await res.json(); setSanciones(p => p.map(s => s.id === id ? saved : s)); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta sanción?")) return;
    await fetch(`/api/sanciones/${id}`, { method: "DELETE" });
    setSanciones(p => p.filter(s => s.id !== id));
  }

  const filtered = useMemo(() => sanciones.filter(s => filterStatus === "TODOS" || s.status === filterStatus), [sanciones, filterStatus]);
  const totalPendiente = sanciones.filter(s => s.status === "PENDIENTE").reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sanciones / Multas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Papeletas e infracciones por unidad y conductor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowConsulta(true)}
            className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Search size={16} /> Consultar Papeletas
          </button>
          <button onClick={() => { setForm({ ...EMPTY }); setError(""); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Registrar Sanción
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total sanciones", value: sanciones.length, color: "bg-blue-500" },
          { label: "Pendientes", value: sanciones.filter(s => s.status === "PENDIENTE").length, color: "bg-amber-500" },
          { label: "Pagadas", value: sanciones.filter(s => s.status === "PAGADA").length, color: "bg-green-500" },
          { label: "Monto pendiente", value: money(totalPendiente), color: "bg-red-500" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><AlertOctagon size={18} className="text-white" /></div>
            <div><p className="text-base font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <AlertOctagon size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay sanciones registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Fecha","Tipo","Unidad","Conductor","Descripción","Monto","Estado","Doc",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => {
                  const st = STATUS[s.status] ?? STATUS.PENDIENTE;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(s.date), "dd/MM/yyyy", { locale: es })}</td>
                      <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{TYPES[s.type] ?? s.type}</span></td>
                      <td className="px-4 py-3">{s.unit ? <span className="font-mono font-semibold text-gray-800 flex items-center gap-1"><Truck size={12} className="text-gray-400"/>{s.unit.plate}</span> : "—"}</td>
                      <td className="px-4 py-3">{s.driver ? <span className="text-gray-700 flex items-center gap-1"><UserRound size={12} className="text-gray-400"/>{s.driver.name}</span> : "—"}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{s.description}</td>
                      <td className="px-4 py-3 font-semibold">{s.amount != null ? money(s.amount) : "—"}</td>
                      <td className="px-4 py-3">
                        <select value={s.status} onChange={e => changeStatus(s.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${st.color}`}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">{s.documentUrl ? <button onClick={() => setPreview({ url: s.documentUrl!, name: `Sancion_${TYPES[s.type] ?? s.type}_${s.unit?.plate ?? s.driver?.name ?? ""}_${format(new Date(s.date), "yyyy-MM-dd")}` })} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><FileText size={12}/>Ver</button> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3">{canDelete && <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}</td>
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
              <h2 className="text-lg font-bold text-gray-900">Registrar Sanción</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad</label>
                  <select value={form.unitId} onChange={e => set("unitId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Ninguna —</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Conductor</label>
                  <select value={form.driverId} onChange={e => set("driverId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Ninguno —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Descripción / motivo *</label>
                  <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Ej: Exceso de velocidad en Av. Argentina"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Monto (S/)</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="Ej: 430.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Estado</label>
                  <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Documento (foto de la papeleta)</label>
                  {form.documentUrl ? (
                    <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                      <FileText size={16} className="text-green-600" />
                      <a href={form.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 font-medium flex-1 hover:underline">Documento cargado ✓</a>
                      <button onClick={() => set("documentUrl", "")} className="text-gray-400 hover:text-red-600"><X size={16}/></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-60">
                      {uploading ? <><Loader2 size={16} className="animate-spin"/> Subiendo…</> : <><Upload size={16}/> Subir documento</>}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="application/pdf,image/*" capture="environment" className="hidden" onChange={handleDoc} />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving || uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {preview && <FilePreview url={preview.url} filename={preview.name} title="Documento" onClose={() => setPreview(null)} />}

      {/* Modal consulta externa por placa */}
      {showConsulta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowConsulta(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Consultar Papeletas por Placa</h2>
                <p className="text-xs text-gray-400">Portales oficiales gratuitos (MTC, SUTRAN, SAT, SUNARP, SOAT)</p>
              </div>
              <button onClick={() => setShowConsulta(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Placa */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Placa a consultar</label>
                <div className="flex gap-2">
                  <select value={units.find(u => u.plate === consultaPlaca)?.id ?? ""} onChange={e => setConsultaPlaca(units.find(u => u.id === e.target.value)?.plate ?? "")}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Elegir unidad —</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                  </select>
                  <input value={consultaPlaca} onChange={e => setConsultaPlaca(e.target.value.toUpperCase())} placeholder="O escribe la placa"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={copyPlaca} disabled={!consultaPlaca} title="Copiar placa"
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 rounded-lg text-sm disabled:opacity-50">
                    {copied ? <><Check size={15} className="text-green-600" /> Copiado</> : <><Copy size={15} /> Copiar</>}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Copia la placa y pégala en el portal que abras (cada entidad pide resolver un CAPTCHA).</p>
              </div>

              {/* Portales */}
              <div className="space-y-2">
                {PORTALES.map(p => (
                  <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors group">
                    <div className="bg-blue-100 text-blue-700 p-2 rounded-lg shrink-0"><Search size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.desc}</p>
                    </div>
                    <ExternalLink size={16} className="text-gray-300 group-hover:text-blue-600 shrink-0" />
                  </a>
                ))}
              </div>

              <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                💡 Estos son los portales oficiales del Estado. Tras consultar, puedes <strong>registrar</strong> aquí las papeletas que encuentres con el botón <strong>“Registrar Sanción”</strong>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
