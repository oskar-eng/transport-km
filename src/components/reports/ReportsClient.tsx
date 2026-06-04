"use client";
import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { FileDown, Filter, TrendingUp, Truck, Package, DollarSign, Fuel, Wrench } from "lucide-react";

interface Unit    { id: string; plate: string; model: string; }
interface Driver  { id: string; name: string; }
interface Order   { id: string; orderNumber: string; type: string; status: string; clientName: string; origin?: string|null; destination?: string|null; createdAt: string; unit: { plate: string; model: string }; driver: { name: string }; }
interface FuelRec { id: string; unitId: string; date: string; liters: number; totalCost?: number|null; odometer: number; station?: string|null; fuelType: string; unit: { plate: string; model: string }; }
interface MaintRec{ id: string; unitId: string; date: string; type: string; status: string; description: string; cost?: number|null; unit: { plate: string; model: string }; }
interface OtherCost{ id: string; unitId: string; date: string; category: string; description: string; amount: number; unit: { plate: string; model: string }; }

interface ReportData {
  orders: Order[]; fuelRecords: FuelRec[]; maintenance: MaintRec[]; otherCosts: OtherCost[];
  units: Unit[]; drivers: Driver[];
}

const COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const STATUS_LABEL: Record<string,string> = { PENDIENTE:"Pendiente", ACTIVO:"Activo", COMPLETADO:"Completado", CANCELADO:"Cancelado" };
const TYPE_LABEL: Record<string,string>   = { IMPORTACION:"Importación", EXPORTACION:"Exportación", LOCAL:"Local", OTRO:"Otro" };
const CAT_LABEL: Record<string,string>    = { PEAJE:"Peajes", SEGURO:"Seguros", LLANTAS:"Llantas", CONDUCTOR:"Conductor", ADMINISTRATIVO:"Administrativo", OTRO:"Otros" };

const fmt = (n: number) => `S/ ${n.toLocaleString("es-PE",{minimumFractionDigits:0,maximumFractionDigits:0})}`;

const TABS = ["Resumen","Órdenes","Combustible","Mantenimiento","Costos"] as const;
type Tab = typeof TABS[number];

