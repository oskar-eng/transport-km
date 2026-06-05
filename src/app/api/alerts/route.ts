import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DRIVER_DOC_TYPES } from "@/lib/driverDocs";
import { UNIT_DOC_TYPES, NO_EXPIRY_TYPES } from "@/lib/vehicleDocsFixed";

export const dynamic = "force-dynamic";

const DRIVER_LABELS = Object.fromEntries(DRIVER_DOC_TYPES.map(t => [t.key, t.label]));
const UNIT_LABELS = Object.fromEntries(UNIT_DOC_TYPES.map(t => [t.key, t.label]));

const DOC_WINDOW = 30;        // documentos: ≤30 días o vencidos
const MAINT_WINDOW = 30;      // mantenimiento: próxima fecha ≤30 días
const FUEL_RECENT_HOURS = 48; // cargas recientes: últimas 48h

function daysUntil(d: Date) { return Math.ceil((d.getTime() - Date.now()) / 86400000); }
function hoursSince(d: Date) { return Math.floor((Date.now() - d.getTime()) / 3600000); }

type Alert = {
  id: string;
  category: "documento" | "combustible" | "mantenimiento";
  icon: "driver" | "unit" | "fuel" | "wrench";
  titulo: string;
  doc: string;
  fecha: string;
  severity: "alta" | "media" | "info";
  link: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const alerts: Alert[] = [];

  /* ── 1. Documentos por vencer / vencidos ── */
  const docLimit = new Date(Date.now() + DOC_WINDOW * 86400000);

  const driverDocs = await prisma.driverDocument.findMany({
    where: { expiryDate: { not: null, lte: docLimit } },
    include: { driver: { select: { firstName: true, lastName: true, userId: true } } },
  });
  for (const d of driverDocs) {
    const days = daysUntil(d.expiryDate!);
    alerts.push({
      id: `dd-${d.id}`, category: "documento", icon: "driver",
      titulo: `${d.driver.firstName} ${d.driver.lastName}`,
      doc: `${DRIVER_LABELS[d.type] ?? d.type} — ${days < 0 ? `vencido hace ${Math.abs(days)}d` : `vence en ${days}d`}`,
      fecha: d.expiryDate!.toISOString(), severity: days < 0 ? "alta" : "media",
      link: `/drivers/${d.driver.userId}`,
    });
  }

  const unitDocs = await prisma.unitDocument.findMany({
    where: { type: { notIn: NO_EXPIRY_TYPES }, expiryDate: { not: null, lte: docLimit } },
    include: { unit: { select: { id: true, plate: true } } },
  });
  for (const d of unitDocs) {
    const days = daysUntil(d.expiryDate!);
    alerts.push({
      id: `ud-${d.id}`, category: "documento", icon: "unit",
      titulo: d.unit.plate,
      doc: `${UNIT_LABELS[d.type] ?? d.type} — ${days < 0 ? `vencido hace ${Math.abs(days)}d` : `vence en ${days}d`}`,
      fecha: d.expiryDate!.toISOString(), severity: days < 0 ? "alta" : "media",
      link: `/units/${d.unit.id}`,
    });
  }

  /* ── 2. Mantenimiento programado ── */
  const maintLimit = new Date(Date.now() + MAINT_WINDOW * 86400000);
  const maints = await prisma.maintenanceRecord.findMany({
    where: {
      OR: [
        { nextDate: { not: null, lte: maintLimit } },
        { status: { in: ["PENDIENTE", "EN_PROCESO"] } },
      ],
    },
    include: { unit: { select: { id: true, plate: true } } },
    orderBy: { nextDate: "asc" },
    take: 50,
  });
  const maintAlerted = new Set<string>();
  for (const m of maints) {
    maintAlerted.add(m.id);
    const days = m.nextDate ? daysUntil(m.nextDate) : null;
    const detalle = m.status === "PENDIENTE" ? "pendiente"
      : m.status === "EN_PROCESO" ? "en proceso"
      : days != null ? (days < 0 ? `programado hace ${Math.abs(days)}d` : `en ${days}d`) : "programado";
    alerts.push({
      id: `m-${m.id}`, category: "mantenimiento", icon: "wrench",
      titulo: m.unit.plate,
      doc: `${m.description} — ${detalle}`,
      fecha: (m.nextDate ?? m.date).toISOString(),
      severity: (days != null && days < 0) || m.status === "PENDIENTE" ? "media" : "info",
      link: `/maintenance`,
    });
  }

  /* ── 2b. Mantenimiento por kilometraje ── */
  const KM_WINDOW = 2000; // avisar 2000 km antes
  const odoByUnit = await prisma.fuelRecord.groupBy({ by: ["unitId"], _max: { odometer: true } });
  const odoMap = Object.fromEntries(odoByUnit.map(o => [o.unitId, o._max.odometer ?? 0]));
  const maintKm = await prisma.maintenanceRecord.findMany({
    where: { nextOdometer: { not: null }, status: { not: "COMPLETADO" } },
    include: { unit: { select: { id: true, plate: true } } },
    take: 50,
  });
  for (const m of maintKm) {
    if (maintAlerted.has(m.id)) continue;
    const current = odoMap[m.unitId] ?? 0;
    if (current === 0) continue;
    const faltan = m.nextOdometer! - current;
    if (faltan <= KM_WINDOW) {
      alerts.push({
        id: `mk-${m.id}`, category: "mantenimiento", icon: "wrench",
        titulo: m.unit.plate,
        doc: `${m.description} — ${faltan < 0 ? `pasado por ${Math.abs(faltan).toLocaleString()} km` : `faltan ${faltan.toLocaleString()} km para el service`}`,
        fecha: (m.nextDate ?? m.date).toISOString(),
        severity: faltan < 0 ? "media" : "info",
        link: `/maintenance`,
      });
    }
  }

  /* ── 3. Combustible: cargas recientes + bajo rendimiento ── */
  const fuelUnits = await prisma.unit.findMany({
    include: { fuelRecords: { orderBy: { odometer: "asc" } } },
  });
  const fuelRecentLimit = new Date(Date.now() - FUEL_RECENT_HOURS * 3600000);
  const lowLimit = new Date(Date.now() - 30 * 86400000);

  for (const u of fuelUnits) {
    const recs = u.fuelRecords;
    // rendimiento km/L entre cargas consecutivas
    const kmL: (number | null)[] = recs.map((r, i) => {
      if (i === 0) return null;
      const dKm = r.odometer - recs[i - 1].odometer;
      return r.liters > 0 && dKm > 0 ? dKm / r.liters : null;
    });
    const valid = kmL.filter((x): x is number => x != null);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;

    recs.forEach((r, i) => {
      // carga reciente
      if (r.date >= fuelRecentLimit) {
        alerts.push({
          id: `fl-${r.id}`, category: "combustible", icon: "fuel",
          titulo: u.plate, doc: `Abastecimiento: ${r.liters} Gal${r.totalCost ? ` · S/ ${r.totalCost}` : ""}`,
          fecha: r.date.toISOString(), severity: "info", link: `/fuel`,
        });
      }
      // bajo rendimiento (reciente, <80% del promedio)
      const eff = kmL[i];
      if (eff != null && avg != null && eff < avg * 0.8 && r.date >= lowLimit) {
        alerts.push({
          id: `fe-${r.id}`, category: "combustible", icon: "fuel",
          titulo: u.plate, doc: `Bajo rendimiento: ${eff.toFixed(1)} km/Gal (prom. ${avg.toFixed(1)})`,
          fecha: r.date.toISOString(), severity: "media", link: `/fuel`,
        });
      }
    });
  }

  // ordenar: severidad alta → media → info, y por fecha
  const sevRank = { alta: 0, media: 1, info: 2 };
  alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return NextResponse.json({
    total: alerts.length,
    porCategoria: {
      documento:     alerts.filter(a => a.category === "documento").length,
      combustible:   alerts.filter(a => a.category === "combustible").length,
      mantenimiento: alerts.filter(a => a.category === "mantenimiento").length,
    },
    alerts,
  });
}
