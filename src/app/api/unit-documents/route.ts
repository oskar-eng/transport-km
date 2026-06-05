import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSolicitud } from "@/lib/createSolicitud";
import { UNIT_DOC_TYPES } from "@/lib/vehicleDocsFixed";

// POST — crear/actualizar un documento de la unidad (upsert por unitId + type)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.unitId || !body.type) {
    return NextResponse.json({ error: "unitId y type son obligatorios" }, { status: 400 });
  }

  const doc = await prisma.unitDocument.upsert({
    where:  { unitId_type: { unitId: body.unitId, type: body.type } },
    create: {
      unitId:     body.unitId,
      type:       body.type,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl:    body.fileUrl || null,
    },
    update: {
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl:    body.fileUrl || null,
    },
  });

  if (body.fileUrl) {
    const me = session.user as { id: string; name: string };
    const unit = await prisma.unit.findUnique({ where: { id: body.unitId }, select: { plate: true, model: true, localType: true } });
    const label = UNIT_DOC_TYPES.find(t => t.key === body.type)?.label ?? body.type;
    await createSolicitud({
      entidad: "CAMION", docOrPlate: unit?.plate ?? "—", entityName: unit?.model ?? null,
      localType: unit?.localType ?? null, docType: label, fileUrl: body.fileUrl, expiryDate: body.expiryDate || null,
      userId: me.id, userName: me.name,
    });
  }

  return NextResponse.json({
    ...doc,
    expiryDate: doc.expiryDate?.toISOString() ?? null,
    createdAt:  doc.createdAt.toISOString(),
    updatedAt:  doc.updatedAt.toISOString(),
  });
}
