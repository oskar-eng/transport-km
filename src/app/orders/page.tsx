import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { Plus } from "lucide-react";
import { canManageOrders } from "@/lib/events";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; role: string };

  const where = user.role === "CONDUCTOR" ? { driverId: user.id } : {};

  const orders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      driver: { select: { name: true } },
      unit: { select: { plate: true } },
      events: true,
    },
  });

  const statusColors: Record<string, string> = {
    ACTIVO: "bg-yellow-100 text-yellow-800",
    COMPLETADO: "bg-green-100 text-green-800",
    PENDIENTE: "bg-gray-100 text-gray-700",
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Servicio</h1>
        {canManageOrders(user.role) && (
          <Link
            href="/orders/new"
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nueva Orden
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">N° Orden</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Unidad</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Conductor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Progreso</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-10">
                    Sin órdenes registradas
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const totalEvents = order.type === "EXPORTACION" ? 12 : 11;
                  const pct = Math.round((order.events.length / totalEvents) * 100);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="text-blue-700 font-semibold hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${order.type === "IMPORTACION" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}>
                          {order.type === "IMPORTACION" ? "Importación" : "Exportación"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{order.clientName}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{order.unit.plate}</td>
                      <td className="px-4 py-3 text-gray-700">{order.driver.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10">{order.events.length}/{totalEvents}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
