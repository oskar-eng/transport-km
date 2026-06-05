"use client";
import { useState, useRef } from "react";
import { Plus, Pencil, Truck, Lock, X, Camera, ImageOff, ScanLine, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { unitHabilitado, type UnitDoc } from "@/lib/vehicleDocsFixed";

interface Unit {
  id: string; plate: string; brand: string | null; model: string; year: number;
  vin: string | null; vehicleType: string | null; axles: number | null;
  loadCapacity: number | null; fuelCapacity: number | null;
  ownerCompany: string | null; status: string;
  acquisitionDate: string | null; photoUrl: string | null; notes: string | null;
  documents?: UnitDoc[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; auto: boolean }> = {
  DISPONIBLE:     { label: "Operativo",        color: "bg-green-100 text-green-800 border border-green-200",     auto: true  },
  EN_SERVICIO:    { label: "En Servicio",       color: "bg-blue-100 text-blue-800 border border-blue-200",       auto: true  },
  MANTENIMIENTO:  { label: "En Taller",         color: "bg-yellow-100 text-yellow-800 border border-yellow-200", auto: false },
  FUERA_SERVICIO: { label: "Inactivo",          color: "bg-red-100 text-red-800 border border-red-200",          auto: false },
};

const MANUAL_STATUSES = ["MANTENIMIENTO", "FUERA_SERVICIO"];

const VEHICLE_TYPES = [
  "Camión", "Tractocamión", "Remolque", "Semirremolque",
  "Cisterna", "Volquete", "Furgón", "Plataforma", "Otro",
];

const emptyForm = {
  plate: "", brand: "", model: "", year: new Date().getFullYear(),
  vin: "", vehicleType: "", axles: "", loadCapacity: "", fuelCapacity: "",
  ownerCompany: "", acquisitionDate: "", notes: "", manualStatus: "", photoUrl: "",
};

export default function UnitsClient({ units: initial, userRole }: { units: Unit[]; userRole: string }) {
  const [units, setUnits]               = useState(initial);
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<Unit | null>(null);
  const [form, setForm]                 = useState({ ...emptyForm });
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [uploading, setUploading]       = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [scanned, setScanned]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const fileRef    = useRef<HTMLInputElement>(null);
  const scanRef    = useRef<HTMLInputElement>(null);

  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);

  function openNew() {
    setEditing(null); setForm({ ...emptyForm }); setPhotoPreview(""); setScanned(false); setShowForm(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setForm({
      plate:           u.plate,
      brand:           u.brand ?? "",
      model:           u.model,
      year:            u.year,
      vin:             u.vin ?? "",
      vehicleType:     u.vehicleType ?? "",
      axles:           u.axles != null ? String(u.axles) : "",
      loadCapacity:    u.loadCapacity != null ? String(u.loadCapacity) : "",
      fuelCapacity:    u.fuelCapacity != null ? String(u.fuelCapacity) : "",
      ownerCompany:    u.ownerCompany ?? "",
      acquisitionDate: u.acquisitionDate ? u.acquisitionDate.slice(0, 10) : "",
      notes:           u.notes ?? "",
      manualStatus:    MANUAL_STATUSES.includes(u.status) ? u.status : "",
      photoUrl:        u.photoUrl ?? "",
    });
    setPhotoPreview(u.photoUrl ?? ""); setScanned(false); setShowForm(true);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) { setForm(f => ({ ...f, photoUrl: data.url })); setPhotoPreview(data.url); }
  }

  /* ── Scan vehicle card with AI ── */
  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true); setScanned(false); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/parse-vehicle", { method: "POST", body: fd });
    const data = await res.json();
    setScanning(false);
    if (!res.ok) { setError(data.error ?? "No se pudo leer la imagen"); return; }

    // Fill form with extracted data (keep existing values if AI returned null)
    setForm(f => ({
      ...f,
      plate:       data.plate       ?? f.plate,
      brand:       data.brand       ?? f.brand,
      model:       data.model       ?? f.model,
      year:        data.year        ?? f.year,
      vin:         data.vin         ?? f.vin,
      ownerCompany: data.ownerCompany ?? f.ownerCompany,
      vehicleType: data.vehicleType ?? f.vehicleType,
    }));
    setScanned(true);
    // Reset file input
    if (scanRef.current) scanRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const method = editing ? "PATCH" : "POST";
    const url    = editing ? `/api/units/${editing.id}` : "/api/units";

    const payload = {
      plate:           form.plate,
      brand:           form.brand        || null,
      model:           form.model,
      year:            Number(form.year),
      vin:             form.vin          || null,
      vehicleType:     form.vehicleType  || null,
      axles:           form.axles        ? Number(form.axles) : null,
      loadCapacity:    form.loadCapacity ? Number(form.loadCapacity) : null,
      fuelCapacity:    form.fuelCapacity ? Number(form.fuelCapacity) : null,
      ownerCompany:    form.ownerCompany || null,
      acquisitionDate: form.acquisitionDate || null,
      notes:           form.notes        || null,
      photoUrl:        form.photoUrl     || null,
      ...(form.manualStatus ? { status: form.manualStatus } : {}),
    };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) setUnits(prev => prev.map(u => u.id === saved.id ? saved : u));
      else         setUnits(prev => [...prev, saved]);
      setShowForm(false);
    } else {
      const d = await res.json();
      setError(d.error ?? "Error al guardar");
    }
  }

  const isInService = editing?.status === "EN_SERVICIO";

  const F = (label: string, children: React.ReactNode, span = 1) => (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
  const inp = (field: keyof typeof emptyForm, type = "text", placeholder = "") => (
    <input type={type} placeholder={placeholder} value={form[field] as string}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-medium text-blue-700">Operativo</span> y <span className="font-medium text-blue-700">En Servicio</span> se actualizan automáticamente
          </p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Nueva Unidad
          </button>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`rounded-xl px-4 py-3 text-center ${cfg.color}`}>
            <p className="text-2xl font-bold">{units.filter(u => u.status === key).length}</p>
            <p className="text-xs font-medium mt-0.5">{cfg.label}</p>
            {cfg.auto && <p className="text-xs opacity-60 mt-0.5">automático</p>}
          </div>
        ))}
      </div>

      {/* Unit cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map(u => {
          const cfg = STATUS_CONFIG[u.status] ?? { label: u.status, color: "bg-gray-100 text-gray-700 border border-gray-200", auto: false };
          const habilitado = unitHabilitado(u.documents ?? []);
          return (
            <div key={u.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="h-36 bg-gray-100 relative">
                {u.photoUrl
                  ? <Image src={u.photoUrl} alt={u.plate} fill className="object-cover" />
                  : <div className="flex items-center justify-center h-full"><Truck size={40} className="text-gray-300" /></div>}
                <div className="absolute top-2 right-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="absolute top-2 left-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${habilitado ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {habilitado ? "Habilitado" : "Deshabilitado"}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 font-mono text-lg">{u.plate}</p>
                    <p className="text-sm text-gray-600">{[u.brand, u.model, u.year].filter(Boolean).join(" · ")}</p>
                    {u.vehicleType && <p className="text-xs text-gray-400 mt-0.5">{u.vehicleType}{u.axles ? ` · ${u.axles} ejes` : ""}</p>}
                  </div>
                  {canEdit && (
                    <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 p-1 shrink-0"><Pencil size={14} /></button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                  {u.loadCapacity  && <span>Carga: <strong>{u.loadCapacity} t</strong></span>}
                  {u.fuelCapacity  && <span>Combustible: <strong>{u.fuelCapacity} Gal</strong></span>}
                  {u.ownerCompany  && <span className="col-span-2 truncate">Empresa: <strong>{u.ownerCompany}</strong></span>}
                  {u.vin           && <span className="col-span-2 truncate font-mono text-gray-400">VIN: {u.vin}</span>}
                </div>
                <Link href={`/units/${u.id}`}
                  className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg py-2 transition-colors">
                  <ExternalLink size={13} /> Gestionar documentos
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Formulario ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editing ? "Editar Unidad" : "Nueva Unidad"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── Escanear tarjeta vehicular ── */}
              <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-2.5 rounded-xl shrink-0">
                    <ScanLine size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800">Autocompletar desde tarjeta vehicular</p>
                    <p className="text-xs text-blue-600 mt-0.5">Sube una foto de la constancia SUNARP o tarjeta de propiedad y la IA extrae los datos automáticamente</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button type="button" onClick={() => scanRef.current?.click()} disabled={scanning}
                        className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        {scanning ? <><Loader2 size={14} className="animate-spin" /> Analizando…</> : <><ScanLine size={14} /> Subir imagen</>}
                      </button>
                      {scanned && (
                        <span className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                          <CheckCircle2 size={14} /> Datos extraídos correctamente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <input ref={scanRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
              </div>

              {/* Foto de la unidad */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Foto de la unidad</label>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                    {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <ImageOff size={24} className="text-gray-300" />}
                  </div>
                  <div>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                      <Camera size={15} /> {uploading ? "Subiendo…" : "Seleccionar foto"}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · máx. 5MB</p>
                    {photoPreview && (
                      <button type="button" onClick={() => { setPhotoPreview(""); setForm(f => ({ ...f, photoUrl: "" })); }}
                        className="text-xs text-red-500 hover:underline mt-1">Quitar foto</button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>
              </div>

              {/* Campos del formulario */}
              <div className="grid grid-cols-2 gap-4">
                {F("Placa *", <input required value={form.plate}
                  onChange={e => setForm(f => ({...f, plate: e.target.value.toUpperCase()}))}
                  placeholder="D9A762"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
                {F("Año *", inp("year", "number", "2024"))}

                {F("Marca", inp("brand", "text", "Hyundai, Volvo, Scania…"))}
                {F("Modelo *", inp("model", "text", "H-100 Truck, FH 460…"))}

                {F("VIN / N° de serie", inp("vin", "text", "KMFZAN7BP9U455753"), 2)}

                {F("Tipo de vehículo", (
                  <select value={form.vehicleType} onChange={e => setForm(f => ({...f, vehicleType: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Seleccionar —</option>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ))}
                {F("N° de ejes", inp("axles", "number", "2"))}

                {F("Capacidad de carga (t)", inp("loadCapacity", "number", "30"))}
                {F("Cap. combustible (Gal)", inp("fuelCapacity", "number", "160"))}

                {F("Empresa propietaria", inp("ownerCompany", "text", "YACZ CARGO S.A.C."), 2)}

                {F("Fecha de adquisición", inp("acquisitionDate", "date"))}

                {F("Estado manual", (
                  <div>
                    {editing && !MANUAL_STATUSES.includes(editing.status) && (
                      <div className="mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                        <Lock size={11} /> Estado actual: <strong>{STATUS_CONFIG[editing.status]?.label}</strong> — automático
                      </div>
                    )}
                    <select value={form.manualStatus} onChange={e => setForm(f => ({...f, manualStatus: e.target.value}))}
                      disabled={isInService}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
                      <option value="">— Sin cambio —</option>
                      <option value="MANTENIMIENTO">🔧 En Taller</option>
                      <option value="FUERA_SERVICIO">🚫 Inactivo</option>
                    </select>
                    {isInService && <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><Lock size={11}/> No se puede cambiar mientras esté en servicio activo</p>}
                  </div>
                ))}

                {F("Notas", (
                  <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2}
                    placeholder="Observaciones adicionales…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                ), 2)}
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading || uploading || scanning}
                className="px-5 py-2 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
