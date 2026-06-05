// Definición de los documentos obligatorios de un conductor
export const DRIVER_DOC_TYPES: { key: string; label: string }[] = [
  { key: "DNI",             label: "Documento de Identidad" },
  { key: "LICENCIA",        label: "Licencia de Conducir" },
  { key: "PBIP",            label: "Curso Básico I - PBIP" },
  { key: "ANT_POLICIALES",  label: "Certificado de Antecedentes Policiales" },
  { key: "ANT_PENALES",     label: "Certificado de Antecedentes Penales" },
  { key: "SCTR",            label: "Seguro Complementario contra Trabajo de Riesgo (SCTR)" },
];

export interface DriverDoc {
  id?: string;
  type: string;
  expiryDate: string | null;
  fileUrl: string | null;
}

// Estado de un documento individual
export function docStatus(doc?: DriverDoc) {
  if (!doc || !doc.fileUrl || !doc.expiryDate) {
    return { label: "FALTA", color: "bg-gray-300 text-gray-700", ok: false };
  }
  const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: "VENCIDO",    color: "bg-red-500 text-white",    ok: false };
  if (days < 30) return { label: "POR VENCER", color: "bg-yellow-400 text-yellow-900", ok: true };
  return            { label: "OK",         color: "bg-green-500 text-white",  ok: true };
}

// Estado general del conductor: Habilitado solo si TODOS los docs están vigentes (no vencidos y con archivo)
export function driverHabilitado(docs: DriverDoc[]): boolean {
  return DRIVER_DOC_TYPES.every(t => {
    const doc = docs.find(d => d.type === t.key);
    if (!doc || !doc.fileUrl || !doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() >= Date.now();
  });
}
