"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, FileText, Upload, Loader2, CheckCircle2, X, Save, Truck } from "lucide-react";
import { DRIVER_DOC_TYPES, docStatus, driverHabilitado, type DriverDoc } from "@/lib/driverDocs";

const LICENSE_CATEGORIES = ["A-I","A-IIa","A-IIb","A-IIIa","A-IIIb","A-IIIc","B-I","B-IIa","B-IIb","B-IIc"];

interface Profile {
  id: string; dni: string; firstName: string; lastName: string;
  licenseNumber: string; licenseCategory: string; licenseExpiry: string;
  phone: string | null; joinDate: string | null; status: string;
  driverType: string | null; photoUrl: string | null;
}
interface Driver {
  id: string; name: string; email: string;
  profile: Profile | null;
  documents: DriverDoc[];
  activeUnit: { id: string; plate: string; model: string } | null;
}

export default function DriverDetailClient({ driver, userRole }: { driver: Driver; userRole: string }) {
  const router = useRouter();
  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(userRole);
  const [tab, setTab] = useState<"basicos" | "documentos">("basicos");

  // Estado de documentos (local)
  const [docs, setDocs] = useState<DriverDoc[]>(driver.documents);
  const habilitado = driverHabilitado(docs);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/drivers" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <User size={22} className="text-blue-700" />
        <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${habilitado ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {habilitado ? "HABILITADO" : "INHABILITADO"}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-5 ml-9">{driver.email}</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([["basicos","Datos Básicos",User],["documentos","Documentos",FileText]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "basicos"
        ? <BasicData driver={driver} canEdit={canEdit} onSaved={() => router.refresh()} />
        : <Documents driverProfileId={driver.profile?.id ?? null} docs={docs} setDocs={setDocs} canEdit={canEdit} />}
    </div>
  );
}

