"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, FileText, Upload, Loader2, CheckCircle2, Save, History, Package, Wrench, Receipt, Fuel, AlertOctagon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UNIT_DOC_TYPES, NO_EXPIRY_TYPES, unitDocStatus, unitHabilitado, type UnitDoc } from "@/lib/vehicleDocsFixed";

interface Unit {
  id: string; plate: string; brand: string | null; model: string; year: number;
  vin: string | null; vehicleType: string | null; axles: number | null;
  loadCapacity: number | null; fuelCapacity: number | null; ownerCompany: string | null;
  localType: string | null; status: string; photoUrl: string | null; notes: string | null;
  documents: UnitDoc[];
}
interface BitacoraItem { tipo: string; fecha: string; titulo: string; detalle: string; monto: number | null }

export default function UnitDetailClient({ unit, bitacora, userRole }: { unit: Unit; bitacora: BitacoraItem[]; userRole: string }) {
  const router = useRouter();
  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);
  const [tab, setTab] = useState<"basicos" | "documentos" | "bitacora">("basicos");
  const [docs, setDocs] = useState<UnitDoc[]>(unit.documents);
  const habilitado = unitHabilitado(docs);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/units" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <Truck size={22} className="text-blue-700" />
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{unit.plate}</h1>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${habilitado ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {habilitado ? "HABILITADO" : "DESHABILITADO"}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-5 ml-9">{unit.brand} {unit.model} · {unit.year}</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([["basicos","Datos Básicos",Truck],["documentos","Documentos",FileText],["bitacora","Bitácora",History]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "basicos" && <BasicData unit={unit} canEdit={canEdit} onSaved={() => router.refresh()} />}
      {tab === "documentos" && <Documents unitId={unit.id} docs={docs} setDocs={setDocs} canEdit={canEdit} />}
      {tab === "bitacora" && <Bitacora items={bitacora} />}
    </div>
  );
}

/* ─────────── Bitácora ─────────── */
const BITACORA_CFG: Record<string, { icon: typeof Package; color: string; label: string }> = {
  orden:         { icon: Package,      color: "bg-blue-100 text-blue-700",     label: "Orden" },
  mantenimiento: { icon: Wrench,       color: "bg-amber-100 text-amber-700",   label: "Mantenimiento" },
  gasto:         { icon: Receipt,      color: "bg-slate-100 text-slate-700",   label: "Gasto" },
  combustible:   { icon: Fuel,         color: "bg-indigo-100 text-indigo-700", label: "Combustible" },
  sancion:       { icon: AlertOctagon, color: "bg-red-100 text-red-700",       label: "Sanción" },
};

