import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const status = searchParams.get("status");

  const records = await prisma.maintenanceRecord.findMany({
    where: {
      ...(unitId ? { unitId } : {}),
      ...(status ? { status } : {}),
    },
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.unitId || !body.type || !body.description || !body.date || !body.odometer) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const record = await prisma.maintenanceRecord.create({
    data: {
      unitId:      body.unitId,
      type:        body.type,
      status:      body.status ?? "PENDIENTE",
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

  return NextResponse.json(record, { status: 201 });
}
