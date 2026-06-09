import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unitHabilitado, unitDocStatus, UNIT_DOC_TYPES } from "@/lib/vehicleDocsFixed";
import { driverHabilitado, docStatus, DRIVER_DOC_TYPES } from "@/lib/driverDocs";

// Detalla el estado de cada documento obligatorio (cuál falta, vencido, por vencer u OK)
function detalleDocs<T extends { key: string; label: string }>(
  tipos: T[],
  docs: { type: string; expiryDate: string | null; fileUrl: string | null }[],
  estado: (d?: { type: string; expiryDate: string | null; fileUrl: string | null }) => { label: string },
) {
  return tipos.map(t => {
    const doc = docs.find(d => d.type === t.key);
    const st = estado(doc);
    return {
      documento: t.label,
      estado: st.label, // OK | POR VENCER | VENCIDO | FALTA | FALTA FECHA
      vence: doc?.expiryDate ? doc.expiryDate.slice(0, 10) : null,
    };
  });
}

// Modelo gratuito y rápido de Google Gemini
// Si el primer modelo está saturado (429), se intenta con el siguiente (cuota separada).
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

async function callGemini(apiKey: string, body: object): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  let lastStatus = 500;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true, data: await res.json() };
    lastStatus = res.status;
    const errBody = await res.text();
    console.error(`gemini ${model} error:`, res.status, errBody.slice(0, 300));
    if (res.status === 429) continue;
    break;
  }
  return { ok: false, status: lastStatus };
}

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
    unidades: units.map(u => {
      const docs = u.unitDocuments.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl }));
      return {
        placa: u.plate, marca: u.brand, modelo: u.model, anio: u.year,
        ejes: u.axles, tipoLocal: u.localType,
        estadoOperativo: STATUS_LABELS[u.status] ?? u.status,
        habilitado: unitHabilitado(docs),
        documentos: detalleDocs(UNIT_DOC_TYPES, docs, unitDocStatus),
      };
    }),
    conductores: drivers.map(c => {
      const docs = c.driverProfile?.documents.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl })) ?? [];
      return {
        nombre: c.driverProfile ? `${c.driverProfile.firstName} ${c.driverProfile.lastName}` : c.name,
        dni: c.driverProfile?.dni ?? null,
        licencia: c.driverProfile?.licenseNumber ?? null,
        categoria: c.driverProfile?.licenseCategory ?? null,
        estado: c.driverProfile?.status ?? null,
        habilitado: c.driverProfile ? driverHabilitado(docs) : false,
        documentos: c.driverProfile ? detalleDocs(DRIVER_DOC_TYPES, docs, docStatus) : [],
      };
    }),
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "El asistente no está configurado todavía (falta GEMINI_API_KEY)." }, { status: 503 });
  }

  try {
    const { messages } = await req.json();
    const snapshot = await buildSnapshot();

    const system = `Eres "Yacz", la asistente virtual de la empresa Transporte Yacz Cargo (gestión de flota de transporte de carga en Perú).
Eres una asistente MUJER, cálida, cariñosa y cercana. Respondes con dulzura y amabilidad, como una compañera atenta que quiere ayudar.
Respondes preguntas del personal sobre la flota basándote ÚNICAMENTE en los datos proporcionados abajo.

Personalidad y tono:
- Habla en femenino ("estoy lista para ayudarte", "encantada", "con mucho gusto").
- Sé cariñosa y cordial: usa expresiones como "¡Hola! 😊", "claro que sí", "con todo gusto", "cuídate mucho", "estoy para apoyarte".
- Puedes usar uno o dos emojis suaves (😊💙✨📋), sin exagerar.
- Mantén la respuesta clara y útil; el cariño no debe quitar precisión.

Reglas de información:
- Responde en español.
- Cada unidad y cada conductor traen una lista "documentos" con: documento, estado (OK, POR VENCER, VENCIDO, FALTA o FALTA FECHA) y fecha de vencimiento.
- "OK" = vigente. "POR VENCER" = vence en menos de 30 días. "VENCIDO" = ya caducó. "FALTA" = no se ha subido. "FALTA FECHA" = está subido pero sin fecha de vencimiento.
- Cuando te pregunten por documentos de una placa o conductor, REVISA su lista "documentos" y di claramente cuáles faltan, cuáles están vencidos, cuáles por vencer y cuáles OK. Menciona el nombre del documento y su fecha de vencimiento si la tiene.
- "Habilitado" = TODOS sus documentos están vigentes (con archivo y fecha al día). "Deshabilitado/Inhabilitado" = le falta o venció algún documento; en ese caso indica EXACTAMENTE cuál(es) es el problema.
- "En Taller" o "MANTENIMIENTO" = unidad en mantenimiento.
- Si no hay datos para responder, dilo con amabilidad. Nunca inventes información.
- Usa viñetas cuando listes varios elementos para que se lea fácil.

DATOS ACTUALES DE LA FLOTA (en formato JSON):
${JSON.stringify(snapshot)}`;

    // Gemini usa los roles "user" y "model"
    const contents = (messages ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const gem = await callGemini(apiKey, {
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.6,
        // Desactiva el "pensamiento" de 2.5-flash para respuestas completas, rápidas y económicas
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!gem.ok) {
      if (gem.status === 429) {
        return NextResponse.json({ error: "Estoy atendiendo muchas consultas en este momento 😅. Espera unos segundos e intenta de nuevo, porfa 💙" }, { status: 429 });
      }
      return NextResponse.json({ error: "El asistente tuvo un problema al responder. Intenta de nuevo." }, { status: 500 });
    }

    const data = gem.data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const reply = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
    return NextResponse.json({ reply: reply || "No pude generar una respuesta." });
  } catch (err: unknown) {
    console.error("chat error:", err);
    const msg = err instanceof Error ? err.message : "Error en el asistente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
