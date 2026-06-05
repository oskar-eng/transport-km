import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import { ClipboardCheck, AlertTriangle, Boxes, DollarSign, TrendingUp, Wrench } from "lucide-react";

const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;

export default async function ReportesMantenimientoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [wos, incidents, parts, requests] = await Promise.all([
    prisma.workOrder.findMany({ include: { materials: true } }),
    prisma.incident.findMany(),
    prisma.sparePart.findMany(),
    prisma.materialRequest.findMany(),
  ]);

  const woCost = (w: typeof wos[number]) => w.materials.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0) + (w.laborCost ?? 0);
  const costoTotal = wos.reduce((s, w) => s + woCost(w), 0);
  const prev = wos.filter(w => w.type === "PREVENTIVO").length;
  const corr = wos.filter(w => w.type === "CORRECTIVO").length;
  const cerradas = wos.filter(w => w.status === "CERRADA").length;
  const valorInv = parts.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);
  const critico = parts.filter(p => p.stock <= p.minStock).length;
  const pctPrev = wos.length > 0 ? Math.round((prev / wos.length) * 100) : 0;

  const Card = ({ icon: Icon, label, value, color, sub }: { icon: typeof Wrench; label: string; value: string | number; color: string; sub?: string }) => (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"><div className={`${color} p-2.5 rounded-xl shrink-0`}><Icon size={18} className="text-white" /></div><div><p className="text-lg font-bold text-gray-900 leading-tight">{value}</p><p className="text-xs text-gray-700">{label}</p>{sub && <p className="text-xs text-gray-400">{sub}</p>}</div></div>
  );

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportes de Mantenimiento</h1>
        <p className="text-sm text-gray-400 mt-0.5">Indicadores KPI del taller y almacén</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <Card icon={ClipboardCheck} label="Órdenes de trabajo" value={wos.length} color="bg-blue-500" sub={`${cerradas} cerradas`} />
        <Card icon={Wrench} label="Preventivas" value={prev} color="bg-indigo-500" sub={`${pctPrev}% del total`} />
        <Card icon={Wrench} label="Correctivas" value={corr} color="bg-orange-500" />
        <Card icon={DollarSign} label="Costo total mant." value={money(costoTotal)} color="bg-emerald-500" />
        <Card icon={AlertTriangle} label="Incidencias" value={incidents.length} color="bg-red-500" sub={`${incidents.filter(i => i.status !== "RESUELTA").length} sin resolver`} />
        <Card icon={Boxes} label="Repuestos" value={parts.length} color="bg-slate-500" sub={`${critico} en stock crítico`} />
        <Card icon={DollarSign} label="Valor inventario" value={money(valorInv)} color="bg-teal-500" />
        <Card icon={TrendingUp} label="Solicitudes material" value={requests.length} color="bg-amber-500" sub={`${requests.filter(r => r.status === "PENDIENTE").length} pendientes`} />
      </div>

      {/* Indicador preventivo vs correctivo */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Ratio Preventivo / Correctivo</h2>
        <p className="text-xs text-gray-400 mb-4">Un mayor % de preventivo indica mejor gestión de la flota</p>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: `${pctPrev}%` }}>{pctPrev > 10 ? `${pctPrev}% Prev.` : ""}</div>
          <div className="bg-orange-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: `${100 - pctPrev}%` }}>{100 - pctPrev > 10 ? `${100 - pctPrev}% Corr.` : ""}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Estado de órdenes de trabajo</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[["Abiertas", wos.filter(w => w.status === "ABIERTA").length, "text-blue-600"], ["En proceso", wos.filter(w => w.status === "EN_PROCESO").length, "text-amber-600"], ["Cerradas", cerradas, "text-green-600"]].map(([l, v, c]) => (
            <div key={l as string}><p className={`text-3xl font-bold ${c}`}>{v as number}</p><p className="text-xs text-gray-500 mt-1">{l as string}</p></div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
