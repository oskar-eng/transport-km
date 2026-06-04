import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEvents } from "@/lib/events";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const order = await prisma.serviceOrder.findUnique({
    where: { shareToken: token },
    include: {
      driver: { select: { name: true } },
      unit: { select: { plate: true, model: true, year: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "Enlace inválido" }, { status: 404 });

  const eventDefs = getEvents(order.type);

  // Build timeline: all defined states with registration info if available
  const timeline = eventDefs.map((def, idx) => {
    const reg = order.events.find((e) => e.eventType === def.key);
    return {
      key: def.key,
      label: def.label,
      index: idx + 1,
      registered: !!reg,
      timestamp: reg?.timestamp ?? null,
      odometer: reg?.odometer ?? null,
      notes: reg?.notes ?? null,
      latitude: reg?.latitude ?? null,
      longitude: reg?.longitude ?? null,
    };
  });

  // All GPS points (for trajectory polyline)
  const gpsPoints = order.events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
      lat: e.latitude as number,
      lng: e.longitude as number,
      eventType: e.eventType,
      label: eventDefs.find((d) => d.key === e.eventType)?.label ?? e.eventType,
      timestamp: e.timestamp,
    }));

  // Last known position
  const lastGps = gpsPoints[gpsPoints.length - 1] ?? null;

  return NextResponse.json({
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    clientName: order.clientName,
    origin: order.origin,
    destination: order.destination,
    containerNumber: order.containerNumber,
    driver: order.driver.name,
    unit: `${order.unit.plate} · ${order.unit.model} ${order.unit.year}`,
    timeline,
    gpsPoints,
    lastGps,
  });
}
