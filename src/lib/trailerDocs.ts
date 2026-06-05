// Documentos obligatorios de una carreta (remolque)
export const TRAILER_DOC_TYPES: { key: string; label: string }[] = [
  { key: "TARJETA_PROPIEDAD", label: "Tarjeta de propiedad" },
  { key: "HABILITACION",      label: "Certificado de Habilitación Vehicular" },
  { key: "REVISION_TECNICA",  label: "Revisión Técnica Vehicular" },
  { key: "POLIZA",            label: "Póliza de Responsabilidad contra Terceros" },
];

export interface TrailerDoc {
  id?: string;
  type: string;
  expiryDate: string | null;
  fileUrl: string | null;
}

export function trailerDocStatus(doc?: TrailerDoc) {
  if (!doc || !doc.fileUrl) return { label: "FALTA", color: "bg-gray-300 text-gray-700", ok: false };
  if (!doc.expiryDate) return { label: "FALTA FECHA", color: "bg-gray-300 text-gray-700", ok: false };
  const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: "VENCIDO",    color: "bg-red-500 text-white",        ok: false };
  if (days < 30) return { label: "POR VENCER", color: "bg-yellow-400 text-yellow-900", ok: true };
  return            { label: "OK",         color: "bg-green-500 text-white",      ok: true };
}

// Carreta habilitada solo si todos sus documentos están vigentes
export function trailerHabilitado(docs: TrailerDoc[]): boolean {
  return TRAILER_DOC_TYPES.every(t => {
    const doc = docs.find(d => d.type === t.key);
    if (!doc || !doc.fileUrl || !doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() >= Date.now();
  });
}
