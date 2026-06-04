import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import DriversClient from "@/components/drivers/DriversClient";

export default async function DriversPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const conductors = await prisma.user.findMany({
    where: { role: "CONDUCTOR" },
    include: {
      driverProfile: true,
      orders: {
        where: { status: "ACTIVO" },
        include: { unit: { select: { id: true, plate: true, model: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const drivers = conductors.map(c => ({
    id:     c.id,
    name:   c.name,
    email:  c.email,
    active: c.active,
    profile: c.driverProfile ? {
      ...c.driverProfile,
      licenseExpiry: c.driverProfile.licenseExpiry.toISOString(),
      joinDate:      c.driverProfile.joinDate?.toISOString() ?? null,
      createdAt:     c.driverProfile.createdAt.toISOString(),
      updatedAt:     c.driverProfile.updatedAt.toISOString(),
    } : null,
    activeUnit: c.orders[0]?.unit ?? null,
  }));

  return (
    <AppShell>
      <DriversClient drivers={drivers} userRole={user.role} />
    </AppShell>
  );
}
