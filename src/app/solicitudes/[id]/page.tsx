import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import SolicitudDetailClient from "@/components/solicitudes/SolicitudDetailClient";

export default async function SolicitudDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const { id } = await params;
  const s = await prisma.solicitud.findUnique({ where: { id } });
  if (!s) notFound();

  const data = {
    id: s.id, numero: s.numero, tipo: s.tipo, entidad: s.entidad, docOrPlate: s.docOrPlate,
    entityName: s.entityName, localType: s.localType, docType: s.docType, fileUrl: s.fileUrl,
    expiryDate: s.expiryDate?.toISOString() ?? null, estado: s.estado,
    createdByName: s.createdByName, createdAt: s.createdAt.toISOString(),
  };

  return (
    <AppShell>
      <SolicitudDetailClient s={data} />
    </AppShell>
  );
}
