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
    include: {
      unitDocuments: true,
      orders:      { include: { driver: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
      maintenance: { orderBy: { date: "desc" }, take: 50 },
      expenses:    { orderBy: { date: "desc" }, take: 50 },
      fuelRecords: { orderBy: { date: "desc" }, take: 50 },
      sanciones:   { orderBy: { date: "desc" }, take: 50 },
    },
  });

  if (!unit) notFound();

  // Bitácora unificada (línea de tiempo)
  type BitacoraItem = { tipo: string; fecha: string; titulo: string; detalle: string; monto: number | null };
  const bitacora: BitacoraItem[] = [
    ...unit.orders.map(o => ({ tipo: "orden", fecha: o.createdAt.toISOString(), titulo: `Orden ${o.orderNumber} · ${o.type === "IMPORTACION" ? "Importación" : "Exportación"}`, detalle: `${o.clientName} — conductor ${o.driver.name} (${o.status})`, monto: null })),
    ...unit.maintenance.map(m => ({ tipo: "mantenimiento", fecha: m.date.toISOString(), titulo: `Mantenimiento ${m.type}`, detalle: `${m.description}${m.workshop ? ` · ${m.workshop}` : ""}`, monto: m.cost ?? null })),
    ...unit.expenses.map(e => ({ tipo: "gasto", fecha: e.date.toISOString(), titulo: `Gasto: ${e.category}`, detalle: e.description, monto: e.amount })),
    ...unit.fuelRecords.map(f => ({ tipo: "combustible", fecha: f.date.toISOString(), titulo: `Combustible: ${f.liters} Gal`, detalle: `${f.station ?? "Grifo"} · ${f.odometer.toLocaleString()} km`, monto: f.totalCost ?? null })),
    ...unit.sanciones.map(s => ({ tipo: "sancion", fecha: s.date.toISOString(), titulo: `Sanción: ${s.type}`, detalle: `${s.description} (${s.status})`, monto: s.amount ?? null })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

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
      <UnitDetailClient unit={data} bitacora={bitacora} userRole={user.role} />
    </AppShell>
  );
}
