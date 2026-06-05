import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Modelo de Google Gemini con visión (lee imágenes)
const GEMINI_MODEL = "gemini-2.5-flash";

const PROMPT = `Analiza esta imagen de datos vehiculares (puede ser de SUNARP, tarjeta de propiedad u otro registro oficial peruano) y extrae SOLO los siguientes campos en formato JSON. Si un campo no está visible, devuelve null para ese campo.

Devuelve ÚNICAMENTE el JSON, sin explicaciones ni markdown:

{
  "plate": "número de placa",
  "brand": "marca del vehículo",
  "model": "modelo",
  "year": año como número entero,
  "vin": "número VIN o número de serie",
  "color": "color",
  "ownerCompany": "nombre del propietario o empresa",
  "vehicleType": "tipo de vehículo (ej: Camión, Tractocamión, etc.)"
}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "El escáner no está configurado (falta GEMINI_API_KEY)." }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("parse-vehicle gemini error:", res.status, errBody);
      return NextResponse.json({ error: "No se pudo procesar la imagen. Intenta con otra foto más clara." }, { status: 500 });
    }

    const result = await res.json();
    const text: string = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    // Parse JSON — por si viene con markdown o texto extra
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No se pudo extraer datos de la imagen" }, { status: 422 });

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("parse-vehicle error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar imagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
