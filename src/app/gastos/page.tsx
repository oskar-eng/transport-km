import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import GastosClient from "@/components/gastos/GastosClient";

export default async function GastosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };
  const isDriver = user.role === "CONDUCTOR";

  // Gastos: conductor solo los suyos
  const expenses = await prisma.expense.findMany({
    where: isDriver ? { createdById: user.id } : {},
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: { date: "desc" },
  });

  // Unidad asignada del conductor (orden activa)
  let defaultUnitId: string | null = null;
  if (isDriver) {
    const activeOrder = await prisma.serviceOrder.findFirst({
      where: { driverId: user.id, status: "ACTIVO" },
      select: { unitId: true },
    });
    defaultUnitId = activeOrder?.unitId ?? null;
  }

  const units = await prisma.unit.findMany({
    where: isDriver && defaultUnitId ? { id: defaultUnitId } : {},
    select: { id: true, plate: true, model: true },
    orderBy: { plate: "asc" },
  });

  // Consolidado por unidad (solo para no-conductores)
  let summary: {
    unitId: string; plate: string; model: string;
    combustible: number; mantenimiento: number;
    gastos: Record<string, number>; total: number;
  }[] = [];

  if (!isDriver) {
    const allUnits = await prisma.unit.findMany({
      include: {
        fuelRecords: { select: { totalCost: true } },
        maintenance: { select: { cost: true } },
        expenses: { select: { category: true, amount: true } },
      },
      orderBy: { plate: "asc" },
    });
    summary = allUnits.map(u => {
      const combustible = u.fuelRecords.reduce((s, f) => s + (f.totalCost ?? 0), 0);
      const mantenimiento = u.maintenance.reduce((s, m) => s + (m.cost ?? 0), 0);
      const gastos: Record<string, number> = {};
      for (const e of u.expenses) gastos[e.category] = (gastos[e.category] ?? 0) + e.amount;
      const gastosTotal = Object.values(gastos).reduce((a, b) => a + b, 0);
      return {
        unitId: u.id, plate: u.plate, model: u.model,
        combustible, mantenimiento, gastos,
        total: combustible + mantenimiento + gastosTotal,
      };
    }).filter(u => u.total > 0);
  }

  const serialized = expenses.map(e => ({
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
      <GastosClient
        expenses={serialized}
        units={units}
        summary={summary}
        userRole={user.role}
        defaultUnitId={defaultUnitId}
      />
    </AppShell>
  );
}
