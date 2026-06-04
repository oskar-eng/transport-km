import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReportsClient from "@/components/reports/ReportsClient";
import AppShell from "@/components/layout/AppShell";
import { BarChart3 } from "lucide-react";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [units, drivers] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <BarChart3 className="text-indigo-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
          <p className="text-sm text-gray-500">Análisis consolidado por período, unidad y conductor</p>
        </div>
      </div>
      <ReportsClient units={units} drivers={drivers} />
    </div>
    </AppShell>
  );
}
