import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const u = session.user as { role: string };
  if (u.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = { name: body.name, role: body.role, active: body.active };
  if (body.password) data.password = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const me = session.user as { id: string; role: string };
  if (me.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;

  // No puedes eliminarte a ti mismo
  if (id === me.id) return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 400 });

  // No permitir si tiene órdenes asociadas (mejor desactivar)
  const ordersCount = await prisma.serviceOrder.count({ where: { driverId: id } });
  if (ordersCount > 0) {
    return NextResponse.json({ error: `El usuario tiene ${ordersCount} orden(es) asociada(s). Desactívalo en lugar de eliminarlo.` }, { status: 409 });
  }

  // No eliminar el último administrador
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (target?.role === "ADMINISTRADOR") {
    const admins = await prisma.user.count({ where: { role: "ADMINISTRADOR" } });
    if (admins <= 1) return NextResponse.json({ error: "No puedes eliminar el único administrador." }, { status: 400 });
  }

  // Eliminar dependencias: perfil de conductor (cascada sus documentos) y suscripciones push
  await prisma.driverProfile.deleteMany({ where: { userId: id } });
  await prisma.pushSubscription.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