export default function ReportsClient({ units, drivers }: { units: Unit[]; drivers: Driver[] }) {
  const today    = new Date().toISOString().slice(0,10);
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);

  const [from,     setFrom]     = useState(firstDay);
  const [to,       setTo]       = useState(today);
  const [unitId,   setUnitId]   = useState("");
  const [driverId, setDriverId] = useState("");
  const [tab,      setTab]      = useState<Tab>("Resumen");
  const [data,     setData]     = useState<ReportData | null>(null);
  const [loading,  setLoading]  = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ from, to, ...(unitId ? { unitId } : {}), ...(driverId ? { driverId } : {}) });
    const res  = await fetch(`/api/reports?${q}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [from, to, unitId, driverId]);

  /* ── derived metrics ── */
  const metrics = useMemo(() => {
    if (!data) return null;
    const totalFuel  = data.fuelRecords.reduce((s,r) => s + (r.totalCost ?? 0), 0);
    const totalMaint = data.maintenance.reduce((s,r) => s + (r.cost ?? 0), 0);
    const totalOther = data.otherCosts.reduce((s,r) => s + r.amount, 0);
    const totalCost  = totalFuel + totalMaint + totalOther;

    // orders by type
    const byType: Record<string,number> = {};
    for (const o of data.orders) byType[o.type] = (byType[o.type] ?? 0) + 1;

    // orders by status
    const byStatus: Record<string,number> = {};
    for (const o of data.orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

    // cost breakdown for pie
    const costPie = [
      { name:"Combustible",   value: Math.round(totalFuel)  },
      { name:"Mantenimiento", value: Math.round(totalMaint) },
      { name:"Otros",         value: Math.round(totalOther) },
    ].filter(d => d.value > 0);

    // orders per week (last 8 weeks within range)
    const weekMap: Record<string,number> = {};
    for (const o of data.orders) {
      const d = new Date(o.createdAt);
      const week = `${d.getFullYear()}-S${String(Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)).padStart(2,"0")}`;
      weekMap[week] = (weekMap[week] ?? 0) + 1;
    }
    const ordersOverTime = Object.entries(weekMap).sort(([a],[b]) => a.localeCompare(b)).slice(-8).map(([week,qty]) => ({ week, qty }));

    // fuel per unit
    const fuelByUnit: Record<string,{ plate:string; liters:number; cost:number }> = {};
    for (const r of data.fuelRecords) {
      if (!fuelByUnit[r.unitId]) fuelByUnit[r.unitId] = { plate: r.unit.plate, liters: 0, cost: 0 };
      fuelByUnit[r.unitId].liters += r.liters;
      fuelByUnit[r.unitId].cost   += r.totalCost ?? 0;
    }
    const fuelChart = Object.values(fuelByUnit).sort((a,b) => b.cost - a.cost).slice(0,8);

    return { totalCost, totalFuel, totalMaint, totalOther, byType, byStatus, costPie, ordersOverTime, fuelChart };
  }, [data]);

  /* ── Excel export ── */
  const exportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb   = XLSX.utils.book_new();

    // Orders sheet
    const ordRows = data.orders.map(o => ({
      "N° Orden": o.orderNumber, Tipo: TYPE_LABEL[o.type]??o.type, Estado: STATUS_LABEL[o.status]??o.status,
      Cliente: o.clientName, Origen: o.origin??"", Destino: o.destination??"",
      Unidad: o.unit.plate, Conductor: o.driver.name, Fecha: o.createdAt.slice(0,10),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordRows), "Órdenes");

    // Fuel sheet
    const fuelRows = data.fuelRecords.map(r => ({
      Fecha: r.date.slice(0,10), Unidad: r.unit.plate, Modelo: r.unit.model,
      "Litros": r.liters, "Costo Total (S/)": r.totalCost??0,
      Odómetro: r.odometer, Estación: r.station??"", Combustible: r.fuelType,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fuelRows), "Combustible");

    // Maintenance sheet
    const maintRows = data.maintenance.map(r => ({
      Fecha: r.date.slice(0,10), Unidad: r.unit.plate, Tipo: r.type,
      Estado: r.status, Descripción: r.description, "Costo (S/)": r.cost??0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maintRows), "Mantenimiento");

    // Costs sheet
    const costRows = data.otherCosts.map(c => ({
      Fecha: c.date.slice(0,10), Unidad: c.unit.plate, Categoría: CAT_LABEL[c.category]??c.category,
      Descripción: c.description, "Monto (S/)": c.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costRows), "Otros Costos");

    XLSX.writeFile(wb, `reporte_${from}_${to}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Unidad</label>
            <select value={unitId} onChange={e => setUnitId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.plate}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Conductor</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button onClick={fetchReport} disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Filter size={14} /> {loading ? "Cargando…" : "Generar Reporte"}
          </button>
          {data && (
            <button onClick={exportExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">
              <FileDown size={14} /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {!data && !loading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <TrendingUp size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Selecciona un rango de fechas y genera el reporte</p>
        </div>
      )}

      {data && metrics && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label:"Órdenes",      value: data.orders.length,          icon: Package,  color:"blue"   },
              { label:"Costo Total",  value: fmt(metrics.totalCost),      icon: DollarSign, color:"green" },
              { label:"Combustible",  value: fmt(metrics.totalFuel),      icon: Fuel,     color:"amber"  },
              { label:"Mantenimiento",value: fmt(metrics.totalMaint),     icon: Wrench,   color:"orange" },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`bg-${k.color}-100 p-2 rounded-lg`}>
                    <Icon size={18} className={`text-${k.color}-600`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{k.label}</p>
                    <p className={`text-lg font-bold text-${k.color}-600`}>{k.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab===t ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* ── RESUMEN ── */}
          {tab === "Resumen" && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Orders over time */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Órdenes por Semana</h3>
                {metrics.ordersOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.ordersOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="qty" name="Órdenes" fill="#3b82f6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-10">Sin datos</p>}
              </div>

              {/* Cost breakdown pie */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución de Costos</h3>
                {metrics.costPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={metrics.costPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
                        {metrics.costPie.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v:number) => fmt(v)} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-10">Sin costos registrados</p>}
              </div>

              {/* Orders by type */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Órdenes por Tipo</h3>
                <div className="space-y-2">
                  {Object.entries(metrics.byType).map(([type, qty]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{TYPE_LABEL[type]??type}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width:`${(qty/data.orders.length)*100}%` }} />
                        </div>
                        <span className="text-sm font-semibold w-6 text-right">{qty}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(metrics.byType).length === 0 && <p className="text-gray-400 text-sm">Sin órdenes</p>}
                </div>
              </div>

              {/* Fuel by unit bar */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Combustible por Unidad (S/)</h3>
                {metrics.fuelChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.fuelChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={(v)=>`S/${v}`} />
                      <YAxis type="category" dataKey="plate" tick={{ fontSize:10 }} width={50} />
                      <Tooltip formatter={(v:number) => fmt(v)} />
                      <Bar dataKey="cost" name="Costo" fill="#f59e0b" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-10">Sin registros de combustible</p>}
              </div>
            </div>
          )}

          {/* ── ÓRDENES ── */}
          {tab === "Órdenes" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">{data.orders.length} órdenes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{["N° Orden","Tipo","Estado","Cliente","Unidad","Conductor","Fecha"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                        <td className="px-4 py-3">{TYPE_LABEL[o.type]??o.type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            o.status==="COMPLETADO"?"bg-green-100 text-green-700":
                            o.status==="ACTIVO"?"bg-blue-100 text-blue-700":
                            o.status==="CANCELADO"?"bg-red-100 text-red-700":"bg-yellow-100 text-yellow-700"
                          }`}>{STATUS_LABEL[o.status]??o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{o.clientName}</td>
                        <td className="px-4 py-3">{o.unit.plate}</td>
                        <td className="px-4 py-3 text-gray-600">{o.driver.name}</td>
                        <td className="px-4 py-3 text-gray-500">{o.createdAt.slice(0,10)}</td>
                      </tr>
                    ))}
                    {data.orders.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin órdenes en el período</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COMBUSTIBLE ── */}
          {tab === "Combustible" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">{data.fuelRecords.length} registros · Total: {fmt(metrics.totalFuel)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{["Fecha","Unidad","Litros","Costo","Odómetro","Estación","Tipo"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.fuelRecords.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{r.date.slice(0,10)}</td>
                        <td className="px-4 py-3 font-medium">{r.unit.plate}</td>
                        <td className="px-4 py-3">{r.liters.toFixed(1)} L</td>
                        <td className="px-4 py-3 font-semibold">{r.totalCost ? fmt(r.totalCost) : "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{r.odometer.toLocaleString()} km</td>
                        <td className="px-4 py-3 text-gray-500">{r.station??"—"}</td>
                        <td className="px-4 py-3">{r.fuelType}</td>
                      </tr>
                    ))}
                    {data.fuelRecords.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin registros de combustible</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MANTENIMIENTO ── */}
          {tab === "Mantenimiento" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">{data.maintenance.length} registros · Total: {fmt(metrics.totalMaint)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{["Fecha","Unidad","Tipo","Estado","Descripción","Costo"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.maintenance.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{r.date.slice(0,10)}</td>
                        <td className="px-4 py-3 font-medium">{r.unit.plate}</td>
                        <td className="px-4 py-3">{r.type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status==="COMPLETADO"?"bg-green-100 text-green-700":
                            r.status==="EN_PROCESO"?"bg-blue-100 text-blue-700":"bg-yellow-100 text-yellow-700"
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{r.description}</td>
                        <td className="px-4 py-3 font-semibold">{r.cost ? fmt(r.cost) : "—"}</td>
                      </tr>
                    ))}
                    {data.maintenance.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin registros de mantenimiento</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COSTOS ── */}
          {tab === "Costos" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">{data.otherCosts.length} registros · Total: {fmt(metrics.totalOther)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{["Fecha","Unidad","Categoría","Descripción","Monto"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.otherCosts.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{c.date.slice(0,10)}</td>
                        <td className="px-4 py-3 font-medium">{c.unit.plate}</td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{CAT_LABEL[c.category]??c.category}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{c.description}</td>
                        <td className="px-4 py-3 font-semibold">{fmt(c.amount)}</td>
                      </tr>
                    ))}
                    {data.otherCosts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin otros costos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
