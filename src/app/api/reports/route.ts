import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const unitId   = searchParams.get("unitId");
  const driverId = searchParams.get("driverId");

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to + "T23:59:59") } : {}),
  };

  const orderWhere: Record<string, unknown> = {};
  if (from || to) orderWhere.createdAt = dateFilter;
  if (unitId)     orderWhere.unitId    = unitId;
  if (driverId)   orderWhere.driverId  = driverId;

  const fuelWhere: Record<string, unknown> = {};
  if (from || to) fuelWhere.date = dateFilter;
  if (unitId)     fuelWhere.unitId = unitId;

  const maintWhere: Record<string, unknown> = {};
  if (from || to) maintWhere.date = dateFilter;
  if (unitId)     maintWhere.unitId = unitId;

  const costWhere: Record<string, unknown> = {};
  if (from || to) costWhere.date = dateFilter;
  if (unitId)     costWhere.unitId = unitId;

  const [orders, fuelRecords, maintenance, otherCosts, units, drivers] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: orderWhere,
      include: {
        unit:   { select: { plate: true, model: true } },
        driver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fuelRecord.findMany({
      where: fuelWhere,
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.maintenanceRecord.findMany({
      where: maintWhere,
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.otherCost.findMany({
      where: costWhere,
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.unit.findMany({ select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    orders:      orders.map(o => ({ ...o, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString() })),
    fuelRecords: fuelRecords.map(r => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    maintenance: maintenance.map(r => ({ ...r, date: r.date.toISOString(), nextDate: r.nextDate?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    otherCosts:  otherCosts.map(c => ({ ...c, date: c.date.toISOString(), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
    units,
    drivers,
  });
}
