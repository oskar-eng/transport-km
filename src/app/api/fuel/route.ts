import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");

  const records = await prisma.fuelRecord.findMany({
    where: { ...(unitId ? { unitId } : {}) },
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: [{ unitId: "asc" }, { date: "asc" }],
  });

  // Calcular rendimiento km/L entre cargas consecutivas por unidad.
  // Solo cuentan las cargas de TRACTO (el generador no tiene odómetro real).
  const esGenerador = (r: { loadType: string; odometer: number }) => r.loadType === "GENERADOR" || r.odometer <= 100;
  const byUnit: Record<string, typeof records> = {};
  for (const r of records) {
    if (esGenerador(r)) continue;
    if (!byUnit[r.unitId]) byUnit[r.unitId] = [];
    byUnit[r.unitId].push(r);
  }

  const withEfficiency = records.map((r) => {
    let kmPerLiter: number | null = null;
    if (!esGenerador(r)) {
      const unitRecords = byUnit[r.unitId];
      const idx = unitRecords.findIndex((x) => x.id === r.id);
      if (idx > 0) {
        const prev = unitRecords[idx - 1];
        const kmDiff = r.odometer - prev.odometer;
        if (kmDiff > 0 && r.liters > 0) {
          kmPerLiter = Math.round((kmDiff / r.liters) * 10) / 10;
        }
      }
    }
    return { ...r, kmPerLiter };
  });

  return NextResponse.json(withEfficiency);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "CONDUCTOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.unitId || !body.date || !body.liters || !body.odometer) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const record = await prisma.fuelRecord.create({
    data: {
      unitId:        body.unitId,
      date:          new Date(body.date),
      liters:        Number(body.liters),
      pricePerLiter: body.pricePerLiter ? Number(body.pricePerLiter) : null,
      totalCost:     body.totalCost ? Number(body.totalCost) : null,
      odometer:      Number(body.odometer),
      station:       body.station || null,
      fuelType:      body.fuelType || "DIESEL",
      loadType:      body.loadType === "GENERADOR" ? "GENERADOR" : "TRACTO",
      notes:         body.notes || null,
      receiptDispatchUrl: body.receiptDispatchUrl || null,
      receiptPaymentUrl:  body.receiptPaymentUrl || null,
      driverDni:     body.driverDni || null,
      driverName:    body.driverName || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });

  return NextResponse.json(record, { status: 201 });
}
