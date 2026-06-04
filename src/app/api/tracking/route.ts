import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEvents } from "@/lib/events";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const activeOrders = await prisma.serviceOrder.findMany({
    where: { status: "ACTIVO" },
    include: {
      driver: { select: { id: true, name: true } },
      unit: { select: { plate: true, model: true } },
      events: {
        where: { latitude: { not: null } },
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const units = activeOrders
    .filter((order) => order.events.length > 0)
    .map((order) => {
      const lastEvent = order.events[0];
      const eventDefs = getEvents(order.type);
      const label = eventDefs.find((e) => e.key === lastEvent.eventType)?.label ?? lastEvent.eventType;
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        clientName: order.clientName,
        driver: { name: order.driver.name },
        unit: { plate: order.unit.plate, model: order.unit.model },
        lastEvent: {
          eventType: lastEvent.eventType,
          label,
          timestamp: lastEvent.timestamp,
          odometer: lastEvent.odometer,
          latitude: lastEvent.latitude as number,
          longitude: lastEvent.longitude as number,
        },
      };
    });

  return NextResponse.json(units);
}
