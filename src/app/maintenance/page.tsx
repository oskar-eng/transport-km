import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import MaintenanceClient from "@/components/maintenance/MaintenanceClient";

export default async function MaintenancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [records, units] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
  ]);

  return (
    <AppShell>
      <MaintenanceClient
        records={records.map((r) => ({
          ...r,
          date:        r.date.toISOString(),
          nextDate:    r.nextDate?.toISOString() ?? null,
          createdAt:   r.createdAt.toISOString(),
          updatedAt:   r.updatedAt.toISOString(),
        }))}
        units={units}
        userRole={user.role}
      />
    </AppShell>
  );
}
