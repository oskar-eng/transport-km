"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container, FileText, Upload, Loader2, CheckCircle2, Save } from "lucide-react";
import { TRAILER_DOC_TYPES, trailerDocStatus, trailerHabilitado, type TrailerDoc } from "@/lib/trailerDocs";
import FilePreview from "@/components/common/FilePreview";

interface Trailer {
  id: string; plate: string; length: number | null; equipmentType: string | null;
  year: number; axles: number | null; tare: number | null; localType: string | null;
  status: string; photoUrl: string | null; documents: TrailerDoc[];
}

export default function TrailerDetailClient({ trailer, userRole }: { trailer: Trailer; userRole: string }) {
  const router = useRouter();
  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);
  const [tab, setTab] = useState<"basicos" | "documentos">("basicos");
  const [docs, setDocs] = useState<TrailerDoc[]>(trailer.documents);
  const habilitado = trailerHabilitado(docs);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href="/carretas" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <Container size={22} className="text-blue-700" />
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{trailer.plate}</h1>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${habilitado ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {habilitado ? "HABILITADO" : "DESHABILITADO"}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-5 ml-9">Carreta {trailer.equipmentType ? `· Tipo ${trailer.equipmentType}` : ""} · {trailer.year}</p>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([["basicos","Datos Básicos",Container],["documentos","Documentos",FileText]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "basicos"
        ? <BasicData trailer={trailer} canEdit={canEdit} onSaved={() => router.refresh()} />
        : <Documents trailerId={trailer.id} docs={docs} setDocs={setDocs} canEdit={canEdit} />}
    </div>
  );
}

function BasicData({ trailer, canEdit, onSaved }: { trailer: Trailer; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    plate: trailer.plate, length: trailer.length != null ? String(trailer.length) : "",
    equipmentType: trailer.equipmentType ?? "40", year: String(trailer.year),
    axles: trailer.axles != null ? String(trailer.axles) : "", tare: trailer.tare != null ? String(trailer.tare) : "",
    localType: trailer.localType ?? "Puerto/Deposito", photoUrl: trailer.photoUrl ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(""); const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "trailers");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("photoUrl", data.url);
    if (photoRef.current) photoRef.current.value = "";
  }

  async function save() {
    if (!form.plate || !form.year) { setError("Placa y año son obligatorios"); return; }
    setLoading(true); setError(""); setMsg("");
    const res = await fetch(`/api/trailers/${trailer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) { setMsg("Datos guardados ✓"); onSaved(); }
    else { const d = await res.json(); setError(d.error ?? "Error al guardar"); }
  }

  const field = (label: string, node: React.ReactNode) => (<div><label className="text-xs font-semibold text-gray-700 block mb-1">{label}</label>{node}</div>);
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50";

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">Datos Básicos</h2>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-40 h-32 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
            {form.photoUrl ? <img src={form.photoUrl} alt="foto" className="w-full h-full object-cover" /> : <Container size={48} className="text-gray-300" />}
          </div>
          {canEdit && (
            <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              {uploading ? <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Subiendo…</span> : "Cargar imagen"}
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          {field("Placa *", <input className={`${inp} font-mono uppercase`} value={form.plate} disabled={!canEdit} onChange={e => set("plate", e.target.value.toUpperCase())} />)}
          {field("Longitud (m)", <input type="number" className={inp} value={form.length} disabled={!canEdit} onChange={e => set("length", e.target.value)} />)}
          {field("Equipment Type", (
            <select className={inp} value={form.equipmentType} disabled={!canEdit} onChange={e => set("equipmentType", e.target.value)}>
              <option value="20">20</option><option value="40">40</option><option value="otro">Otro</option>
            </select>
          ))}
          {field("Año *", <input type="number" className={inp} value={form.year} disabled={!canEdit} onChange={e => set("year", e.target.value)} />)}
          {field("Nro Ejes", <input type="number" className={inp} value={form.axles} disabled={!canEdit} onChange={e => set("axles", e.target.value)} />)}
          {field("Tara (kg)", <input type="number" className={inp} value={form.tare} disabled={!canEdit} onChange={e => set("tare", e.target.value)} />)}
          {field("Tipo Local", (
            <select className={inp} value={form.localType} disabled={!canEdit} onChange={e => set("localType", e.target.value)}>
              <option value="Puerto/Deposito">Puerto/Deposito</option><option value="Almacen">Almacén</option><option value="Otro">Otro</option>
            </select>
          ))}
        </div>
      </div>
      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      {msg && <p className="text-green-600 text-sm mt-4">{msg}</p>}
      {canEdit && (
        <div className="mt-5">
          <button onClick={save} disabled={loading} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
            <Save size={16} /> {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Documents({ trailerId, docs, setDocs, canEdit }: { trailerId: string; docs: TrailerDoc[]; setDocs: (d: TrailerDoc[]) => void; canEdit: boolean }) {
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-red-500 text-white"><tr>{["Estado","Descripción","Fecha Vigente","Adjuntar"].map(h => (<th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">{h}</th>))}</tr></thead>
          <tbody className="divide-y">
            {TRAILER_DOC_TYPES.map(t => (
              <DocRow key={t.key} type={t.key} label={t.label} trailerId={trailerId} doc={docs.find(d => d.type === t.key)} canEdit={canEdit}
                onPreview={(url) => setPreview({ url, name: t.label })}
                onSaved={(saved) => setDocs([...docs.filter(d => d.type !== t.key), saved])} />
            ))}
          </tbody>
        </table>
      </div>
      {preview && <FilePreview url={preview.url} filename={preview.name} title="Documento de la carreta" onClose={() => setPreview(null)} />}
    </div>
  );
}

function DocRow({ type, label, trailerId, doc, canEdit, onSaved, onPreview }: {
  type: string; label: string; trailerId: string; doc?: TrailerDoc; canEdit: boolean; onSaved: (d: TrailerDoc) => void; onPreview: (url: string) => void;
}) {
  const [expiry, setExpiry] = useState(doc?.expiryDate ? doc.expiryDate.slice(0, 10) : "");
  const [fileUrl, setFileUrl] = useState(doc?.fileUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = trailerDocStatus({ type, expiryDate: expiry || null, fileUrl: fileUrl || null });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "documents");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) { setFileUrl(data.url); await persist(data.url, expiry); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function persist(url: string, exp: string) {
    setSaving(true);
    const res = await fetch("/api/trailer-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trailerId, type, expiryDate: exp || null, fileUrl: url || null }) });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); onSaved({ type, expiryDate: saved.expiryDate, fileUrl: saved.fileUrl, id: saved.id }); }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3"><span className={`inline-block text-center min-w-[90px] text-xs font-bold px-3 py-1.5 rounded-full ${st.color}`}>{st.label}</span></td>
      <td className="px-4 py-3 font-medium text-gray-800">{label}</td>
      <td className="px-4 py-3">
        <input type="date" value={expiry} disabled={!canEdit} onChange={e => setExpiry(e.target.value)} onBlur={() => canEdit && persist(fileUrl, expiry)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {fileUrl && <button type="button" onClick={() => onPreview(fileUrl)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><CheckCircle2 size={12} className="text-green-600" /> Ver</button>}
          {canEdit && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || saving} className="flex items-center gap-1 text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-600 rounded-lg px-2 py-1 transition-colors disabled:opacity-60">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}{fileUrl ? "Cambiar" : "Subir"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </div>
      </td>
    </tr>
  );
}
