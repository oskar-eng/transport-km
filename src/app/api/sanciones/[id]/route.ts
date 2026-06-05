import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const s = await prisma.sancion.update({
    where: { id },
    data: { ...(body.status ? { status: body.status } : {}) },
    include: { unit: { select: { plate: true, model: true } }, driver: { select: { name: true } } },
  });
  return NextResponse.json({ ...s, date: s.date.toISOString(), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.sancion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
