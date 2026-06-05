"use client";
import { useState, useMemo, useRef } from "react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, FileText, AlertTriangle, CheckCircle2, XCircle, Filter, Upload, Loader2, X } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

const DOC_TYPES: Record<string, string> = {
  SOAT:             "SOAT",
  REVISION_TECNICA: "Revisión Técnica",
  SEGURO:           "Seguro",
  PERMISO_MTC:      "Permiso MTC",
  CERTIFICADO:      "Certificado",
  OTRO:             "Otro",
};

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("/raw/");
}

function calcStatus(expiryDate: string) {
  const now = new Date();
  const exp = new Date(expiryDate);
  const days = differenceInDays(exp, now);
  if (days < 0)  return { label: "Vencido",     color: "bg-red-100 text-red-700 border border-red-200",       icon: XCircle,       iconColor: "text-red-500",    days };
  if (days < 30) return { label: "Por vencer",  color: "bg-yellow-100 text-yellow-700 border border-yellow-200", icon: AlertTriangle, iconColor: "text-yellow-500", days };
  return           { label: "Vigente",     color: "bg-green-100 text-green-700 border border-green-200",     icon: CheckCircle2,  iconColor: "text-green-500",  days };
}

interface Unit { id: string; plate: string; model: string }
interface Doc {
  id: string; unitId: string; type: string; name: string;
  issueDate: string | null; expiryDate: string; fileUrl: string | null;
  notes: string | null; unit: { plate: string; model: string };
}

const EMPTY_FORM = { unitId: "", type: "SOAT", name: "", issueDate: "", expiryDate: "", fileUrl: "", notes: "" };

