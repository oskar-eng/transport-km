import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as { id: string; role: string };
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (user.role === "CONDUCTOR") where.driverId = user.id;
  if (status) where.status = status;
  if (type) where.type = type;

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      driver: { select: { id: true, name: true } },
      unit: { select: { id: true, plate: true, model: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();

  // Validar que la unidad y el conductor no estén en un servicio activo
  const [unitBusy, driverBusy] = await Promise.all([
    prisma.serviceOrder.findFirst({ where: { unitId: body.unitId, status: "ACTIVO" } }),
    prisma.serviceOrder.findFirst({ where: { driverId: body.driverId, status: "ACTIVO" } }),
  ]);
  if (unitBusy) return NextResponse.json({ error: `La unidad ya está en el servicio ${unitBusy.orderNumber}. Debe finalizarse antes de asignar uno nuevo.` }, { status: 400 });
  if (driverBusy) return NextResponse.json({ error: `El conductor ya está en el servicio ${driverBusy.orderNumber}. Debe finalizarse antes de asignar uno nuevo.` }, { status: 400 });

  const order = await prisma.serviceOrder.create({
    data: {
      orderNumber: body.orderNumber,
      type: body.type,
      clientName: body.clientName,
      origin: body.origin,
      destination: body.destination,
      containerNumber: body.containerNumber,
      driverId: body.driverId,
      unitId: body.unitId,
      status: "ACTIVO",
    },
    include: { driver: { select: { name: true } }, unit: { select: { plate: true } } },
  });

  // Marcar unidad como EN_SERVICIO automáticamente
  await prisma.unit.update({ where: { id: body.unitId }, data: { status: "EN_SERVICIO" } });

  // Enviar notificación push al conductor
  const subs = await prisma.pushSubscription.findMany({ where: { userId: body.driverId } });
  if (subs.length > 0) {
    const payload = JSON.stringify({
      title: "📦 Nueva orden asignada",
      body: `Orden ${order.orderNumber} — ${body.type === "IMPORTACION" ? "Importación" : "Exportación"} · ${order.clientName}`,
      url: `/orders/${order.id}`,
    });
    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );
  }

  return NextResponse.json(order, { status: 201 });
}
