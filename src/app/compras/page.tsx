import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import ComprasClient from "@/components/compras/ComprasClient";

export default async function ComprasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const purchases = await prisma.purchaseOrder.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  const data = purchases.map(p => ({
    id: p.id, numero: p.numero, supplier: p.supplier, status: p.status, date: p.date.toISOString(),
    description: p.description, total: p.total, receiptUrl: p.receiptUrl, createdByName: p.createdByName,
    items: p.items.map(i => ({ partName: i.partName, quantity: i.quantity, unitCost: i.unitCost })),
  }));

  return (
    <AppShell>
      <ComprasClient purchases={data} userRole={user.role} />
    </AppShell>
  );
}
