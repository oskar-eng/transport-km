import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import SolicitudMaterialesClient from "@/components/solicitud-materiales/SolicitudMaterialesClient";

export default async function SolicitudMaterialesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [reqs, units] = await Promise.all([
    prisma.materialRequest.findMany({ include: { unit: { select: { plate: true, model: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.unit.findMany({ select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } }),
  ]);

  const data = reqs.map(r => ({
    id: r.id, numero: r.numero, unitId: r.unitId, requestedByName: r.requestedByName, date: r.date.toISOString(),
    material: r.material, quantity: r.quantity, status: r.status, photoUrl: r.photoUrl,
    productPhotoUrl: r.productPhotoUrl, receiptUrl: r.receiptUrl, notes: r.notes, unit: r.unit,
  }));

  return (
    <AppShell>
      <SolicitudMaterialesClient requests={data} units={units} userRole={user.role} />
    </AppShell>
  );
}
