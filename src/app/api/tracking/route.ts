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
      events: { orderBy: { timestamp: "asc" } },
    },
  });

  const units = activeOrders
    .map((order) => {
      const gpsEvents = order.events.filter((e) => e.latitude != null && e.longitude != null);
      if (gpsEvents.length === 0) return null;
      const lastEvent = gpsEvents[gpsEvents.length - 1];

      // km recorridos en este servicio: último odómetro − primer odómetro
      const odos = order.events.filter((e) => e.odometer != null).map((e) => e.odometer as number);
      const kmRecorridos = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : null;

      const eventDefs = getEvents(order.type);
      const label = eventDefs.find((e) => e.key === lastEvent.eventType)?.label ?? lastEvent.eventType;
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        clientName: order.clientName,
        driver: { name: order.driver.name },
        unit: { plate: order.unit.plate, model: order.unit.model },
        kmRecorridos,
        lastEvent: {
          eventType: lastEvent.eventType,
          label,
          timestamp: lastEvent.timestamp,
          odometer: lastEvent.odometer,
          latitude: lastEvent.latitude as number,
          longitude: lastEvent.longitude as number,
        },
      };
    })
    .filter((u) => u !== null);

  return NextResponse.json(units);
}
