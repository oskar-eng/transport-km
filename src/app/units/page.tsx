import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import UnitsClient from "@/components/units/UnitsClient";

export default async function UnitsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const units = await prisma.unit.findMany({ orderBy: { plate: "asc" } });
  const serialized = units.map(u => ({
    ...u,
    acquisitionDate: u.acquisitionDate?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
      <UnitsClient units={serialized} userRole={user.role} />
    </AppShell>
  );
}
