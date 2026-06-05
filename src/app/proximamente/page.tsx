import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Construction } from "lucide-react";

export default async function ProximamentePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { m } = await searchParams;

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-amber-100 rounded-full p-5 mb-4">
          <Construction size={40} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{m ?? "Módulo"}</h1>
        <p className="text-gray-500 mt-2 max-w-md">Este módulo está en construcción y estará disponible próximamente. 🔧</p>
        <p className="text-xs text-gray-400 mt-1">Forma parte del sistema de Mantenimiento de Flota.</p>
      </div>
    </AppShell>
  );
}
