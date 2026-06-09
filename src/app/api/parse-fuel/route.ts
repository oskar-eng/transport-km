import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Modelo de Google Gemini con visión
const GEMINI_MODEL = "gemini-2.5-flash";

// Tipos de comprobante:
//   DESPACHO = vale del grifo (Repsol/Primax/Petroperú): muestra producto y CANTIDAD de combustible (galones/litros)
//   PAGO     = voucher de pago con tarjeta/POS (Niubiz/Izipay/Visa): muestra MONTO pagado en soles
const PROMPT = `Eres un clasificador y extractor de comprobantes de combustible peruanos.

PASO 1 — CLASIFICA la imagen en uno de estos tipos:
- "DESPACHO": vale o ticket de un grifo/estación (Repsol, Primax, Petroperú, etc.) que muestra el PRODUCTO y la CANTIDAD de combustible despachado (galones o litros). Suele decir "Diesel", "GAL", cantidad de combustible.
- "PAGO": voucher de pago con tarjeta o POS (Niubiz, Izipay, Visa, Mastercard) que muestra el MONTO PAGADO en soles, número de operación y/o tarjeta. NO muestra cantidad de combustible.
- "OTRO": cualquier imagen que NO sea un comprobante de combustible (foto de otra cosa, documento distinto, etc.).

PASO 2 — Evalúa si la imagen es LEGIBLE: texto nítido, enfocado y se entiende. Si está borrosa, oscura o cortada, marca legible=false.

PASO 3 — Extrae los datos visibles. Si un campo no está visible, devuelve null.

Devuelve ÚNICAMENTE este JSON sin explicaciones ni markdown:
{
  "documentType": "DESPACHO" | "PAGO" | "OTRO",
  "legible": true | false,
  "plate": "número de placa del vehículo (ej: A2K-942)",
  "date": "fecha en formato YYYY-MM-DD",
  "liters": cantidad en GALONES (si está en litros conviértelo: 1 GAL = 3.785 litros),
  "unit": "GAL o LT (unidad original)",
  "quantityOriginal": cantidad original sin convertir,
  "totalCost": monto total pagado en soles como número,
  "odometer": kilometraje como número entero (quita puntos y comas),
  "station": "nombre de la estación o grifo",
  "fuelType": "DIESEL o GASOLINA o GNV",
  "driverName": "nombre del conductor si aparece",
  "driverDni": "DNI del conductor si aparece",
  "operationNumber": "número de operación si aparece"
}`;

const TIPO_LABEL: Record<string, string> = {
  DESPACHO: "vale de despacho del grifo",
  PAGO: "comprobante de pago (Niubiz)",
};

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
    // Tipo esperado para este recibo: "DESPACHO" | "PAGO" (opcional)
    const expectedType = (formData.get("expectedType") as string | null)?.toUpperCase() || null;
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

    // ── Validación de tipo y legibilidad ──
    // Imagen borrosa / ilegible → rechazar
    if (data.legible === false) {
      return NextResponse.json(
        { error: "La foto está borrosa o no se entiende. Tómala de nuevo bien enfocada, con buena luz y sin recortar el comprobante." },
        { status: 422 },
      );
    }
    // No es un comprobante de combustible
    if (data.documentType === "OTRO") {
      return NextResponse.json(
        { error: "Esa imagen no parece un comprobante de combustible. Sube el vale del grifo o el voucher de pago." },
        { status: 422 },
      );
    }
    // Subió el comprobante equivocado para esta casilla
    if (expectedType && (expectedType === "DESPACHO" || expectedType === "PAGO") && data.documentType !== expectedType) {
      const esperado = TIPO_LABEL[expectedType];
      const subido = TIPO_LABEL[data.documentType] ?? "otro tipo de comprobante";
      return NextResponse.json(
        { error: `Aquí va el ${esperado}, pero subiste un ${subido}. Verifica la foto e inténtalo de nuevo.` },
        { status: 422 },
      );
    }

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
