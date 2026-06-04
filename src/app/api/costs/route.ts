import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");

  const costs = await prisma.otherCost.findMany({
    where: unitId ? { unitId } : {},
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(costs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const body = await req.json();
  const cost = await prisma.otherCost.create({
    data: {
      unitId:      body.unitId,
      category:    body.category,
      description: body.description,
      amount:      Number(body.amount),
      date:        new Date(body.date),
      notes:       body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(cost, { status: 201 });
}
