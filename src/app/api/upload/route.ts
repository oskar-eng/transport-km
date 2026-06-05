import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

// Si hay Cloudinary configurado → usa cloud (subida firmada)
// Si no → guarda local (desarrollo)
const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  // Carpeta destino: "units" (fotos) o "documents" (PDFs/imágenes de docs)
  const folder = (formData.get("folder") as string) || "units";
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  /* ── CLOUDINARY (producción) — subida firmada ── */
  if (USE_CLOUDINARY) {
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;
    const cloudFolder = `transport-km/${folder}`;
    const timestamp = Math.round(Date.now() / 1000);

    // Firma SHA-1 de los parámetros ordenados alfabéticamente + api_secret
    const toSign = `folder=${cloudFolder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(toSign + process.env.CLOUDINARY_API_SECRET)
      .digest("hex");

    const form = new FormData();
    form.append("file", dataUri);
    form.append("api_key", process.env.CLOUDINARY_API_KEY!);
    form.append("timestamp", String(timestamp));
    form.append("folder", cloudFolder);
    form.append("signature", signature);

    // "auto": imágenes y PDFs → tipo "image" (se renderizan en el visor);
    // requiere "Allow delivery of PDF and ZIP files" activado en Cloudinary.
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: "POST", body: form }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? "Error Cloudinary" }, { status: 500 });
    return NextResponse.json({ url: data.secure_url });
  }

  /* ── LOCAL (desarrollo) ── */
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const prefix = folder === "documents" ? "doc" : "unit";
  const name = `${prefix}_${Date.now()}.${ext}`;
  const dir  = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return NextResponse.json({ url: `/uploads/${folder}/${name}` });
}
