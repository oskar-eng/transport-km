import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import UnitDetailClient from "@/components/units/UnitDetailClient";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const { id } = await params;

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { unitDocuments: true },
  });

  if (!unit) notFound();

  const data = {
    id:           unit.id,
    plate:        unit.plate,
    brand:        unit.brand,
    model:        unit.model,
    year:         unit.year,
    vin:          unit.vin,
    vehicleType:  unit.vehicleType,
    axles:        unit.axles,
    loadCapacity: unit.loadCapacity,
    fuelCapacity: unit.fuelCapacity,
    ownerCompany: unit.ownerCompany,
    localType:    unit.localType,
    status:       unit.status,
    photoUrl:     unit.photoUrl,
    notes:        unit.notes,
    documents: unit.unitDocuments.map(d => ({
      id:         d.id,
      type:       d.type,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      fileUrl:    d.fileUrl,
    })),
  };

  return (
    <AppShell>
      <UnitDetailClient unit={data} userRole={user.role} />
    </AppShell>
  );
}
