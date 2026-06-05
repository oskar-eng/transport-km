import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import SancionesClient from "@/components/sanciones/SancionesClient";

export default async function SancionesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [sanciones, units, drivers] = await Promise.all([
    prisma.sancion.findMany({
      include: { unit: { select: { plate: true, model: true } }, driver: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.unit.findMany({ select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const serialized = sanciones.map(s => ({
    ...s, date: s.date.toISOString(), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
      <SancionesClient sanciones={serialized} units={units} drivers={drivers} userRole={user.role} />
    </AppShell>
  );
}
