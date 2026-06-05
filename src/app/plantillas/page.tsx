import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import PlantillasClient from "@/components/plantillas/PlantillasClient";

export default async function PlantillasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [templates, parts] = await Promise.all([
    prisma.maintenanceTemplate.findMany({ include: { items: true }, orderBy: [{ brand: "asc" }, { type: "asc" }] }),
    prisma.sparePart.findMany({ select: { id: true, code: true, name: true, unit: true }, orderBy: { name: "asc" } }),
  ]);

  const data = templates.map(t => ({
    id: t.id, brand: t.brand, type: t.type, name: t.name, notes: t.notes,
    items: t.items.map(i => ({ id: i.id, partId: i.partId, partName: i.partName, quantity: i.quantity })),
  }));

  return (
    <AppShell>
      <PlantillasClient templates={data} parts={parts} userRole={user.role} />
    </AppShell>
  );
}
