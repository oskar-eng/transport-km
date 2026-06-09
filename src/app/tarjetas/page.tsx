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
  const now = new Date();
  const hace6Meses = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [cards, units, drivers, histRecords] = await Promise.all([
    prisma.fuelCard.findMany({ include: { unit: { select: { plate: true, model: true } } }, orderBy: { holderName: "asc" } }),
    prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR" }, include: { driverProfile: true } }),
    prisma.fuelRecord.findMany({ where: { date: { gte: hace6Meses } }, select: { driverDni: true, unitId: true, totalCost: true, date: true } }),
  ]);

  // ¿Una carga corresponde a esta tarjeta? (por DNI del conductor o por la unidad asignada)
  const matchCard = (c: { holderDni: string; unitId: string | null }, r: { driverDni: string | null; unitId: string }) =>
    r.driverDni === c.holderDni || (c.unitId != null && r.unitId === c.unitId);

  // Últimos 6 meses (clave y etiqueta)
  const meses: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }) });
  }

  const data = cards.map(c => {
    const cardRecs = histRecords.filter(r => matchCard(c, r));
    const consumido = cardRecs
      .filter(r => r.date >= range.gte && r.date < range.lt)
      .reduce((s, r) => s + (r.totalCost ?? 0), 0);
    const history = meses.map(m => ({
      label: m.label,
      consumido: cardRecs.filter(r => `${r.date.getFullYear()}-${r.date.getMonth()}` === m.key).reduce((s, r) => s + (r.totalCost ?? 0), 0),
      limite: c.monthlyLimit,
    }));
    return {
      id: c.id, cardNumber: c.cardNumber, provider: c.provider,
      holderName: c.holderName, holderDni: c.holderDni, driverId: c.driverId,
      unitId: c.unitId, unit: c.unit, monthlyLimit: c.monthlyLimit, active: c.active,
      consumido, disponible: Math.max(0, c.monthlyLimit - consumido), history,
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
