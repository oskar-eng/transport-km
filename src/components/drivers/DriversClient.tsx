"use client";
import { useState, useRef } from "react";
import {
  UserRound, Plus, Pencil, X, Camera, ImageOff,
  Phone, Mail, Truck, AlertTriangle, CheckCircle2, Clock, ExternalLink, Download, Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { driverHabilitado, type DriverDoc } from "@/lib/driverDocs";

interface DriverProfile {
  id: string; userId: string; dni: string;
  firstName: string; lastName: string;
  licenseNumber: string; licenseCategory: string; licenseExpiry: string;
  phone: string | null; joinDate: string | null;
  status: string; photoUrl: string | null;
}
interface ActiveUnit { id: string; plate: string; model: string; }
interface Driver {
  id: string; name: string; email: string; active: boolean;
  profile: DriverProfile | null;
  documents: DriverDoc[];
  activeUnit: ActiveUnit | null;
}

const LICENSE_CATEGORIES = [
  "A-I","A-IIa","A-IIb","A-IIIa","A-IIIb","A-IIIc",
  "B-I","B-IIa","B-IIb","B-IIc",
];

const DRIVER_STATUS = [
  { value: "ACTIVO",     label: "Activo",     color: "bg-green-100 text-green-700 border-green-200" },
  { value: "INACTIVO",   label: "Inactivo",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "SUSPENDIDO", label: "Suspendido", color: "bg-red-100 text-red-700 border-red-200" },
];

const emptyProfile = {
  dni: "", firstName: "", lastName: "",
  licenseNumber: "", licenseCategory: "A-IIIb",
  licenseExpiry: "", phone: "", joinDate: "",
  status: "ACTIVO", photoUrl: "",
};

function daysUntil(isoDate: string) {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

export default function DriversClient({ drivers: initial, userRole }: { drivers: Driver[]; userRole: string }) {
  const [drivers, setDrivers] = useState(initial);
  const [showForm, setShowForm]         = useState(false);
  const [selected, setSelected]         = useState<Driver | null>(null);
  const [form, setForm]                 = useState({ ...emptyProfile });
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch]             = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(userRole);

  function openEdit(d: Driver) {
    setSelected(d);
    const p = d.profile;
    setForm(p ? {
      dni:             p.dni,
      firstName:       p.firstName,
      lastName:        p.lastName,
      licenseNumber:   p.licenseNumber,
      licenseCategory: p.licenseCategory,
      licenseExpiry:   p.licenseExpiry.slice(0, 10),
      phone:           p.phone ?? "",
      joinDate:        p.joinDate ? p.joinDate.slice(0, 10) : "",
      status:          p.status,
      photoUrl:        p.photoUrl ?? "",
    } : { ...emptyProfile });
    setPhotoPreview(p?.photoUrl ?? "");
    setShowForm(true);
    setError("");
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!form.dni || !form.firstName || !form.lastName || !form.licenseNumber || !form.licenseExpiry) {
      setError("Completa los campos obligatorios (*)"); return;
    }
    setSaving(true); setError("");
    const res = await fetch(`/api/drivers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: selected.id }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
    const updated: DriverProfile = await res.json();
    setDrivers(prev => prev.map(d => d.id === selected.id
      ? { ...d, profile: updated }
      : d
    ));
    setShowForm(false);
  }

  // Filtered list
  const visible = drivers.filter(d => {
    const name = `${d.name} ${d.profile?.firstName ?? ""} ${d.profile?.lastName ?? ""}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) ||
      d.profile?.dni.includes(search) || false;
    const matchStatus = !filterStatus || (d.profile?.status ?? "SIN_PERFIL") === filterStatus;
    return matchSearch && matchStatus;
  });

  const expiringSoon = drivers.filter(d => {
    if (!d.profile?.licenseExpiry) return false;
    const days = daysUntil(d.profile.licenseExpiry);
    return days >= 0 && days <= 30;
  }).length;

  const expired = drivers.filter(d => d.profile?.licenseExpiry && daysUntil(d.profile.licenseExpiry) < 0).length;

  const [exporting, setExporting] = useState(false);
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = visible.map(d => {
        const p = d.profile;
        return {
          Conductor: p ? `${p.firstName} ${p.lastName}` : d.name,
          DNI: p?.dni ?? "",
          Licencia: p?.licenseNumber ?? "",
          Categoría: p?.licenseCategory ?? "",
          "Vence licencia": p?.licenseExpiry ? p.licenseExpiry.slice(0, 10) : "",
          Celular: p?.phone ?? "",
          Estado: DRIVER_STATUS.find(s => s.value === p?.status)?.label ?? "",
          Habilitado: p ? (driverHabilitado(d.documents) ? "Sí" : "No") : "",
          "Unidad asignada": d.activeUnit?.plate ?? "",
          Correo: d.email,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Conductores");
      XLSX.writeFile(wb, `conductores_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExporting(false); }
  }

  /* ── helpers ── */
  const F = (label: string, node: React.ReactNode, col = 1) => (
    <div className={col === 2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {node}
    </div>
  );
  const inp = (field: keyof typeof emptyProfile, type = "text", placeholder = "") => (
    <input type={type} placeholder={placeholder} value={form[field] as string}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conductores</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestión de perfiles y licencias</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{drivers.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total conductores</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{drivers.filter(d => d.activeUnit).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">En ruta ahora</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className={`text-2xl font-bold ${expiringSoon > 0 ? "text-amber-500" : "text-gray-400"}`}>{expiringSoon}</p>
          <p className="text-xs text-gray-500 mt-0.5">Licencia por vencer</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className={`text-2xl font-bold ${expired > 0 ? "text-red-600" : "text-gray-400"}`}>{expired}</p>
          <p className="text-xs text-gray-500 mt-0.5">Licencia vencida</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o DNI…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {DRIVER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={exportExcel} disabled={exporting || visible.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ml-auto">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportar Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Conductor","DNI","Licencia","Categoría","Vence","Celular","Habilitado","Unidad asignada",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(d => {
                const p = d.profile;
                const days = p ? daysUntil(p.licenseExpiry) : null;
                const expColor = days == null ? "" : days < 0 ? "text-red-600 font-semibold" : days <= 30 ? "text-amber-500 font-semibold" : "text-gray-600";
                const statusCfg = DRIVER_STATUS.find(s => s.value === (p?.status ?? "")) ?? null;

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    {/* Foto + nombre */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {p?.photoUrl
                            ? <Image src={p.photoUrl} alt="" width={36} height={36} className="object-cover w-full h-full" />
                            : <UserRound size={18} className="text-gray-300" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 whitespace-nowrap">
                            {p ? `${p.firstName} ${p.lastName}` : d.name}
                          </p>
                          <p className="text-xs text-gray-400">{d.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{p?.dni ?? <span className="text-gray-300 italic text-xs">sin perfil</span>}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{p?.licenseNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{p.licenseCategory}</span> : "—"}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${expColor}`}>
                      {p ? (
                        <span className="flex items-center gap-1">
                          {days! < 0 && <AlertTriangle size={12} />}
                          {days! >= 0 && days! <= 30 && <Clock size={12} />}
                          {p.licenseExpiry.slice(0,10)}
                          {days != null && <span className="text-xs opacity-70">({days < 0 ? `vencida ${Math.abs(days)}d` : `${days}d`})</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p?.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p
                        ? (driverHabilitado(d.documents)
                            ? <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-500 text-white">Habilitado</span>
                            : <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-500 text-white">Inhabilitado</span>)
                        : <span className="text-xs text-gray-300 italic">sin perfil</span>}
                    </td>
                    <td className="px-4 py-3">
                      {d.activeUnit
                        ? <span className="flex items-center gap-1.5 text-blue-600 font-medium whitespace-nowrap"><Truck size={13}/>{d.activeUnit.plate}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/drivers/${d.id}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">
                        <ExternalLink size={13} /> Gestionar
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sin conductores registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Formulario ── */}
      {showForm && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Perfil del Conductor</h2>
                <p className="text-sm text-gray-400">{selected.name} · {selected.email}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            {/* Body */}
            <form onSubmit={save} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Foto */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Foto del conductor</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                    {photoPreview
                      ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                      : <ImageOff size={22} className="text-gray-300" />}
                  </div>
                  <div>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                      <Camera size={15}/> {uploading ? "Subiendo…" : "Seleccionar foto"}
                    </button>
                    {photoPreview && (
                      <button type="button" onClick={() => { setPhotoPreview(""); setForm(f => ({...f, photoUrl: ""})); }}
                        className="text-xs text-red-500 hover:underline mt-1 block">Quitar foto</button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {F("DNI *", inp("dni","text","12345678"))}
                {F("Estado", (
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {DRIVER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ))}

                {F("Nombres *", inp("firstName","text","Juan Carlos"))}
                {F("Apellidos *", inp("lastName","text","García López"))}

                {F("N° de licencia *", inp("licenseNumber","text","Q12345678"))}
                {F("Categoría de licencia *", (
                  <select value={form.licenseCategory} onChange={e => setForm(f => ({...f, licenseCategory: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {LICENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ))}

                {F("Vencimiento de licencia *", inp("licenseExpiry","date"))}
                {F("Fecha de ingreso", inp("joinDate","date"))}

                {F("Celular", inp("phone","tel","+51 999 999 999"))}

                {F("Correo", (
                  <input type="email" value={selected.email} disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
                ))}
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || uploading}
                className="px-5 py-2 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
