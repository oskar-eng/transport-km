"use client";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Truck, ArrowRight } from "lucide-react";

interface ActiveOrder {
  id: string;
  orderNumber: string;
  type: string;
  clientName: string;
  driver: { name: string };
  unit: { plate: string };
  progress: number;   // 0-100
  currentState: string;
  createdAt: string;
}

export default function ActiveOrdersTable({ orders }: { orders: ActiveOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
        <Truck size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hay órdenes activas en este momento</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Órdenes activas en curso</h2>
        <Link href="/orders?status=ACTIVO" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          Ver todas <ArrowRight size={12} />
        </Link>
      </div>
      <div className="divide-y">
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-900">{o.orderNumber}</p>
                <span className="text-xs text-gray-400">
                  {format(new Date(o.createdAt), "dd/MM HH:mm", { locale: es })}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mb-1.5">
                {o.type === "IMPORTACION" ? "Importación" : "Exportación"} · {o.clientName} · {o.unit.plate} · {o.driver.name}
              </p>
              {/* Barra de progreso */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${o.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{o.progress}%</span>
              </div>
              <p className="text-xs text-blue-600 mt-0.5">{o.currentState}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
