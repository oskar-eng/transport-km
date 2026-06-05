"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardList, Search, ExternalLink } from "lucide-react";

interface Solicitud {
  id: string; numero: number; tipo: string; entidad: string; docOrPlate: string;
  entityName: string | null; localType: string | null; docType: string | null; estado: string;
  createdAt: string; updatedAt: string;
}

const ENTIDAD_LABEL: Record<string, string> = { CHOFER: "Chofer", CAMION: "Camión", CARRETA: "Carreta" };
const ESTADO_COLOR: Record<string, string> = {
  APROBADA: "bg-green-500 text-white", PENDIENTE: "bg-amber-400 text-amber-900", RECHAZADA: "bg-red-500 text-white",
};

export default function SolicitudesClient({ solicitudes }: { solicitudes: Solicitud[] }) {
  const [search, setSearch] = useState("");
  const [fEstado, setFEstado] = useState("TODOS");
  const [fEntidad, setFEntidad] = useState("TODOS");

  const filtered = useMemo(() => solicitudes.filter(s => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || s.docOrPlate.toLowerCase().includes(q) || (s.entityName ?? "").toLowerCase().includes(q) || String(s.numero).includes(q);
    return matchSearch && (fEstado === "TODOS" || s.estado === fEstado) && (fEntidad === "TODOS" || s.entidad === fEntidad);
  }), [solicitudes, search, fEstado, fEntidad]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={22} className="text-blue-700" /> Solicitudes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Historial de actualizaciones de documentos (conductores, vehículos y carretas)</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nro Doc / Placa / nombre…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <select value={fEntidad} onChange={e => setFEntidad(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todas las entidades</option>
          <option value="CHOFER">Chofer</option><option value="CAMION">Camión</option><option value="CARRETA">Carreta</option>
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="TODOS">Todos los estados</option>
          <option value="APROBADA">Aprobada</option><option value="PENDIENTE">Pendiente</option><option value="RECHAZADA">Rechazada</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay solicitudes registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-500 text-white">
                <tr>{["Estado","Nro","Tipo","Entidad","Nro Doc / Placa","Documento","Fecha","" ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className={`inline-block text-center text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[s.estado] ?? "bg-gray-200"}`}>{s.estado}</span></td>
                    <td className="px-4 py-3 text-gray-600">{s.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{s.tipo === "MODIFICACION" ? "Modificación" : s.tipo === "ASOCIACION" ? "Asociación" : s.tipo}</td>
                    <td className="px-4 py-3 text-gray-700">{ENTIDAD_LABEL[s.entidad] ?? s.entidad}</td>
                    <td className="px-4 py-3"><span className="font-mono font-semibold text-gray-900">{s.docOrPlate}</span>{s.entityName && <p className="text-xs text-gray-400">{s.entityName}</p>}</td>
                    <td className="px-4 py-3 text-gray-600">{s.docType ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(s.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</td>
                    <td className="px-4 py-3"><Link href={`/solicitudes/${s.id}`} className="text-blue-600 hover:text-blue-700"><ExternalLink size={15} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
