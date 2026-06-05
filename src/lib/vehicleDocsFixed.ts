// Documentos obligatorios de una unidad (camión)
export const UNIT_DOC_TYPES: { key: string; label: string }[] = [
  { key: "HABILITACION",      label: "Certificado de Habilitación Vehicular" },
  { key: "SOAT",              label: "Seguro Obligatorio contra Accidentes de Tránsito (SOAT)" },
  { key: "REVISION_TECNICA",  label: "Revisión Técnica Vehicular" },
  { key: "POLIZA",            label: "Póliza de Responsabilidad contra Terceros" },
  { key: "FOTO_PLACA",        label: "Foto de la Placa del Techo del camión" },
  { key: "TARJETA_PROPIEDAD", label: "Tarjeta de propiedad" },
];

// La "Foto de la Placa del Techo" no tiene vencimiento — solo requiere archivo
export const NO_EXPIRY_TYPES = ["FOTO_PLACA"];

export interface UnitDoc {
  id?: string;
  type: string;
  expiryDate: string | null;
  fileUrl: string | null;
}

export function unitDocStatus(doc?: UnitDoc) {
  const noExpiry = doc ? NO_EXPIRY_TYPES.includes(doc.type) : false;
  if (!doc || !doc.fileUrl) return { label: "FALTA", color: "bg-gray-300 text-gray-700", ok: false };
  if (noExpiry) return { label: "OK", color: "bg-green-500 text-white", ok: true };
  if (!doc.expiryDate) return { label: "FALTA FECHA", color: "bg-gray-300 text-gray-700", ok: false };
  const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: "VENCIDO",    color: "bg-red-500 text-white",        ok: false };
  if (days < 30) return { label: "POR VENCER", color: "bg-yellow-400 text-yellow-900", ok: true };
  return            { label: "OK",         color: "bg-green-500 text-white",      ok: true };
}

// Unidad Habilitada solo si TODOS los documentos están vigentes
export function unitHabilitado(docs: UnitDoc[]): boolean {
  return UNIT_DOC_TYPES.every(t => {
    const doc = docs.find(d => d.type === t.key);
    if (!doc || !doc.fileUrl) return false;
    if (NO_EXPIRY_TYPES.includes(t.key)) return true;
    if (!doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() >= Date.now();
  });
}
