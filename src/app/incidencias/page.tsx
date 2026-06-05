import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import IncidenciasClient from "@/components/incidencias/IncidenciasClient";

export default async function IncidenciasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };
  const isDriver = user.role === "CONDUCTOR";

  const incidents = await prisma.incident.findMany({
    where: isDriver ? { driverId: user.id } : {},
    include: { unit: { select: { plate: true, model: true } } }, orderBy: { createdAt: "desc" },
  });

  let defaultUnitId: string | null = null;
  if (isDriver) {
    const active = await prisma.serviceOrder.findFirst({ where: { driverId: user.id, status: "ACTIVO" }, select: { unitId: true } });
    defaultUnitId = active?.unitId ?? null;
  }
  const units = await prisma.unit.findMany({
    where: isDriver && defaultUnitId ? { id: defaultUnitId } : {},
    select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" },
  });

  const data = incidents.map(i => ({
    id: i.id, numero: i.numero, unitId: i.unitId, driverName: i.driverName, date: i.date.toISOString(),
    description: i.description, severity: i.severity, status: i.status, photoUrl: i.photoUrl,
    unit: i.unit,
  }));

  return (
    <AppShell>
      <IncidenciasClient incidents={data} units={units} userRole={user.role} defaultUnitId={defaultUnitId} />
    </AppShell>
  );
}
