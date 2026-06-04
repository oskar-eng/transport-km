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

  // Calcular rendimiento km/L entre cargas consecutivas por unidad
  const byUnit: Record<string, typeof rawRecords> = {};
  for (const r of rawRecords) {
    if (!byUnit[r.unitId]) byUnit[r.unitId] = [];
    byUnit[r.unitId].push(r);
  }

  const records = rawRecords.map(r => {
    const unitRecs = byUnit[r.unitId];
    const idx = unitRecs.findIndex(x => x.id === r.id);
    let kmPerLiter: number | null = null;
    if (idx > 0) {
      const prev = unitRecs[idx - 1];
      const kmDiff = r.odometer - prev.odometer;
      if (kmDiff > 0 && r.liters > 0) kmPerLiter = Math.round((kmDiff / r.liters) * 10) / 10;
    }
    return {
      ...r,
      date:      r.date.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      kmPerLiter,
    };
  });

  return (
    <AppShell>
      <FuelClient records={records} units={units} userRole={user.role} defaultUnitId={defaultUnitId} />
    </AppShell>
  );
}
