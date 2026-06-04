import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import DocumentsClient from "@/components/documents/DocumentsClient";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [docs, units] = await Promise.all([
    prisma.vehicleDocument.findMany({
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.unit.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true, model: true } }),
  ]);

  return (
    <AppShell>
      <DocumentsClient
        docs={docs.map((d) => ({ ...d, issueDate: d.issueDate?.toISOString() ?? null, expiryDate: d.expiryDate.toISOString(), createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() }))}
        units={units}
        userRole={user.role}
      />
    </AppShell>
  );
}
