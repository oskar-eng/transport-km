"use client";
import { useState } from "react";
import { X, Download, FileText, ExternalLink, ImageOff, Loader2 } from "lucide-react";

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("/raw/");
}

// Limpia el nombre para usarlo como archivo
function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_").slice(0, 80);
}

export default function FilePreview({ url, title = "Archivo", filename, onClose }: {
  url: string; title?: string; filename?: string; onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pdf = isPdf(url);

  async function handleDownload() {
    setDownloading(true);
    const ext = (url.split("?")[0].split(".").pop() ?? "file").toLowerCase();
    const base = sanitize(filename || title || "archivo");
    const name = `${base}.${ext}`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      // si falla el fetch (CORS), abrir en pestaña como respaldo
      window.open(url, "_blank");
    }
    setDownloading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header con acciones */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <FileText size={16} className="text-blue-600" /> {title}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-800 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors">
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors" title="Abrir en pestaña">
              <ExternalLink size={13} />
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center min-h-[300px]">
          {pdf ? (
            <iframe src={url} className="w-full h-[78vh] rounded-lg bg-white border border-gray-200" title={title} />
          ) : imgError ? (
            <div className="text-center text-gray-400 py-10">
              <ImageOff size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se pudo cargar la vista previa</p>
              <button onClick={handleDownload} className="text-xs text-blue-600 hover:underline mt-2">Descargar archivo</button>
            </div>
          ) : (
            <img src={url} alt={title} onError={() => setImgError(true)}
              className="max-w-full max-h-[78vh] object-contain rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}
