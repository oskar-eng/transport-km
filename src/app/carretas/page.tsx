import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import CarretasClient from "@/components/carretas/CarretasClient";

export default async function CarretasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const trailers = await prisma.trailer.findMany({
    orderBy: { plate: "asc" },
    include: { documents: true },
  });

  const serialized = trailers.map(t => ({
    id: t.id, plate: t.plate, length: t.length, equipmentType: t.equipmentType,
    year: t.year, axles: t.axles, tare: t.tare, localType: t.localType,
    status: t.status, photoUrl: t.photoUrl,
    documents: t.documents.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl })),
  }));

  return (
    <AppShell>
      <CarretasClient trailers={serialized} userRole={user.role} />
    </AppShell>
  );
}
