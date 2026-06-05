"use client";
import { useState } from "react";
import { X, Download, FileText, ExternalLink, ImageOff } from "lucide-react";

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("/raw/");
}

// Para Cloudinary fuerza la descarga con fl_attachment
function toDownloadUrl(url: string) {
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/fl_attachment/");
  }
  return url;
}

export default function FilePreview({ url, title = "Comprobante", onClose }: {
  url: string; title?: string; onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const pdf = isPdf(url);

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header con acciones */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <FileText size={16} className="text-blue-600" /> {title}
          </h2>
          <div className="flex items-center gap-2">
            <a href={toDownloadUrl(url)} download
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Download size={13} /> Descargar
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
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
              <a href={toDownloadUrl(url)} download className="text-xs text-blue-600 hover:underline mt-2 inline-block">Descargar archivo</a>
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