function Bitacora({ items }: { items: BitacoraItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
        <History size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin movimientos registrados para esta unidad</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Bitácora de la unidad</h2>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {items.map((it, i) => {
            const cfg = BITACORA_CFG[it.tipo] ?? BITACORA_CFG.gasto;
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-start gap-4 relative">
                <div className={`z-10 mt-0.5 rounded-full flex items-center justify-center w-8 h-8 shrink-0 ${cfg.color}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <p className="text-sm font-semibold text-gray-900">{it.titulo}</p>
                    <span className="text-xs text-gray-400">{format(new Date(it.fecha), "dd/MM/yyyy", { locale: es })}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{it.detalle}</p>
                  {it.monto != null && <p className="text-xs font-semibold text-gray-700 mt-0.5">S/ {it.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Datos Básicos ─────────── */
function BasicData({ unit, canEdit, onSaved }: { unit: Unit; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    plate:        unit.plate,
    brand:        unit.brand ?? "",
    model:        unit.model,
    year:         String(unit.year),
    axles:        unit.axles != null ? String(unit.axles) : "",
    vin:          unit.vin ?? "",
    vehicleType:  unit.vehicleType ?? "",
    loadCapacity: unit.loadCapacity != null ? String(unit.loadCapacity) : "",
    fuelCapacity: unit.fuelCapacity != null ? String(unit.fuelCapacity) : "",
    ownerCompany: unit.ownerCompany ?? "",
    localType:    unit.localType ?? "Puerto/Deposito",
    photoUrl:     unit.photoUrl ?? "",
    notes:        unit.notes ?? "",
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
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "units");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json(); setUploading(false);
    if (res.ok) set("photoUrl", data.url); else setError(data.error ?? "Error al subir foto");
    if (photoRef.current) photoRef.current.value = "";
  }

  async function save() {
    if (!form.plate || !form.model || !form.year) { setError("Placa, modelo y año son obligatorios"); return; }
    setLoading(true); setError(""); setMsg("");
    const res = await fetch(`/api/units/${unit.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, plate: form.plate.toUpperCase() }),
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
          <div className="w-40 h-32 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
            {form.photoUrl
              ? <img src={form.photoUrl} alt="foto" className="w-full h-full object-cover" />
              : <Truck size={48} className="text-gray-300" />}
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
          {field("Placa *", <input className={`${inp} font-mono uppercase`} value={form.plate} disabled={!canEdit} onChange={e => set("plate", e.target.value.toUpperCase())} />)}
          {field("Marca *", <input className={inp} value={form.brand} disabled={!canEdit} onChange={e => set("brand", e.target.value)} />)}
          {field("Modelo *", <input className={inp} value={form.model} disabled={!canEdit} onChange={e => set("model", e.target.value)} />)}
          {field("Año *", <input type="number" className={inp} value={form.year} disabled={!canEdit} onChange={e => set("year", e.target.value)} />)}
          {field("N° de Ejes *", <input type="number" className={inp} value={form.axles} disabled={!canEdit} onChange={e => set("axles", e.target.value)} />)}
          {field("Tipo Local", (
            <select className={inp} value={form.localType} disabled={!canEdit} onChange={e => set("localType", e.target.value)}>
              <option value="Puerto/Deposito">Puerto/Deposito</option>
              <option value="Almacen">Almacén</option>
              <option value="Otro">Otro</option>
            </select>
          ))}
          {field("VIN / N° de Serie", <input className={inp} value={form.vin} disabled={!canEdit} onChange={e => set("vin", e.target.value)} />)}
          {field("Empresa propietaria", <input className={inp} value={form.ownerCompany} disabled={!canEdit} onChange={e => set("ownerCompany", e.target.value)} />)}
          {field("Capacidad de carga (kg)", <input type="number" className={inp} value={form.loadCapacity} disabled={!canEdit} onChange={e => set("loadCapacity", e.target.value)} />)}
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
function Documents({ unitId, docs, setDocs, canEdit }: {
  unitId: string; docs: UnitDoc[]; setDocs: (d: UnitDoc[]) => void; canEdit: boolean;
}) {
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
            {UNIT_DOC_TYPES.map(t => (
              <DocRow key={t.key} type={t.key} label={t.label} unitId={unitId}
                doc={docs.find(d => d.type === t.key)} canEdit={canEdit}
                onSaved={(saved) => setDocs([...docs.filter(d => d.type !== t.key), saved])} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocRow({ type, label, unitId, doc, canEdit, onSaved }: {
  type: string; label: string; unitId: string;
  doc?: UnitDoc; canEdit: boolean; onSaved: (d: UnitDoc) => void;
}) {
  const noExpiry = NO_EXPIRY_TYPES.includes(type);
  const [expiry, setExpiry] = useState(doc?.expiryDate ? doc.expiryDate.slice(0, 10) : "");
  const [fileUrl, setFileUrl] = useState(doc?.fileUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const st = unitDocStatus({ type, expiryDate: expiry || null, fileUrl: fileUrl || null });

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
    const res = await fetch("/api/unit-documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, type, expiryDate: exp || null, fileUrl: url || null }),
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
        {noExpiry
          ? <span className="text-xs text-gray-400 italic">No aplica</span>
          : <input type="date" value={expiry} disabled={!canEdit}
              onChange={e => setExpiry(e.target.value)}
              onBlur={() => canEdit && persist(fileUrl, expiry)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />}
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
