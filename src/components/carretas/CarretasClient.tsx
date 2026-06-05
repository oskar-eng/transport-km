"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Container, X, Upload, Loader2, ExternalLink } from "lucide-react";
import { trailerHabilitado, type TrailerDoc } from "@/lib/trailerDocs";

interface Trailer {
  id: string; plate: string; length: number | null; equipmentType: string | null;
  year: number; axles: number | null; tare: number | null; localType: string | null;
  status: string; photoUrl: string | null; documents: TrailerDoc[];
}

const EMPTY = { plate: "", length: "", equipmentType: "40", year: String(new Date().getFullYear()), axles: "", tare: "", localType: "Puerto/Deposito", photoUrl: "", notes: "" };

export default function CarretasClient({ trailers: initial, userRole }: { trailers: Trailer[]; userRole: string }) {
  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);
  const [trailers, setTrailers] = useState<Trailer[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "trailers");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("photoUrl", data.url);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!form.plate || !form.year) { setError("Placa y año son obligatorios"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/trailers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setTrailers(p => [...p, { ...saved, documents: [] }]);
      setShowForm(false); setForm({ ...EMPTY });
    } else { const d = await res.json(); setError(d.error ?? "Error al guardar"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carretas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Remolques / semirremolques y su documentación</p>
        </div>
        {canEdit && (
          <button onClick={() => { setForm({ ...EMPTY }); setError(""); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Nueva Carreta
          </button>
        )}
      </div>

      {trailers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <Container size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay carretas registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trailers.map(t => {
            const habilitado = trailerHabilitado(t.documents);
            return (
              <div key={t.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="h-32 bg-gray-100 relative">
                  {t.photoUrl
                    ? <Image src={t.photoUrl} alt={t.plate} fill className="object-cover" />
                    : <div className="flex items-center justify-center h-full"><Container size={40} className="text-gray-300" /></div>}
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${habilitado ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                      {habilitado ? "Habilitado" : "Deshabilitado"}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-bold text-gray-900 font-mono text-lg">{t.plate}</p>
                  <p className="text-sm text-gray-600">{t.equipmentType ? `Tipo ${t.equipmentType}` : ""} · {t.year}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
                    {t.length != null && <span>Longitud: <strong>{t.length} m</strong></span>}
                    {t.axles != null && <span>Ejes: <strong>{t.axles}</strong></span>}
                    {t.tare != null && <span>Tara: <strong>{t.tare} kg</strong></span>}
                    {t.localType && <span className="truncate">{t.localType}</span>}
                  </div>
                  <Link href={`/carretas/${t.id}`}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg py-2 transition-colors">
                    <ExternalLink size={13} /> Gestionar documentos
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva carreta */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva Carreta</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Placa *</label>
                  <input value={form.plate} onChange={e => set("plate", e.target.value.toUpperCase())} placeholder="D9S985"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Año *</label>
                  <input type="number" value={form.year} onChange={e => set("year", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Longitud (m)</label>
                  <input type="number" value={form.length} onChange={e => set("length", e.target.value)} placeholder="12.19"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Equipment Type</label>
                  <select value={form.equipmentType} onChange={e => set("equipmentType", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="20">20</option><option value="40">40</option><option value="otro">Otro</option>
                  </select></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Nro Ejes</label>
                  <input type="number" value={form.axles} onChange={e => set("axles", e.target.value)} placeholder="3"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="text-xs font-semibold text-gray-700 block mb-1">Tara (kg)</label>
                  <input type="number" value={form.tare} onChange={e => set("tare", e.target.value)} placeholder="3500"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Tipo Local</label>
                  <select value={form.localType} onChange={e => set("localType", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Puerto/Deposito">Puerto/Deposito</option><option value="Almacen">Almacén</option><option value="Otro">Otro</option>
                  </select></div>
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Foto</label>
                  {form.photoUrl
                    ? <div className="flex items-center gap-2"><img src={form.photoUrl} alt="" className="w-16 h-12 object-cover rounded" /><button onClick={() => set("photoUrl","")} className="text-xs text-red-600">Quitar</button></div>
                    : <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:border-blue-400 transition-colors disabled:opacity-60">{uploading ? <><Loader2 size={15} className="animate-spin"/> Subiendo…</> : <><Upload size={15}/> Subir foto</>}</button>}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} /></div>
              </div>
              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving || uploading} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
