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

  const wo = await prisma.workOrder.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status, ...(body.status === "CERRADA" ? { closedAt: new Date() } : {}) } : {}),
      ...(body.diagnosis !== undefined ? { diagnosis: body.diagnosis || null } : {}),
      ...(body.mechanic !== undefined ? { mechanic: body.mechanic || null } : {}),
      ...(body.testsDone !== undefined ? { testsDone: body.testsDone || null } : {}),
      ...(body.evidenceUrl !== undefined ? { evidenceUrl: body.evidenceUrl || null } : {}),
      ...(body.laborCost !== undefined ? { laborCost: body.laborCost ? Number(body.laborCost) : null } : {}),
    },
    include: { unit: { select: { plate: true, model: true, brand: true } }, materials: true },
  });
  return NextResponse.json({ ...wo, openedAt: wo.openedAt.toISOString(), closedAt: wo.closedAt?.toISOString() ?? null, createdAt: wo.createdAt.toISOString(), updatedAt: wo.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.workOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
