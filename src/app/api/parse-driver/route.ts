import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

const PROMPT_DNI = `Analiza esta imagen del Documento Nacional de Identidad (DNI) peruano y extrae los datos. Si un campo no está visible, devuelve null.
Devuelve ÚNICAMENTE este JSON sin explicaciones ni markdown:
{
  "dni": "número de DNI (8 dígitos)",
  "firstName": "nombres (prenombres)",
  "lastName": "apellidos (paterno y materno juntos)"
}`;

const PROMPT_LICENCIA = `Analiza esta imagen de la Licencia de Conducir peruana y extrae los datos. Si un campo no está visible, devuelve null.
Devuelve ÚNICAMENTE este JSON sin explicaciones ni markdown:
{
  "licenseNumber": "número de licencia (ej: Q12345678)",
  "licenseCategory": "categoría exacta (ej: A-IIIb, A-IIa, A-I)",
  "licenseExpiry": "fecha de vencimiento/revalidación en formato YYYY-MM-DD",
  "dni": "número de DNI si aparece",
  "firstName": "nombres si aparecen",
  "lastName": "apellidos si aparecen"
}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "El escáner no está configurado (falta GEMINI_API_KEY)." }, { status: 503 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = ((formData.get("docType") as string | null) ?? "DNI").toUpperCase();
    if (!file) return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const prompt = docType === "LICENCIA" ? PROMPT_LICENCIA : PROMPT_DNI;

    const gem = await callGemini(apiKey, {
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json" },
    });

    if (!gem.ok) {
      if (gem.status === 429) return NextResponse.json({ error: "El lector está muy ocupado. Espera unos segundos e intenta de nuevo." }, { status: 429 });
      return NextResponse.json({ error: "No se pudo procesar la imagen. Intenta con otra foto más clara." }, { status: 500 });
    }

    const result = gem.data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text: string = result?.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No se pudo extraer datos de la imagen" }, { status: 422 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err: unknown) {
    console.error("parse-driver error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar imagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
