import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import OrdenesTrabajoClient from "@/components/ordenes-trabajo/OrdenesTrabajoClient";

export default async function OrdenesTrabajoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [wos, units, parts] = await Promise.all([
    prisma.workOrder.findMany({ include: { unit: { select: { plate: true, model: true, brand: true } }, materials: true }, orderBy: { createdAt: "desc" } }),
    prisma.unit.findMany({ select: { id: true, plate: true, model: true, brand: true }, orderBy: { plate: "asc" } }),
    prisma.sparePart.findMany({ select: { id: true, code: true, name: true, unit: true, stock: true, cost: true }, orderBy: { name: "asc" } }),
  ]);

  const data = wos.map(w => ({
    id: w.id, numero: w.numero, unitId: w.unitId, type: w.type, maintType: w.maintType, status: w.status,
    description: w.description, diagnosis: w.diagnosis, mechanic: w.mechanic, laborCost: w.laborCost, odometer: w.odometer,
    evidenceUrl: w.evidenceUrl, testsDone: w.testsDone, openedAt: w.openedAt.toISOString(), closedAt: w.closedAt?.toISOString() ?? null,
    unit: w.unit, materials: w.materials.map(m => ({ partId: m.partId, partName: m.partName, quantity: m.quantity, unitCost: m.unitCost })),
  }));

  return (
    <AppShell>
      <OrdenesTrabajoClient workOrders={data} units={units} parts={parts} userRole={user.role} />
    </AppShell>
  );
}
