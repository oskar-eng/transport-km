import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import ActiveOrdersTable from "@/components/dashboard/ActiveOrdersTable";
import { getEvents, ROLE_LABELS } from "@/lib/events";
import { Package, Truck, Users, MapPin, TrendingUp, Clock, CheckCircle2, AlertTriangle, FileText, Wrench, ShieldCheck, DollarSign, AlertOctagon } from "lucide-react";
import Link from "next/link";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { unitHabilitado } from "@/lib/vehicleDocsFixed";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as { id: string; role: string; name: string };
  const isDriver = user.role === "CONDUCTOR";
  const where = isDriver ? { driverId: user.id } : {};

  // ── Conteos principales ──────────────────────────────────────
  const [
    totalOrders,
    activeOrders,
    completedOrders,
    totalUnits,
    unitsAvailable,
    unitsInService,
    unitsMaintenance,
    unitsOut,
    driversActive,
    totalDrivers,
  ] = await Promise.all([
    prisma.serviceOrder.count({ where }),
    prisma.serviceOrder.count({ where: { ...where, status: "ACTIVO" } }),
    prisma.serviceOrder.count({ where: { ...where, status: "COMPLETADO" } }),
    isDriver ? Promise.resolve(0) : prisma.unit.count(),
    isDriver ? Promise.resolve(0) : prisma.unit.count({ where: { status: "DISPONIBLE" } }),
    isDriver ? Promise.resolve(0) : prisma.unit.count({ where: { status: "EN_SERVICIO" } }),
    isDriver ? Promise.resolve(0) : prisma.unit.count({ where: { status: "MANTENIMIENTO" } }),
    isDriver ? Promise.resolve(0) : prisma.unit.count({ where: { status: "FUERA_SERVICIO" } }),
    isDriver ? Promise.resolve(0) : prisma.serviceOrder.groupBy({ by: ["driverId"], where: { status: "ACTIVO" } }).then(r => r.length),
    isDriver ? Promise.resolve(0) : prisma.user.count({ where: { role: "CONDUCTOR", active: true } }),
  ]);

  // ── Km totales del mes ───────────────────────────────────────
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthEvents = await prisma.serviceEvent.findMany({
    where: {
      timestamp: { gte: firstOfMonth },
      odometer: { not: null },
      // El conductor ve solo los km de SUS órdenes
      ...(isDriver ? { order: { driverId: user.id } } : {}),
    },
    select: { serviceOrderId: true, odometer: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  // Km por orden: último - primero de la misma orden
  const odomByOrder: Record<string, number[]> = {};
  for (const e of monthEvents) {
    if (e.odometer != null) {
      if (!odomByOrder[e.serviceOrderId]) odomByOrder[e.serviceOrderId] = [];
      odomByOrder[e.serviceOrderId].push(e.odometer);
    }
  }
  const kmMes = Object.values(odomByOrder).reduce((sum, readings) => {
    if (readings.length < 2) return sum;
    return sum + (readings[readings.length - 1] - readings[0]);
  }, 0);

  // ── Órdenes por día (últimos 7 días) ────────────────────────
  const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
  const dailyOrdersData = await Promise.all(
    days.map(async (d) => {
      const count = await prisma.serviceOrder.count({
        where: { ...where, createdAt: { gte: startOfDay(d), lte: endOfDay(d) } },
      });
      return { day: format(d, "EEE", { locale: es }), total: count };
    })
  );

  // ── Próximos mantenimientos y documentos por vencer ─────────
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [maintenanceAlert, docsAlert] = await Promise.all([
    !isDriver ? prisma.maintenanceRecord.findMany({
      where: { status: { not: "COMPLETADO" }, nextDate: { lte: in30 } },
      include: { unit: { select: { plate: true } } },
      orderBy: { nextDate: "asc" },
      take: 4,
    }) : Promise.resolve([]),
    !isDriver ? prisma.vehicleDocument.findMany({
      where: { expiryDate: { lte: in30 } },
      include: { unit: { select: { plate: true } } },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }) : Promise.resolve([]),
  ]);

  // ── Distribución por tipo ────────────────────────────────────
  const [importCount, exportCount] = await Promise.all([
    prisma.serviceOrder.count({ where: { ...where, type: "IMPORTACION" } }),
    prisma.serviceOrder.count({ where: { ...where, type: "EXPORTACION" } }),
  ]);

  // ── Órdenes activas con progreso ─────────────────────────────
  const activeOrdersList = await prisma.serviceOrder.findMany({
    where: { ...where, status: "ACTIVO" },
    include: {
      driver: { select: { name: true } },
      unit: { select: { plate: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const activeOrdersForTable = activeOrdersList.map((o) => {
    const eventDefs = getEvents(o.type);
    const total = eventDefs.length;
    const done = o.events.filter((e) => e.eventType !== "CIERRE_ANTICIPADO").length;
    const progress = Math.round((done / total) * 100);
    const nextDef = eventDefs.find((e) => !o.events.map((ev) => ev.eventType).includes(e.key));
    const currentState = nextDef?.label ?? "Completando...";
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      type: o.type,
      clientName: o.clientName,
      driver: o.driver,
      unit: o.unit,
      progress,
      currentState,
      createdAt: o.createdAt.toISOString(),
    };
  });

  // ── Disponibilidad de flota % ────────────────────────────────
  const disponibilidad = totalUnits > 0
    ? Math.round(((unitsAvailable + unitsInService) / totalUnits) * 100)
    : 0;

  const utilizacion = totalUnits > 0
    ? Math.round((unitsInService / totalUnits) * 100)
    : 0;

  // ── Métricas nuevas: habilitadas, gasto del mes, sanciones ──
  let unitsHabilitadas = 0, gastoMes = 0, sancionesPendientes = 0;
  if (!isDriver) {
    const [unitsWithDocs, expSum, fuelSum, maintSum, sancPend] = await Promise.all([
      prisma.unit.findMany({ include: { unitDocuments: true } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: firstOfMonth } } }),
      prisma.fuelRecord.aggregate({ _sum: { totalCost: true }, where: { date: { gte: firstOfMonth } } }),
      prisma.maintenanceRecord.aggregate({ _sum: { cost: true }, where: { date: { gte: firstOfMonth } } }),
      prisma.sancion.count({ where: { status: "PENDIENTE" } }),
    ]);
    unitsHabilitadas = unitsWithDocs.filter(u => unitHabilitado(u.unitDocuments.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl })))).length;
    gastoMes = (expSum._sum.amount ?? 0) + (fuelSum._sum.totalCost ?? 0) + (maintSum._sum.cost ?? 0);
    sancionesPendientes = sancPend;
  }
  const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;

  // ── KPIs cards config ────────────────────────────────────────
  const kpis = isDriver
    ? [
        { label: "Mis órdenes totales",   value: totalOrders,    icon: Package,      color: "bg-blue-500",   sub: "historial completo" },
        { label: "En curso",               value: activeOrders,   icon: Clock,        color: "bg-yellow-500", sub: "activas ahora" },
        { label: "Completadas",            value: completedOrders, icon: CheckCircle2, color: "bg-green-500",  sub: "este historial" },
        { label: "Km este mes",            value: kmMes > 0 ? `${kmMes.toLocaleString()}` : "—", icon: TrendingUp, color: "bg-purple-500", sub: "kilómetros" },
      ]
    : [
        { label: "Órdenes activas",        value: activeOrders,    icon: Package,      color: "bg-blue-500",    sub: `${totalOrders} totales` },
        { label: "Unidades en servicio",   value: unitsInService,  icon: Truck,        color: "bg-indigo-500",  sub: `${unitsAvailable} disponibles` },
        { label: "Conductores en ruta",    value: driversActive,   icon: Users,        color: "bg-yellow-500",  sub: `${totalDrivers} activos` },
        { label: "Km este mes",            value: kmMes > 0 ? kmMes.toLocaleString() : "—", icon: TrendingUp, color: "bg-emerald-500", sub: "kilómetros recorridos" },
        { label: "Disponibilidad flota",   value: `${disponibilidad}%`, icon: CheckCircle2, color: "bg-green-500",  sub: "operativas vs total" },
        { label: "Utilización flota",      value: `${utilizacion}%`,     icon: MapPin,       color: "bg-orange-500", sub: "en ruta ahora" },
        { label: "Unidades habilitadas",   value: `${unitsHabilitadas}/${totalUnits}`, icon: ShieldCheck, color: "bg-teal-500", sub: "documentos al día" },
        { label: "Gasto del mes",          value: gastoMes > 0 ? money(gastoMes) : "—", icon: DollarSign, color: "bg-rose-500", sub: "combustible + manten. + gastos" },
        { label: "Sanciones pendientes",   value: sancionesPendientes, icon: AlertOctagon, color: "bg-red-500", sub: "por pagar" },
      ];

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user.name} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {ROLE_LABELS[user.role]} · {format(now, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        {!isDriver && (
          <Link href="/orders/new"
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Package size={15} /> Nueva Orden
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-4 mb-6 ${isDriver ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"}`}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className={`${k.color} p-2.5 rounded-xl flex-shrink-0`}>
                <Icon className="text-white" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 leading-tight">{k.value}</p>
                <p className="text-xs font-medium text-gray-700 truncate">{k.label}</p>
                <p className="text-xs text-gray-400 truncate">{k.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerta si hay unidades en mantenimiento o fuera de servicio */}
      {!isDriver && (unitsMaintenance > 0 || unitsOut > 0) && (
        <div className="mb-5 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            {unitsMaintenance > 0 && <><strong>{unitsMaintenance}</strong> unidad{unitsMaintenance > 1 ? "es" : ""} en mantenimiento. </>}
            {unitsOut > 0 && <><strong>{unitsOut}</strong> fuera de servicio. </>}
            <Link href="/units" className="underline font-semibold hover:text-yellow-900">Ver unidades →</Link>
          </p>
        </div>
      )}

      {/* Gráficos — solo para no conductores */}
      {!isDriver && (
        <div className="mb-6">
          <DashboardCharts
            dailyOrders={dailyOrdersData}
            typeDist={[
              { name: "Importación", value: importCount },
              { name: "Exportación", value: exportCount },
            ]}
            fleetDist={[
              { name: "Disponible",       value: unitsAvailable,    color: "#22c55e" },
              { name: "En Servicio",      value: unitsInService,    color: "#3b82f6" },
              { name: "Mantenimiento",    value: unitsMaintenance,  color: "#f59e0b" },
              { name: "Fuera Servicio",   value: unitsOut,          color: "#ef4444" },
            ]}
          />
        </div>
      )}

      {/* Alertas de mantenimiento */}
      {!isDriver && maintenanceAlert.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Mantenimientos próximos</h2>
            </div>
            <Link href="/maintenance" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y">
            {maintenanceAlert.map((m) => {
              const days = m.nextDate ? Math.round((m.nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${days !== null && days <= 7 ? "bg-red-500" : "bg-blue-400"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{m.description}</p>
                    <p className="text-xs text-gray-400">{m.unit.plate}</p>
                  </div>
                  {days !== null && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${days <= 7 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                      {days === 0 ? "Hoy" : `En ${days}d`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alertas de documentos */}
      {!isDriver && docsAlert.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-red-500" />
              <h2 className="font-semibold text-gray-900">Documentos por vencer o vencidos</h2>
            </div>
            <Link href="/documents" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y">
            {docsAlert.map((d) => {
              const days = Math.round((d.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const vencido = days < 0;
              return (
                <div key={d.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${vencido ? "bg-red-500" : "bg-yellow-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.unit.plate}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${vencido ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {vencido ? `Vencido hace ${Math.abs(days)}d` : `Vence en ${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Órdenes activas */}
      <ActiveOrdersTable orders={activeOrdersForTable} />

    </AppShell>
  );
}
