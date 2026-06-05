import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { unitHabilitado } from "@/lib/vehicleDocsFixed";
import { driverHabilitado } from "@/lib/driverDocs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STATUS_LABELS: Record<string, string> = {
  DISPONIBLE: "Operativo", EN_SERVICIO: "En Servicio",
  MANTENIMIENTO: "En Taller", FUERA_SERVICIO: "Inactivo",
};

// Arma una foto compacta de los datos de la flota para dar contexto al asistente
async function buildSnapshot() {
  const [units, drivers, maints, orders] = await Promise.all([
    prisma.unit.findMany({ include: { unitDocuments: true } }),
    prisma.user.findMany({
      where: { role: "CONDUCTOR" },
      include: { driverProfile: { include: { documents: true } } },
    }),
    prisma.maintenanceRecord.findMany({
      include: { unit: { select: { plate: true } } },
      orderBy: { date: "desc" }, take: 40,
    }),
    prisma.serviceOrder.findMany({
      include: { unit: { select: { plate: true } }, driver: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 30,
    }),
  ]);

  return {
    unidades: units.map(u => ({
      placa: u.plate, marca: u.brand, modelo: u.model, anio: u.year,
      ejes: u.axles, tipoLocal: u.localType,
      estadoOperativo: STATUS_LABELS[u.status] ?? u.status,
      habilitado: unitHabilitado(u.unitDocuments.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl }))),
    })),
    conductores: drivers.map(c => ({
      nombre: c.driverProfile ? `${c.driverProfile.firstName} ${c.driverProfile.lastName}` : c.name,
      dni: c.driverProfile?.dni ?? null,
      licencia: c.driverProfile?.licenseNumber ?? null,
      categoria: c.driverProfile?.licenseCategory ?? null,
      estado: c.driverProfile?.status ?? null,
      habilitado: c.driverProfile ? driverHabilitado(c.driverProfile.documents.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl }))) : false,
    })),
    mantenimientos: maints.map(m => ({
      placa: m.unit.plate, tipo: m.type, descripcion: m.description,
      estado: m.status, fecha: m.date.toISOString().slice(0, 10),
      proximaFecha: m.nextDate?.toISOString().slice(0, 10) ?? null,
    })),
    ordenes: orders.map(o => ({
      numero: o.orderNumber, tipo: o.type, estado: o.status,
      cliente: o.clientName, placa: o.unit.plate, conductor: o.driver.name,
    })),
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "El asistente no está configurado todavía (falta ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  try {
    const { messages } = await req.json();
    const snapshot = await buildSnapshot();

    const system = `Eres "Yacz", el asistente virtual de la empresa Transporte Yacz Cargo (gestión de flota de transporte de carga en Perú).
Respondes preguntas del personal sobre la flota basándote ÚNICAMENTE en los datos proporcionados abajo.

Reglas:
- Responde en español, de forma breve y clara.
- Si te preguntan por placas/unidades/conductores en cierto estado, lista los que correspondan.
- "Habilitado" = todos sus documentos están vigentes. "Deshabilitado/Inhabilitado" = le falta o venció algún documento.
- "En Taller" o "MANTENIMIENTO" = unidad en mantenimiento.
- Si no hay datos para responder, dilo claramente. No inventes.
- Usa viñetas cuando listes varios elementos.

DATOS ACTUALES DE LA FLOTA (en formato JSON):
${JSON.stringify(snapshot)}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: (messages ?? []).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });

    const text = response.content.find(c => c.type === "text");
    return NextResponse.json({ reply: text && text.type === "text" ? text.text : "No pude generar una respuesta." });
  } catch (err: unknown) {
    console.error("chat error:", err);
    const msg = err instanceof Error ? err.message : "Error en el asistente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
