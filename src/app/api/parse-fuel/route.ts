import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Modelo de Google Gemini con visión
const GEMINI_MODEL = "gemini-2.5-flash";

const PROMPT = `Analiza este comprobante/voucher de combustible (puede ser de Repsol, Petroperu, Niubiz, Primax u otra estación de servicio peruana) y extrae los siguientes datos. Si un campo no está visible, devuelve null.

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
          maxOutputTokens: 700,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("parse-fuel gemini error:", res.status, errBody);
      return NextResponse.json({ error: "No se pudo procesar el voucher. Intenta con otra foto más clara." }, { status: 500 });
    }

    const result = await res.json();
    const text: string = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
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
