import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import AlmacenClient from "@/components/almacen/AlmacenClient";

export default async function AlmacenPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [parts, movements] = await Promise.all([
    prisma.sparePart.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      include: { part: { select: { code: true, name: true, unit: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);

  const serializedParts = parts.map(p => ({
    id: p.id, code: p.code, name: p.name, category: p.category, brand: p.brand,
    unit: p.unit, stock: p.stock, minStock: p.minStock, cost: p.cost, location: p.location,
  }));
  const serializedMovs = movements.map(m => ({
    id: m.id, partId: m.partId, type: m.type, quantity: m.quantity, reason: m.reason,
    reference: m.reference, cost: m.cost, balance: m.balance, createdByName: m.createdByName,
    createdAt: m.createdAt.toISOString(), part: m.part,
  }));

  return (
    <AppShell>
      <AlmacenClient parts={serializedParts} movements={serializedMovs} userRole={user.role} />
    </AppShell>
  );
}
