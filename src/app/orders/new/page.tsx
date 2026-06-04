import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import NewOrderForm from "@/components/orders/NewOrderForm";
import { canManageOrders } from "@/lib/events";

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (!canManageOrders(user.role)) redirect("/orders");

  // Traer órdenes activas para detectar unidades/conductores en servicio
  const activeOrders = await prisma.serviceOrder.findMany({
    where: { status: "ACTIVO" },
    select: { id: true, orderNumber: true, unitId: true, driverId: true },
  });

  const activeByUnit = Object.fromEntries(activeOrders.map((o) => [o.unitId, { id: o.id, orderNumber: o.orderNumber }]));
  const activeByDriver = Object.fromEntries(activeOrders.map((o) => [o.driverId, { id: o.id, orderNumber: o.orderNumber }]));

  const [rawUnits, rawDrivers] = await Promise.all([
    prisma.unit.findMany({ orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR", active: true }, orderBy: { name: "asc" } }),
  ]);

  const units = rawUnits.map((u) => ({ ...u, activeOrder: activeByUnit[u.id] ?? null }));
  const drivers = rawDrivers.map((d) => ({ ...d, activeOrder: activeByDriver[d.id] ?? null }));

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Servicio</h1>
      </div>
      <NewOrderForm units={units} drivers={drivers} />
    </AppShell>
  );
}
