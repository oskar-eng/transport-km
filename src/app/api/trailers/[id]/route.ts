import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const trailer = await prisma.trailer.update({
    where: { id },
    data: {
      plate:         body.plate ? String(body.plate).toUpperCase() : undefined,
      length:        body.length !== undefined ? (body.length ? Number(body.length) : null) : undefined,
      equipmentType: body.equipmentType !== undefined ? (body.equipmentType || null) : undefined,
      year:          body.year ? Number(body.year) : undefined,
      axles:         body.axles !== undefined ? (body.axles ? Number(body.axles) : null) : undefined,
      tare:          body.tare !== undefined ? (body.tare ? Number(body.tare) : null) : undefined,
      localType:     body.localType !== undefined ? (body.localType || null) : undefined,
      photoUrl:      body.photoUrl !== undefined ? body.photoUrl : undefined,
      notes:         body.notes !== undefined ? (body.notes || null) : undefined,
      ...(body.status ? { status: body.status } : {}),
    },
  });
  return NextResponse.json({ ...trailer, createdAt: trailer.createdAt.toISOString(), updatedAt: trailer.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (user.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.trailer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
