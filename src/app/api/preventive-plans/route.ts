import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const plans = await prisma.preventivePlan.findMany({ include: { unit: { select: { plate: true, model: true, brand: true } } }, orderBy: { scheduledDate: "asc" } });
  return NextResponse.json(plans.map(p => ({ ...p, scheduledDate: p.scheduledDate?.toISOString() ?? null, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await req.json();
  if (!body.unitId || !body.maintType) return NextResponse.json({ error: "Unidad y tipo son obligatorios" }, { status: 400 });

  const plan = await prisma.preventivePlan.create({
    data: {
      unitId: body.unitId, maintType: body.maintType,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      scheduledKm: body.scheduledKm ? Number(body.scheduledKm) : null,
      intervalKm: body.intervalKm ? Number(body.intervalKm) : null,
      intervalDays: body.intervalDays ? Number(body.intervalDays) : null,
      status: "PROGRAMADO", notes: body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true, brand: true } } },
  });
  return NextResponse.json({ ...plan, scheduledDate: plan.scheduledDate?.toISOString() ?? null, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString() }, { status: 201 });
}
