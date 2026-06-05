import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });
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
              text: `Analiza este comprobante/voucher de combustible (puede ser de Repsol, Petroperu, Niubiz, Primax u otra estación de servicio peruana) y extrae los siguientes datos. Si un campo no está visible, devuelve null.

Devuelve ÚNICAMENTE el JSON sin explicaciones ni markdown:

{
  "plate": "número de placa del vehículo (ej: BFT-857)",
  "date": "fecha en formato YYYY-MM-DD",
  "liters": cantidad en GALONES (si el recibo está en litros, conviértelo a galones: 1 GAL = 3.785 litros),
  "unit": "GAL o LT (unidad original en el recibo)",
  "quantityOriginal": cantidad original del recibo sin convertir,
  "pricePerLiter": precio por galón como número (si está disponible),
  "totalCost": monto total en soles como número,
  "odometer": kilometraje como número entero (quita puntos y comas),
  "station": "nombre de la estación o grifo",
  "fuelType": "DIESEL o GASOLINA o GNV",
  "driverName": "nombre del conductor si aparece",
  "driverDni": "DNI del conductor si aparece"
}`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No se pudo extraer datos del voucher" }, { status: 422 });

    const data = JSON.parse(jsonMatch[0]);

    // El campo "liters" representa galones. Si el recibo vino en litros, convertir a galones.
    if (data.unit === "LT" && data.quantityOriginal) {
      data.liters = parseFloat((data.quantityOriginal / 3.785).toFixed(2));
    } else if (data.unit === "GAL" && data.quantityOriginal) {
      data.liters = parseFloat(Number(data.quantityOriginal).toFixed(2));
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("parse-fuel error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar imagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
