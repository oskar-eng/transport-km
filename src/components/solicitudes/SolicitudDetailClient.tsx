"use client";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, FileText, Download } from "lucide-react";
import FilePreview from "@/components/common/FilePreview";

interface S {
  id: string; numero: number; tipo: string; entidad: string; docOrPlate: string;
  entityName: string | null; localType: string | null; docType: string | null; fileUrl: string | null;
  expiryDate: string | null; estado: string; createdByName: string | null; createdAt: string;
}

const ENTIDAD_LABEL: Record<string, string> = { CHOFER: "Chofer", CAMION: "Camión", CARRETA: "Carreta" };
const ESTADO_COLOR: Record<string, string> = {
  APROBADA: "bg-green-500 text-white", PENDIENTE: "bg-amber-400 text-amber-900", RECHAZADA: "bg-red-500 text-white",
};

export default function SolicitudDetailClient({ s }: { s: S }) {
  const [preview, setPreview] = useState(false);

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">{value ?? "—"}</div>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/solicitudes" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-900">Detalle de la Solicitud</h1>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[s.estado] ?? "bg-gray-200"}`}>{s.estado}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Información de la solicitud</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Nro Solicitud" value={s.numero} />
          <Field label="Tipo de Solicitud" value={s.tipo === "MODIFICACION" ? "Modificación" : s.tipo === "ASOCIACION" ? "Asociación" : s.tipo} />
          <Field label="Solicitud de" value={ENTIDAD_LABEL[s.entidad] ?? s.entidad} />
          <Field label="Nro Doc / Placa" value={s.docOrPlate} />
          {s.entityName && <Field label="Entidad" value={s.entityName} />}
          <Field label="Tipo Local" value={s.localType} />
          <Field label="Registrado por" value={s.createdByName} />
          <Field label="Fecha de solicitud" value={format(new Date(s.createdAt), "dd/MM/yyyy HH:mm", { locale: es })} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Documento adjunto</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-red-500 text-white">
            <tr>{["Estado","Descripción","Fecha Vencimiento","Adjunto"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase">{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3"><span className={`text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[s.estado] ?? "bg-gray-200"}`}>{s.estado}</span></td>
              <td className="px-4 py-3 font-medium text-gray-800">{s.docType ?? "—"}</td>
              <td className="px-4 py-3 text-gray-600">{s.expiryDate ? format(new Date(s.expiryDate), "dd/MM/yyyy", { locale: es }) : "—"}</td>
              <td className="px-4 py-3">
                {s.fileUrl
                  ? <button onClick={() => setPreview(true)} className="flex items-center gap-1 text-xs bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"><Download size={13} /> Ver / Descargar</button>
                  : <span className="text-gray-300 text-xs">Sin archivo</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {preview && s.fileUrl && (
        <FilePreview url={s.fileUrl} filename={`${s.docType}_${s.docOrPlate}`} title={s.docType ?? "Documento"} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
