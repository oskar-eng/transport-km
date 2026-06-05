import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import BitacoraClient from "@/components/bitacora/BitacoraClient";

export default async function BitacoraPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [orders, maints, expenses, fuel, sanciones] = await Promise.all([
    prisma.serviceOrder.findMany({
      include: { unit: { select: { plate: true } }, driver: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 60,
    }),
    prisma.maintenanceRecord.findMany({
      include: { unit: { select: { plate: true } } }, orderBy: { date: "desc" }, take: 60,
    }),
    prisma.expense.findMany({
      include: { unit: { select: { plate: true } } }, orderBy: { date: "desc" }, take: 60,
    }),
    prisma.fuelRecord.findMany({
      include: { unit: { select: { plate: true } } }, orderBy: { date: "desc" }, take: 60,
    }),
    prisma.sancion.findMany({
      include: { unit: { select: { plate: true } }, driver: { select: { name: true } } },
      orderBy: { date: "desc" }, take: 60,
    }),
  ]);

  type Item = { tipo: string; fecha: string; titulo: string; detalle: string; monto: number | null; link: string };
  const items: Item[] = [
    ...orders.map(o => ({ tipo: "orden", fecha: o.createdAt.toISOString(), titulo: `Orden ${o.orderNumber} · ${o.type === "IMPORTACION" ? "Importación" : "Exportación"}`, detalle: `${o.clientName} — ${o.unit.plate} · ${o.driver.name} (${o.status})`, monto: null, link: `/orders/${o.id}` })),
    ...maints.map(m => ({ tipo: "mantenimiento", fecha: m.date.toISOString(), titulo: `Mantenimiento ${m.type} · ${m.unit.plate}`, detalle: `${m.description}${m.workshop ? ` · ${m.workshop}` : ""}`, monto: m.cost ?? null, link: `/maintenance` })),
    ...expenses.map(e => ({ tipo: "gasto", fecha: e.date.toISOString(), titulo: `Gasto ${e.category} · ${e.unit.plate}`, detalle: `${e.description}${e.createdByName ? ` — ${e.createdByName}` : ""}`, monto: e.amount, link: `/gastos` })),
    ...fuel.map(f => ({ tipo: "combustible", fecha: f.date.toISOString(), titulo: `Combustible · ${f.unit.plate}`, detalle: `${f.liters} Gal · ${f.station ?? "Grifo"} · ${f.odometer.toLocaleString()} km`, monto: f.totalCost ?? null, link: `/fuel` })),
    ...sanciones.map(s => ({ tipo: "sancion", fecha: s.date.toISOString(), titulo: `Sanción ${s.type}`, detalle: `${s.unit ? s.unit.plate + " · " : ""}${s.driver ? s.driver.name + " · " : ""}${s.description} (${s.status})`, monto: s.amount ?? null, link: `/sanciones` })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <AppShell>
      <BitacoraClient items={items} />
    </AppShell>
  );
}