export default function DocumentsClient({ docs: initial, units, userRole }: { docs: Doc[]; units: Unit[]; userRole: string }) {
  const [docs, setDocs]         = useState<Doc[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Doc | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [filterUnit, setFilterUnit]     = useState("TODOS");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canEdit = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(userRole);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "documents");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setForm((p) => ({ ...p, fileUrl: data.url }));
    } else {
      setError(data.error ?? "Error al subir el archivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  function openNew() {
    setEditing(null); setForm({ ...EMPTY_FORM }); setError(""); setShowForm(true);
  }
  function openEdit(d: Doc) {
    setEditing(d);
    setForm({
      unitId: d.unitId, type: d.type, name: d.name,
      issueDate:  d.issueDate ? format(new Date(d.issueDate), "yyyy-MM-dd") : "",
      expiryDate: format(new Date(d.expiryDate), "yyyy-MM-dd"),
      fileUrl: d.fileUrl ?? "", notes: d.notes ?? "",
    });
    setError(""); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.expiryDate) { setError("Unidad y fecha de vencimiento son obligatorias"); return; }
    setLoading(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url    = editing ? `/api/documents/${editing.id}` : "/api/documents";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, issueDate: form.issueDate || null, fileUrl: form.fileUrl || null, notes: form.notes || null }),
    });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) setDocs((p) => p.map((d) => d.id === saved.id ? saved : d));
      else         setDocs((p) => [...p, saved]);
      setShowForm(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocs((p) => p.filter((d) => d.id !== id));
  }

  // Filtrado
  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const s = calcStatus(d.expiryDate);
      const matchStatus = filterStatus === "TODOS" || s.label.toUpperCase().replace(" ", "_") === filterStatus ||
        (filterStatus === "VENCIDO" && s.days < 0) ||
        (filterStatus === "POR_VENCER" && s.days >= 0 && s.days < 30) ||
        (filterStatus === "VIGENTE" && s.days >= 30);
      const matchUnit = filterUnit === "TODOS" || d.unitId === filterUnit;
      return matchStatus && matchUnit;
    });
  }, [docs, filterStatus, filterUnit]);

  // Conteos para resumen
  const counts = useMemo(() => ({
    vencido:   docs.filter((d) => calcStatus(d.expiryDate).days < 0).length,
    porVencer: docs.filter((d) => { const s = calcStatus(d.expiryDate); return s.days >= 0 && s.days < 30; }).length,
    vigente:   docs.filter((d) => calcStatus(d.expiryDate).days >= 30).length,
  }), [docs]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentación Vehicular</h1>
          <p className="text-sm text-gray-400 mt-0.5">SOAT, revisiones técnicas, seguros y permisos</p>
        </div>
        {canEdit && (
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Agregar Documento
          </button>
        )}
      </div>

      {/* Resumen de estado */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Vencidos",    count: counts.vencido,   color: "bg-red-50 border border-red-200",       text: "text-red-700",    icon: XCircle,       filter: "VENCIDO" },
          { label: "Por vencer",  count: counts.porVencer, color: "bg-yellow-50 border border-yellow-200", text: "text-yellow-700", icon: AlertTriangle, filter: "POR_VENCER" },
          { label: "Vigentes",    count: counts.vigente,   color: "bg-green-50 border border-green-200",   text: "text-green-700",  icon: CheckCircle2,  filter: "VIGENTE" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.label} onClick={() => setFilterStatus(filterStatus === s.filter ? "TODOS" : s.filter)}
              className={`${s.color} rounded-xl p-4 text-left transition-all ${filterStatus === s.filter ? "ring-2 ring-offset-1 ring-blue-400" : "hover:opacity-80"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={s.text} />
                <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.text}`}>{s.count}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todas las unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todos los estados</option>
          <option value="VENCIDO">Vencido</option>
          <option value="POR_VENCER">Por vencer</option>
          <option value="VIGENTE">Vigente</option>
        </select>
        {(filterStatus !== "TODOS" || filterUnit !== "TODOS") && (
          <button onClick={() => { setFilterStatus("TODOS"); setFilterUnit("TODOS"); }}
            className="text-xs text-blue-600 hover:underline">Limpiar filtros</button>
        )}
      </div>

      {/* Tabla de documentos */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay documentos{filterStatus !== "TODOS" ? " con este filtro" : ""}</p>
          {canEdit && <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Agregar documento</button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Unidad", "Tipo", "Documento", "Emisión", "Vencimiento", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((d) => {
                  const st = calcStatus(d.expiryDate);
                  const StatusIcon = st.icon;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-gray-900">{d.unit.plate}</p>
                        <p className="text-xs text-gray-400">{d.unit.model}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {DOC_TYPES[d.type] ?? d.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{d.name}</p>
                        {d.notes && <p className="text-xs text-gray-400 truncate max-w-48">{d.notes}</p>}
                        {d.fileUrl && (
                          <button type="button" onClick={() => setPreview({ url: d.fileUrl!, name: `${DOC_TYPES[d.type] ?? d.type}_${d.unit.plate}_${format(new Date(d.expiryDate), "yyyy-MM-dd")}` })}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                            <FileText size={10} /> Ver archivo
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {d.issueDate ? format(new Date(d.issueDate), "dd/MM/yyyy", { locale: es }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{format(new Date(d.expiryDate), "dd/MM/yyyy", { locale: es })}</p>
                        <p className="text-xs text-gray-400">
                          {st.days < 0 ? `hace ${Math.abs(st.days)} días` : `en ${st.days} días`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>
                          <StatusIcon size={11} /> {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
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
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editing ? "Editar Documento" : "Nuevo Documento"}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad *</label>
                <select value={form.unitId} onChange={(e) => set("unitId", e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar unidad</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Tipo de documento *</label>
                <select value={form.type} onChange={(e) => set("type", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Nombre / descripción *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} required
                  placeholder="Ej: SOAT 2025"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha de emisión</label>
                <input type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Fecha de vencimiento *</label>
                <input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Archivo del documento (PDF o imagen)</label>
                {form.fileUrl ? (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                      <span className="text-sm text-green-700 font-medium flex-1">Archivo cargado ✓</span>
                      <button type="button" onClick={() => set("fileUrl", "")}
                        className="text-gray-400 hover:text-red-600 shrink-0"><X size={16} /></button>
                    </div>
                    {/* Vista previa: imagen o PDF */}
                    {isPdf(form.fileUrl) ? (
                      <iframe src={form.fileUrl} className="w-full h-64 rounded-lg border border-gray-200 bg-white" title="Vista previa del documento" />
                    ) : (
                      <a href={form.fileUrl} target="_blank" rel="noopener noreferrer">
                        <img src={form.fileUrl} alt="Vista previa" className="w-full max-h-64 object-contain rounded-lg border border-gray-200 bg-white" />
                      </a>
                    )}
                    <a href={form.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <FileText size={12} /> Abrir en pantalla completa
                    </a>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-60">
                    {uploading
                      ? <><Loader2 size={16} className="animate-spin" /> Subiendo archivo…</>
                      : <><Upload size={16} /> Subir archivo (PDF / foto)</>}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleUpload} />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de vista previa del documento */}
      {preview && <FilePreview url={preview.url} filename={preview.name} title="Documento" onClose={() => setPreview(null)} />}
    </div>
  );
}
