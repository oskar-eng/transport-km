import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const record = await prisma.fuelRecord.update({
    where: { id },
    data: {
      date:          new Date(body.date),
      liters:        Number(body.liters),
      pricePerLiter: body.pricePerLiter ? Number(body.pricePerLiter) : null,
      totalCost:     body.totalCost ? Number(body.totalCost) : null,
      odometer:      Number(body.odometer),
      station:       body.station || null,
      fuelType:      body.fuelType || "DIESEL",
      notes:         body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(record);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.fuelRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
