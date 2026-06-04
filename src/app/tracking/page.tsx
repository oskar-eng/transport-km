import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrackingMap from "@/components/tracking/TrackingMap";
import AppShell from "@/components/layout/AppShell";

export default async function TrackingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(role)) redirect("/dashboard");

  return (
    <AppShell>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Seguimiento en Tiempo Real</h1>
          <p className="text-sm text-gray-500">Posiciones GPS actualizadas cada 15 segundos</p>
        </div>
        <TrackingMap />
      </div>
    </AppShell>
  );
}
