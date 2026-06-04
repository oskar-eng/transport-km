import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, email: true } },
      unit: { select: { id: true, plate: true, model: true, year: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Cierre anticipado: registrar evento especial con la nota de cierre
  if (body.action === "close_early") {
    if (!body.reason) return NextResponse.json({ error: "La razón de cierre es obligatoria" }, { status: 400 });

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        status: "COMPLETADO",
        events: {
          create: {
            eventType: "CIERRE_ANTICIPADO",
            notes: body.reason,
            odometer: body.odometer ? Number(body.odometer) : null,
          },
        },
      },
    });
    // Unidad vuelve a DISPONIBLE al cerrar anticipadamente
    await prisma.unit.update({ where: { id: order.unitId }, data: { status: "DISPONIBLE" } });
    return NextResponse.json(order);
  }

  const order = await prisma.serviceOrder.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(order);
}
