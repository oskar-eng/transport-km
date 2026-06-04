import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CostsClient from "@/components/costs/CostsClient";
import AppShell from "@/components/layout/AppShell";
import { DollarSign } from "lucide-react";

export default async function CostsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [units, fuelRecords, maintenanceRecords, otherCosts] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } }),
    prisma.fuelRecord.findMany({ select: { unitId: true, totalCost: true } }),
    prisma.maintenanceRecord.findMany({ select: { unitId: true, cost: true } }),
    prisma.otherCost.findMany({
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  // Aggregate fuel totals per unit
  const fuelByUnit: Record<string, number> = {};
  for (const r of fuelRecords) {
    fuelByUnit[r.unitId] = (fuelByUnit[r.unitId] ?? 0) + (r.totalCost ?? 0);
  }

  // Aggregate maintenance totals per unit
  const maintenanceByUnit: Record<string, number> = {};
  for (const r of maintenanceRecords) {
    maintenanceByUnit[r.unitId] = (maintenanceByUnit[r.unitId] ?? 0) + (r.cost ?? 0);
  }

  // Serialize dates
  const serializedCosts = otherCosts.map(c => ({
    ...c,
    date: c.date.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-2 rounded-lg">
          <DollarSign className="text-green-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Costos por Unidad</h1>
          <p className="text-sm text-gray-500">Consolidado de combustible, mantenimiento y otros gastos</p>
        </div>
      </div>
      <CostsClient
        units={units}
        fuelByUnit={fuelByUnit}
        maintenanceByUnit={maintenanceByUnit}
        initialCosts={serializedCosts}
      />
    </div>
    </AppShell>
  );
}
