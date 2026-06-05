import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import TrailerDetailClient from "@/components/carretas/TrailerDetailClient";

export default async function TrailerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const { id } = await params;
  const trailer = await prisma.trailer.findUnique({ where: { id }, include: { documents: true } });
  if (!trailer) notFound();

  const data = {
    id: trailer.id, plate: trailer.plate, length: trailer.length, equipmentType: trailer.equipmentType,
    year: trailer.year, axles: trailer.axles, tare: trailer.tare, localType: trailer.localType,
    status: trailer.status, photoUrl: trailer.photoUrl,
    documents: trailer.documents.map(d => ({ id: d.id, type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl })),
  };

  return (
    <AppShell>
      <TrailerDetailClient trailer={data} userRole={user.role} />
    </AppShell>
  );
}
