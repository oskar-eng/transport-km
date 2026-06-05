import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DRIVER_DOC_TYPES } from "@/lib/driverDocs";
import { UNIT_DOC_TYPES, NO_EXPIRY_TYPES } from "@/lib/vehicleDocsFixed";

export const dynamic = "force-dynamic";

const DRIVER_LABELS = Object.fromEntries(DRIVER_DOC_TYPES.map(t => [t.key, t.label]));
const UNIT_LABELS = Object.fromEntries(UNIT_DOC_TYPES.map(t => [t.key, t.label]));

const WINDOW_DAYS = 30; // mostrar lo que vence en ≤30 días o ya venció

function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const limit = new Date(Date.now() + WINDOW_DAYS * 86400000);

  const driverDocs = await prisma.driverDocument.findMany({
    where: { expiryDate: { not: null, lte: limit } },
    include: { driver: { select: { firstName: true, lastName: true, userId: true } } },
  });

  const unitDocs = await prisma.unitDocument.findMany({
    where: { type: { notIn: NO_EXPIRY_TYPES }, expiryDate: { not: null, lte: limit } },
    include: { unit: { select: { id: true, plate: true } } },
  });

  type Alert = {
    id: string; kind: "driver" | "unit"; titulo: string; doc: string;
    expiryDate: string; days: number; severity: "vencido" | "por_vencer"; link: string;
  };

  const alerts: Alert[] = [];

  for (const d of driverDocs) {
    const days = daysUntil(d.expiryDate!);
    alerts.push({
      id: d.id, kind: "driver",
      titulo: `${d.driver.firstName} ${d.driver.lastName}`,
      doc: DRIVER_LABELS[d.type] ?? d.type,
      expiryDate: d.expiryDate!.toISOString(),
      days, severity: days < 0 ? "vencido" : "por_vencer",
      link: `/drivers/${d.driver.userId}`,
    });
  }
  for (const d of unitDocs) {
    const days = daysUntil(d.expiryDate!);
    alerts.push({
      id: d.id, kind: "unit",
      titulo: d.unit.plate,
      doc: UNIT_LABELS[d.type] ?? d.type,
      expiryDate: d.expiryDate!.toISOString(),
      days, severity: days < 0 ? "vencido" : "por_vencer",
      link: `/units/${d.unit.id}`,
    });
  }

  alerts.sort((a, b) => a.days - b.days);

  return NextResponse.json({
    total: alerts.length,
    vencidos: alerts.filter(a => a.severity === "vencido").length,
    porVencer: alerts.filter(a => a.severity === "por_vencer").length,
    alerts,
  });
}
