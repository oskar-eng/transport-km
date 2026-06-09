import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const card = await prisma.fuelCard.update({
    where: { id },
    data: {
      ...(body.cardNumber !== undefined ? { cardNumber: body.cardNumber || null } : {}),
      ...(body.holderName ? { holderName: body.holderName } : {}),
      ...(body.holderDni ? { holderDni: String(body.holderDni) } : {}),
      ...(body.driverId !== undefined ? { driverId: body.driverId || null } : {}),
      ...(body.unitId !== undefined ? { unitId: body.unitId || null } : {}),
      ...(body.monthlyLimit != null ? { monthlyLimit: Number(body.monthlyLimit) } : {}),
      ...(body.active !== undefined ? { active: !!body.active } : {}),
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(card);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  await prisma.fuelCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
