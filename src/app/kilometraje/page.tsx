import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import KilometrajeClient from "@/components/kilometraje/KilometrajeClient";

export default async function KilometrajePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };
  const isDriver = user.role === "CONDUCTOR";
  const where = isDriver ? { driverId: user.id } : {};

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      driver: { select: { name: true } },
      unit: { select: { plate: true, model: true } },
      events: { where: { odometer: { not: null } }, orderBy: { timestamp: "asc" }, select: { odometer: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = orders.map(o => {
    const odos = o.events.map(e => e.odometer!).filter(n => n != null);
    const km = odos.length >= 2 ? Math.max(0, odos[odos.length - 1] - odos[0]) : 0;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      type: o.type,
      status: o.status,
      clientName: o.clientName,
      date: o.createdAt.toISOString(),
      driverName: o.driver?.name ?? "—",
      plate: o.unit?.plate ?? "—",
      model: o.unit?.model ?? "",
      km,
      hasData: odos.length >= 2,
    };
  });

  return (
    <AppShell>
      <KilometrajeClient orders={data} isDriver={isDriver} />
    </AppShell>
  );
}
