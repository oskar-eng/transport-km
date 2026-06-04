import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada en .env" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analiza esta imagen de datos vehiculares (puede ser de SUNARP u otro registro oficial peruano) y extrae SOLO los siguientes campos en formato JSON. Si un campo no está visible, devuelve null para ese campo.

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
}`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON — handle possible markdown code blocks
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