/* ─────────── Datos Básicos ─────────── */
function BasicData({ driver, canEdit, onSaved }: { driver: Driver; canEdit: boolean; onSaved: () => void }) {
  const p = driver.profile;
  const [form, setForm] = useState({
    dni:             p?.dni ?? "",
    firstName:       p?.firstName ?? "",
    lastName:        p?.lastName ?? "",
    licenseNumber:   p?.licenseNumber ?? "",
    licenseCategory: p?.licenseCategory ?? "A-IIIb",
    licenseExpiry:   p?.licenseExpiry ? p.licenseExpiry.slice(0, 10) : "",
    phone:           p?.phone ?? "",
    joinDate:        p?.joinDate ? p.joinDate.slice(0, 10) : "",
    status:          p?.status ?? "ACTIVO",
    driverType:      p?.driverType ?? "CAMION",
    photoUrl:        p?.photoUrl ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "drivers");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("photoUrl", data.url); else setError(data.error ?? "Error al subir foto");
    if (photoRef.current) photoRef.current.value = "";
  }

  async function save() {
    if (!form.dni || !form.firstName || !form.lastName || !form.licenseNumber || !form.licenseExpiry) {
      setError("DNI, nombres, apellidos, licencia y vencimiento son obligatorios"); return;
    }
    setLoading(true); setError(""); setMsg("");
    const res = await fetch("/api/drivers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: driver.id, ...form }),
    });
    setLoading(false);
    if (res.ok) { setMsg("Datos guardados ✓"); onSaved(); }
    else { const d = await res.json(); setError(d.error ?? "Error al guardar"); }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div><label className="text-xs font-semibold text-gray-700 block mb-1">{label}</label>{node}</div>
  );
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50";

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">Datos Básicos</h2>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Foto */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-36 h-36 rounded-full bg-teal-600 overflow-hidden flex items-center justify-center">
            {form.photoUrl
              ? <img src={form.photoUrl} alt="foto" className="w-full h-full object-cover" />
              : <User size={64} className="text-teal-200" />}
          </div>
          {canEdit && (
            <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              {uploading ? <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Subiendo…</span> : "Cargar imagen"}
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Campos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          {field("N° Documento *", <input className={inp} value={form.dni} disabled={!canEdit} onChange={e => set("dni", e.target.value)} />)}
          {field("Nombres *", <input className={inp} value={form.firstName} disabled={!canEdit} onChange={e => set("firstName", e.target.value)} />)}
          {field("Apellidos *", <input className={inp} value={form.lastName} disabled={!canEdit} onChange={e => set("lastName", e.target.value)} />)}
          {field("N° Licencia *", <input className={inp} value={form.licenseNumber} disabled={!canEdit} onChange={e => set("licenseNumber", e.target.value)} />)}
          {field("Celular", <input className={inp} value={form.phone} disabled={!canEdit} onChange={e => set("phone", e.target.value)} />)}
          {field("Correo electrónico", <input className={inp} value={driver.email} disabled />)}
          {field("Categoría de licencia", (
            <select className={inp} value={form.licenseCategory} disabled={!canEdit} onChange={e => set("licenseCategory", e.target.value)}>
              {LICENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ))}
          {field("Venc. licencia *", <input type="date" className={inp} value={form.licenseExpiry} disabled={!canEdit} onChange={e => set("licenseExpiry", e.target.value)} />)}
          {field("Fecha de ingreso", <input type="date" className={inp} value={form.joinDate} disabled={!canEdit} onChange={e => set("joinDate", e.target.value)} />)}
          {field("Estado", (
            <select className={inp} value={form.status} disabled={!canEdit} onChange={e => set("status", e.target.value)}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          ))}
          {field("Tipo de Chofer", (
            <select className={inp} value={form.driverType} disabled={!canEdit} onChange={e => set("driverType", e.target.value)}>
              <option value="CAMION">Chofer de Camión</option>
              <option value="OTRO">Otro</option>
            </select>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      {msg && <p className="text-green-600 text-sm mt-4">{msg}</p>}

      {canEdit && (
        <div className="mt-5">
          <button onClick={save} disabled={loading}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
            <Save size={16} /> {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────── Documentos ─────────── */
function Documents({ driverProfileId, docs, setDocs, canEdit }: {
  driverProfileId: string | null; docs: DriverDoc[]; setDocs: (d: DriverDoc[]) => void; canEdit: boolean;
}) {
  if (!driverProfileId) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
        <FileText size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Primero completa y guarda los <strong>Datos Básicos</strong> del conductor.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-red-500 text-white">
            <tr>
              {["Estado","Descripción","Fecha Vigente","Adjuntar"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {DRIVER_DOC_TYPES.map(t => (
              <DocRow key={t.key} type={t.key} label={t.label} driverProfileId={driverProfileId}
                doc={docs.find(d => d.type === t.key)} canEdit={canEdit}
                onSaved={(saved) => {
                  const others = docs.filter(d => d.type !== t.key);
                  setDocs([...others, saved]);
                }} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocRow({ type, label, driverProfileId, doc, canEdit, onSaved }: {
  type: string; label: string; driverProfileId: string;
  doc?: DriverDoc; canEdit: boolean; onSaved: (d: DriverDoc) => void;
}) {
  const [expiry, setExpiry] = useState(doc?.expiryDate ? doc.expiryDate.slice(0, 10) : "");
  const [fileUrl, setFileUrl] = useState(doc?.fileUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const st = docStatus({ type, expiryDate: expiry || null, fileUrl: fileUrl || null });

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
    const res = await fetch("/api/driver-documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: driverProfileId, type, expiryDate: exp || null, fileUrl: url || null }),
    });
    setSaving(false);
    if (res.ok) { const saved = await res.json(); onSaved({ type, expiryDate: saved.expiryDate, fileUrl: saved.fileUrl, id: saved.id }); }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span className={`inline-block text-center min-w-[90px] text-xs font-bold px-3 py-1.5 rounded-full ${st.color}`}>{st.label}</span>
      </td>
      <td className="px-4 py-3 font-medium text-gray-800">{label}</td>
      <td className="px-4 py-3">
        <input type="date" value={expiry} disabled={!canEdit}
          onChange={e => setExpiry(e.target.value)}
          onBlur={() => canEdit && persist(fileUrl, expiry)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-600" /> Ver
            </a>
          )}
          {canEdit && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || saving}
              className="flex items-center gap-1 text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-600 rounded-lg px-2 py-1 transition-colors disabled:opacity-60">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {fileUrl ? "Cambiar" : "Subir"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </div>
      </td>
    </tr>
  );
}
