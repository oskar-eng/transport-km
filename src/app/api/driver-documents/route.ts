import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSolicitud } from "@/lib/createSolicitud";
import { DRIVER_DOC_TYPES } from "@/lib/driverDocs";

// POST — crear/actualizar un documento del conductor (upsert por driverId + type)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.driverId || !body.type) {
    return NextResponse.json({ error: "driverId y type son obligatorios" }, { status: 400 });
  }

  const doc = await prisma.driverDocument.upsert({
    where:  { driverId_type: { driverId: body.driverId, type: body.type } },
    create: {
      driverId:   body.driverId,
      type:       body.type,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl:    body.fileUrl || null,
    },
    update: {
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl:    body.fileUrl || null,
    },
  });

  // Registrar solicitud (historial) si se adjuntó archivo
  if (body.fileUrl) {
    const me = session.user as { id: string; name: string };
    const profile = await prisma.driverProfile.findUnique({ where: { id: body.driverId }, select: { dni: true, firstName: true, lastName: true } });
    const label = DRIVER_DOC_TYPES.find(t => t.key === body.type)?.label ?? body.type;
    await createSolicitud({
      entidad: "CHOFER", docOrPlate: profile?.dni ?? "—",
      entityName: profile ? `${profile.firstName} ${profile.lastName}` : null,
      docType: label, fileUrl: body.fileUrl, expiryDate: body.expiryDate || null,
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
