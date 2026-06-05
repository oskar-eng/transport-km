import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import { DollarSign, Wrench, Package, User, Gauge } from "lucide-react";

const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default async function CostosMantenimientoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { role: string };
  if (user.role === "CONDUCTOR") redirect("/dashboard");

  const [wos, units] = await Promise.all([
    prisma.workOrder.findMany({ include: { unit: { select: { id: true, plate: true, model: true } }, materials: true } }),
    prisma.unit.findMany({ include: { fuelRecords: { select: { odometer: true } } } }),
  ]);

  const woCost = (w: typeof wos[number]) => w.materials.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0) + (w.laborCost ?? 0);
  const total = wos.reduce((s, w) => s + woCost(w), 0);
  const totalMateriales = wos.reduce((s, w) => s + w.materials.reduce((a, m) => a + (m.unitCost ?? 0) * m.quantity, 0), 0);
  const totalManoObra = wos.reduce((s, w) => s + (w.laborCost ?? 0), 0);

  // Por unidad
  const porUnidad: Record<string, { plate: string; model: string; total: number; ots: number; km: number }> = {};
  for (const u of units) {
    const odos = u.fuelRecords.map(f => f.odometer);
    porUnidad[u.id] = { plate: u.plate, model: u.model, total: 0, ots: 0, km: odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0 };
  }
  for (const w of wos) { if (porUnidad[w.unitId]) { porUnidad[w.unitId].total += woCost(w); porUnidad[w.unitId].ots += 1; } }
  const unidadRows = Object.values(porUnidad).filter(u => u.total > 0).sort((a, b) => b.total - a.total);

  // Por tipo
  const prevTotal = wos.filter(w => w.type === "PREVENTIVO").reduce((s, w) => s + woCost(w), 0);
  const corrTotal = wos.filter(w => w.type === "CORRECTIVO").reduce((s, w) => s + woCost(w), 0);

  // Por mecánico
  const porMec: Record<string, number> = {};
  for (const w of wos) { const m = w.mechanic || "Sin asignar"; porMec[m] = (porMec[m] ?? 0) + woCost(w); }
  const mecRows = Object.entries(porMec).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Costos de Mantenimiento</h1>
        <p className="text-sm text-gray-400 mt-0.5">Análisis de costos por unidad, tipo, mecánico y costo por km</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Costo total", value: money(total), color: "bg-blue-500", icon: DollarSign },
          { label: "Materiales", value: money(totalMateriales), color: "bg-indigo-500", icon: Package },
          { label: "Mano de obra", value: money(totalManoObra), color: "bg-amber-500", icon: Wrench },
          { label: "Órdenes", value: wos.length, color: "bg-emerald-500", icon: Wrench },
        ].map(k => { const I = k.icon; return (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"><div className={`${k.color} p-2.5 rounded-xl shrink-0`}><I size={18} className="text-white" /></div><div><p className="text-base font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div></div>
        ); })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Preventivo vs Correctivo */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Por tipo de mantenimiento</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-blue-700 font-medium">Preventivo</span><span className="font-bold">{money(prevTotal)}</span></div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${total > 0 ? (prevTotal / total) * 100 : 0}%` }} /></div>
            <div className="flex items-center justify-between"><span className="text-sm text-orange-700 font-medium">Correctivo</span><span className="font-bold">{money(corrTotal)}</span></div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${total > 0 ? (corrTotal / total) * 100 : 0}%` }} /></div>
          </div>
        </div>

        {/* Por mecánico */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={16} className="text-gray-400" /> Por mecánico</h2>
          {mecRows.length === 0 ? <p className="text-sm text-gray-400">Sin datos</p> : (
            <div className="space-y-2">{mecRows.map(([m, v]) => (<div key={m} className="flex justify-between text-sm"><span className="text-gray-700">{m}</span><span className="font-semibold">{money(v)}</span></div>))}</div>
          )}
        </div>
      </div>

      {/* Por unidad + costo por km */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><Gauge size={16} className="text-gray-400" /> Costo por unidad y costo por km</h2></div>
        {unidadRows.length === 0 ? <p className="p-10 text-center text-sm text-gray-400">No hay costos de mantenimiento registrados</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{["Unidad","Órdenes","Km recorridos","Costo total","Costo por km"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {unidadRows.map((u, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-mono font-semibold text-gray-900">{u.plate}</p><p className="text-xs text-gray-400">{u.model}</p></td>
                  <td className="px-4 py-3 text-gray-600">{u.ots}</td>
                  <td className="px-4 py-3 text-gray-600">{u.km > 0 ? `${u.km.toLocaleString()} km` : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-blue-800">{money(u.total)}</td>
                  <td className="px-4 py-3 text-gray-700">{u.km > 0 ? money(u.total / u.km) + "/km" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </AppShell>
  );
}
