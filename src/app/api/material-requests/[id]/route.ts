import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — aprobar/entregar + adjuntar foto del producto y comprobante al recibir
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const r = await prisma.materialRequest.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.productPhotoUrl !== undefined ? { productPhotoUrl: body.productPhotoUrl || null } : {}),
      ...(body.receiptUrl !== undefined ? { receiptUrl: body.receiptUrl || null } : {}),
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.materialRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
