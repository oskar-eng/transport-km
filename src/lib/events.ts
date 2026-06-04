export const IMPORT_EVENTS = [
  { key: "SALIDA_COCHERA", label: "Salida de Cochera" },
  { key: "LLEGADA_ALMACEN_PUERTO", label: "Llegada al Almacén/Puerto" },
  { key: "INGRESO_ALMACEN_PUERTO", label: "Ingreso al Almacén/Puerto" },
  { key: "SALIDA_ALMACEN_PUERTO", label: "Salida del Almacén/Puerto" },
  { key: "LLEGADA_CLIENTE", label: "Llegada al Cliente" },
  { key: "INICIO_DESCARGA", label: "Inicio de Descarga" },
  { key: "TERMINO_DESCARGA", label: "Término de Descarga" },
  { key: "SALIDA_CLIENTE", label: "Salida del Cliente" },
  { key: "DEVOLUCION_CONTENEDOR", label: "Devolución de Contenedor" },
  { key: "LLEGADA_ALMACEN_PUERTO_2", label: "Llegada Almacén/Puerto (retorno)" },
  { key: "LLEGADA_COCHERA", label: "Llegada a Cochera" },
];

export const EXPORT_EVENTS = [
  { key: "SALIDA_COCHERA", label: "Salida de Cochera" },
  { key: "LLEGADA_RETIRO_CONTENEDOR", label: "Llegada a Retiro de Contenedor Vacío" },
  { key: "INGRESO_RETIRO_CONTENEDOR", label: "Ingreso para Retiro de Contenedor Vacío" },
  { key: "SALIDA_RETIRO_CONTENEDOR", label: "Salida del Retiro de Contenedor" },
  { key: "LLEGADA_CLIENTE", label: "Llegada al Cliente" },
  { key: "INICIO_CARGUIO", label: "Inicio de Carguío" },
  { key: "TERMINO_CARGUIO", label: "Término de Carguío" },
  { key: "SALIDA_CLIENTE", label: "Salida del Cliente" },
  { key: "LLEGADA_ALMACEN_PUERTO", label: "Llegada al Almacén/Puerto" },
  { key: "INGRESO_ALMACEN_PUERTO", label: "Ingreso al Almacén/Puerto" },
  { key: "SALIDA_ALMACEN_PUERTO", label: "Salida del Almacén/Puerto" },
  { key: "LLEGADA_COCHERA", label: "Llegada a Cochera" },
];

export function getEvents(type: string) {
  return type === "EXPORTACION" ? EXPORT_EVENTS : IMPORT_EVENTS;
}

export const ROLES = {
  ADMINISTRADOR: "ADMINISTRADOR",
  JEFE_TRANSPORTE: "JEFE_TRANSPORTE",
  SUPERVISOR: "SUPERVISOR",
  ANALISTA: "ANALISTA",
  CONDUCTOR: "CONDUCTOR",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  JEFE_TRANSPORTE: "Jefe de Transporte",
  SUPERVISOR: "Supervisor",
  ANALISTA: "Analista",
  CONDUCTOR: "Conductor",
};

export function canManageUsers(role: string) {
  return role === "ADMINISTRADOR";
}

export function canManageOrders(role: string) {
  return ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(role);
}

export function canViewReports(role: string) {
  return ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"].includes(role);
}

export function canRegisterEvents(role: string) {
  return role === "CONDUCTOR";
}
