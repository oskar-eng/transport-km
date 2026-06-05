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

  const units = await prisma.unit.findMany({
    orderBy: { plate: "asc" },
    include: { unitDocuments: true },
  });
  const serialized = units.map(u => ({
    ...u,
    acquisitionDate: u.acquisitionDate?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    documents: u.unitDocuments.map(d => ({
      type:       d.type,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      fileUrl:    d.fileUrl,
    })),
  }));

  return (
    <AppShell>
      <UnitsClient units={serialized} userRole={user.role} />
    </AppShell>
  );
}
