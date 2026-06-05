import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const plan = await prisma.preventivePlan.update({ where: { id }, data: { ...(body.status ? { status: body.status } : {}) }, include: { unit: { select: { plate: true, model: true, brand: true } } } });
  return NextResponse.json({ ...plan, scheduledDate: plan.scheduledDate?.toISOString() ?? null, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.preventivePlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
