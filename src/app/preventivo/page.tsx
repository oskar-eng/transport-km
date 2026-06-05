import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import PreventivoClient from "@/components/preventivo/PreventivoClient";

export default async function PreventivoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [plans, units] = await Promise.all([
    prisma.preventivePlan.findMany({ include: { unit: { select: { plate: true, model: true, brand: true } } }, orderBy: { scheduledDate: "asc" } }),
    prisma.unit.findMany({ select: { id: true, plate: true, model: true, brand: true }, orderBy: { plate: "asc" } }),
  ]);

  const data = plans.map(p => ({
    id: p.id, unitId: p.unitId, maintType: p.maintType,
    scheduledDate: p.scheduledDate?.toISOString() ?? null, scheduledKm: p.scheduledKm,
    intervalKm: p.intervalKm, intervalDays: p.intervalDays, status: p.status, notes: p.notes,
    unit: p.unit,
  }));

  return (
    <AppShell>
      <PreventivoClient plans={data} units={units} userRole={user.role} />
    </AppShell>
  );
}
