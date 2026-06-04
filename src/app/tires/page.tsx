import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import TiresClient from "@/components/tires/TiresClient";

export default async function TiresPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [tires, units] = await Promise.all([
    prisma.tire.findMany({
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: [{ unitId: "asc" }, { position: "asc" }],
    }),
    prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
  ]);

  return (
    <AppShell>
      <TiresClient
        tires={tires.map((t) => ({ ...t, installDate: t.installDate.toISOString(), createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))}
        units={units}
        userRole={user.role}
      />
    </AppShell>
  );
}
