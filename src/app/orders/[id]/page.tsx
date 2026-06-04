import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import OrderDetail from "@/components/orders/OrderDetail";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true } },
      unit: { select: { id: true, plate: true, model: true, year: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!order) redirect("/orders");

  const user = session.user as { id: string; role: string };
  if (user.role === "CONDUCTOR" && order.driverId !== user.id) redirect("/orders");

  return (
    <AppShell>
      <OrderDetail order={order} userRole={user.role} userId={user.id} />
    </AppShell>
  );
}
