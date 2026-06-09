import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import TarjetasClient from "@/components/tarjetas/TarjetasClient";

const ADMIN_ROLES = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"];

function consumoRange() {
  const now = new Date();
  return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

export default async function TarjetasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };
  if (user.role === "CONDUCTOR") redirect("/fuel"); // el conductor ve su saldo en Combustible

  const range = consumoRange();
  const [cards, units, drivers, monthRecords] = await Promise.all([
    prisma.fuelCard.findMany({ include: { unit: { select: { plate: true, model: true } } }, orderBy: { holderName: "asc" } }),
    prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR" }, include: { driverProfile: true } }),
    prisma.fuelRecord.findMany({ where: { date: range, driverDni: { not: null } }, select: { driverDni: true, totalCost: true } }),
  ]);

  const consumo: Record<string, number> = {};
  for (const r of monthRecords) {
    if (!r.driverDni) continue;
    consumo[r.driverDni] = (consumo[r.driverDni] ?? 0) + (r.totalCost ?? 0);
  }

  const data = cards.map(c => {
    const consumido = consumo[c.holderDni] ?? 0;
    return {
      id: c.id, cardNumber: c.cardNumber, provider: c.provider,
      holderName: c.holderName, holderDni: c.holderDni, driverId: c.driverId,
      unitId: c.unitId, unit: c.unit, monthlyLimit: c.monthlyLimit, active: c.active,
      consumido, disponible: Math.max(0, c.monthlyLimit - consumido),
    };
  });

  const driverList = drivers.map(d => ({
    id: d.id,
    name: d.driverProfile ? `${d.driverProfile.firstName} ${d.driverProfile.lastName}` : d.name,
    dni: d.driverProfile?.dni ?? "",
  }));

  return (
    <AppShell>
      <TarjetasClient cards={data} units={units} drivers={driverList} userRole={user.role} canAdmin={ADMIN_ROLES.includes(user.role)} />
    </AppShell>
  );
}
