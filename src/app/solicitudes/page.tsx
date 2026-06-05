import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import SolicitudesClient from "@/components/solicitudes/SolicitudesClient";

export default async function SolicitudesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const solicitudes = await prisma.solicitud.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  const data = solicitudes.map(s => ({
    id: s.id, numero: s.numero, tipo: s.tipo, entidad: s.entidad, docOrPlate: s.docOrPlate,
    entityName: s.entityName, localType: s.localType, docType: s.docType, estado: s.estado,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
      <SolicitudesClient solicitudes={data} />
    </AppShell>
  );
}
