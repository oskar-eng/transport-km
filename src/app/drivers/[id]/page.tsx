import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import DriverDetailClient from "@/components/drivers/DriverDetailClient";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const { id } = await params;

  const conductor = await prisma.user.findUnique({
    where: { id },
    include: {
      driverProfile: { include: { documents: true } },
      orders: {
        where: { status: "ACTIVO" },
        include: { unit: { select: { id: true, plate: true, model: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!conductor || conductor.role !== "CONDUCTOR") notFound();

  // Órdenes del conductor con km recorridos (último odómetro - primero)
  const tripOrders = await prisma.serviceOrder.findMany({
    where: { driverId: id },
    include: {
      unit: { select: { plate: true, model: true } },
      events: { where: { odometer: { not: null } }, orderBy: { timestamp: "asc" }, select: { odometer: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const trips = tripOrders.map(o => {
    const odos = o.events.map(e => e.odometer!).filter(n => n != null);
    const km = odos.length >= 2 ? Math.max(0, odos[odos.length - 1] - odos[0]) : 0;
    return {
      id: o.id, orderNumber: o.orderNumber, type: o.type, status: o.status,
      clientName: o.clientName, date: o.createdAt.toISOString(),
      plate: o.unit?.plate ?? "—", model: o.unit?.model ?? "", km, hasData: odos.length >= 2,
    };
  });
  const kmTotal = trips.reduce((s, t) => s + t.km, 0);
  const kmMes = tripOrders.reduce((s, o) => {
    if (o.createdAt < firstOfMonth) return s;
    const odos = o.events.map(e => e.odometer!).filter(n => n != null);
    return s + (odos.length >= 2 ? Math.max(0, odos[odos.length - 1] - odos[0]) : 0);
  }, 0);

  const profile = conductor.driverProfile;

  const driver = {
    id:    conductor.id,
    name:  conductor.name,
    email: conductor.email,
    profile: profile ? {
      id:              profile.id,
      dni:             profile.dni,
      firstName:       profile.firstName,
      lastName:        profile.lastName,
      licenseNumber:   profile.licenseNumber,
      licenseCategory: profile.licenseCategory,
      licenseExpiry:   profile.licenseExpiry.toISOString(),
      phone:           profile.phone,
      joinDate:        profile.joinDate?.toISOString() ?? null,
      status:          profile.status,
      driverType:      profile.driverType,
      photoUrl:        profile.photoUrl,
    } : null,
    documents: (profile?.documents ?? []).map(d => ({
      id:         d.id,
      type:       d.type,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      fileUrl:    d.fileUrl,
    })),
    activeUnit: conductor.orders[0]?.unit ?? null,
  };

  return (
    <AppShell>
      <DriverDetailClient driver={driver} userRole={user.role} trips={trips} kmTotal={kmTotal} kmMes={kmMes} />
    </AppShell>
  );
}
