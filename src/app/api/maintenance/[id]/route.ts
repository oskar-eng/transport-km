import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const record = await prisma.maintenanceRecord.update({
    where: { id },
    data: {
      type:        body.type,
      status:      body.status,
      description: body.description,
      date:        new Date(body.date),
      odometer:    Number(body.odometer),
      workshop:    body.workshop || null,
      technician:  body.technician || null,
      cost:        body.cost ? Number(body.cost) : null,
      nextDate:    body.nextDate ? new Date(body.nextDate) : null,
      nextOdometer: body.nextOdometer ? Number(body.nextOdometer) : null,
      notes:       body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });

  return NextResponse.json(record);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.maintenanceRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
