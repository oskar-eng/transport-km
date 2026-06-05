import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sanciones = await prisma.sancion.findMany({
    include: {
      unit: { select: { plate: true, model: true } },
      driver: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(sanciones.map(s => ({
    ...s,
    date: s.date.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.type || !body.description || !body.date) {
    return NextResponse.json({ error: "Tipo, descripción y fecha son obligatorios" }, { status: 400 });
  }
  if (!body.unitId && !body.driverId) {
    return NextResponse.json({ error: "Debe asociar la sanción a una unidad o a un conductor" }, { status: 400 });
  }

  const s = await prisma.sancion.create({
    data: {
      unitId:      body.unitId || null,
      driverId:    body.driverId || null,
      type:        body.type,
      description: body.description,
      amount:      body.amount != null && body.amount !== "" ? Number(body.amount) : null,
      date:        new Date(body.date),
      status:      body.status ?? "PENDIENTE",
      documentUrl: body.documentUrl || null,
    },
    include: { unit: { select: { plate: true, model: true } }, driver: { select: { name: true } } },
  });

  return NextResponse.json({
    ...s, date: s.date.toISOString(), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  }, { status: 201 });
}
