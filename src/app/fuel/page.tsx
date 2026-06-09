import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import FuelClient from "@/components/fuel/FuelClient";

export default async function FuelPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };
  const isDriver = user.role === "CONDUCTOR";

  // Conductores ven solo registros de su(s) unidad(es)
  let defaultUnitId: string | undefined;
  let unitFilter: { id: string } | undefined;

  if (isDriver) {
    // Buscar la orden activa del conductor para obtener su unidad
    const activeOrder = await prisma.serviceOrder.findFirst({
      where: { driverId: user.id, status: "ACTIVO" },
      select: { unitId: true },
    });
    if (activeOrder) {
      defaultUnitId = activeOrder.unitId;
      unitFilter = { id: activeOrder.unitId };
    }
  }

  const [rawRecords, units] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: unitFilter ? { unitId: unitFilter.id } : {},
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: [{ unitId: "asc" }, { date: "asc" }],
    }),
    isDriver
      ? prisma.unit.findMany({
          where: unitFilter ? { id: unitFilter.id } : {},
          orderBy: { plate: "asc" },
          select: { id: true, plate: true, model: true },
        })
      : prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
  ]);

  // Calcular rendimiento km/L entre cargas consecutivas por unidad.
  // Solo cuentan las cargas de TRACTO (el generador no tiene odómetro real).
  const esGenerador = (r: { loadType: string; odometer: number }) => r.loadType === "GENERADOR" || r.odometer <= 100;
  const byUnit: Record<string, typeof rawRecords> = {};
  for (const r of rawRecords) {
    if (esGenerador(r)) continue;
    if (!byUnit[r.unitId]) byUnit[r.unitId] = [];
    byUnit[r.unitId].push(r);
  }

  const records = rawRecords.map(r => {
    let kmPerLiter: number | null = null;
    if (!esGenerador(r)) {
      const unitRecs = byUnit[r.unitId];
      const idx = unitRecs.findIndex(x => x.id === r.id);
      if (idx > 0) {
        const prev = unitRecs[idx - 1];
        const kmDiff = r.odometer - prev.odometer;
        if (kmDiff > 0 && r.liters > 0) kmPerLiter = Math.round((kmDiff / r.liters) * 10) / 10;
      }
    }
    return {
      ...r,
      date:      r.date.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      kmPerLiter,
    };
  });

  // Saldo de tarjeta del conductor (se muestra en su vista de Combustible)
  let driverCard: { holderName: string; monthlyLimit: number; consumido: number; disponible: number; cardNumber: string | null } | null = null;
  if (isDriver) {
    const card = await prisma.fuelCard.findFirst({ where: { driverId: user.id, active: true } });
    if (card) {
      const now = new Date();
      const monthRecs = await prisma.fuelRecord.findMany({
        where: { driverDni: card.holderDni, date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } },
        select: { totalCost: true },
      });
      const consumido = monthRecs.reduce((s, r) => s + (r.totalCost ?? 0), 0);
      driverCard = { holderName: card.holderName, monthlyLimit: card.monthlyLimit, consumido, disponible: Math.max(0, card.monthlyLimit - consumido), cardNumber: card.cardNumber };
    }
  }

  return (
    <AppShell>
      <FuelClient records={records} units={units} userRole={user.role} defaultUnitId={defaultUnitId} driverCard={driverCard} />
    </AppShell>
  );
}
