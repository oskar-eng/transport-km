import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEvents } from "@/lib/events";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { serviceOrderId, eventType, odometer, notes, latitude, longitude } = body;

  const order = await prisma.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { events: true },
  });
  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  const eventList = getEvents(order.type);
  const eventKeys = eventList.map((e) => e.key);
  const alreadyRegistered = order.events.map((e) => e.eventType);
  const nextExpected = eventKeys.find((k) => !alreadyRegistered.includes(k));

  if (eventType !== nextExpected) {
    return NextResponse.json(
      { error: `El siguiente evento esperado es: ${nextExpected}` },
      { status: 400 }
    );
  }

  const event = await prisma.serviceEvent.create({
    data: { serviceOrderId, eventType, odometer: odometer ? Number(odometer) : null, notes, latitude, longitude },
  });

  const isLast = eventType === eventKeys[eventKeys.length - 1];
  if (isLast) {
    await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { status: "COMPLETADO" },
    });
    // Unidad vuelve a DISPONIBLE al llegar a cochera
    await prisma.unit.update({ where: { id: order.unitId }, data: { status: "DISPONIBLE" } });
  }

  return NextResponse.json(event, { status: 201 });
}
