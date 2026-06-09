// Definición de los documentos del conductor
//   required: cuenta para la "habilitación" del conductor
//   noExpiry: documento sin fecha de vencimiento (solo requiere archivo)
export const DRIVER_DOC_TYPES: { key: string; label: string; required?: boolean; noExpiry?: boolean }[] = [
  { key: "DNI",             label: "Documento de Identidad",                                  required: true },
  { key: "LICENCIA",        label: "Licencia de Conducir",                                    required: true },
  { key: "PBIP",            label: "Curso Básico I - PBIP",                                   required: true },
  { key: "ANT_POLICIALES",  label: "Certificado de Antecedentes Policiales",                  required: true },
  { key: "ANT_PENALES",     label: "Certificado de Antecedentes Penales",                     required: true },
  { key: "SCTR",            label: "Seguro Complementario contra Trabajo de Riesgo (SCTR)",   required: true },
  { key: "RECORD_CONDUCTOR", label: "Récord de Conductor (SUTRAN/MTC)" },
  { key: "MATPEL",          label: "Certificado MATPEL / IPERC" },
  { key: "CONTRATO",        label: "Contrato / Ficha RENIEC",                                 noExpiry: true },
];

// Documentos que no tienen fecha de vencimiento (solo requieren archivo)
export const DRIVER_NO_EXPIRY = DRIVER_DOC_TYPES.filter(t => t.noExpiry).map(t => t.key);

export interface DriverDoc {
  id?: string;
  type: string;
  expiryDate: string | null;
  fileUrl: string | null;
}

// Estado de un documento individual
export function docStatus(doc?: DriverDoc) {
  const noExpiry = doc ? DRIVER_NO_EXPIRY.includes(doc.type) : false;
  if (!doc || !doc.fileUrl) return { label: "FALTA", color: "bg-gray-300 text-gray-700", ok: false };
  if (noExpiry) return { label: "OK", color: "bg-green-500 text-white", ok: true };
  if (!doc.expiryDate) return { label: "FALTA FECHA", color: "bg-gray-300 text-gray-700", ok: false };
  const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: "VENCIDO",    color: "bg-red-500 text-white",    ok: false };
  if (days < 30) return { label: "POR VENCER", color: "bg-yellow-400 text-yellow-900", ok: true };
  return            { label: "OK",         color: "bg-green-500 text-white",  ok: true };
}

// Estado general del conductor: Habilitado si TODOS los documentos REQUERIDOS están vigentes
export function driverHabilitado(docs: DriverDoc[]): boolean {
  return DRIVER_DOC_TYPES.filter(t => t.required).every(t => {
    const doc = docs.find(d => d.type === t.key);
    if (!doc || !doc.fileUrl || !doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() >= Date.now();
  });
}
