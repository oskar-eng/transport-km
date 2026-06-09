"use client";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Gauge, Search, Download, Loader2, UserRound, Truck, Package } from "lucide-react";

interface Order {
  id: string; orderNumber: string; type: string; status: string; clientName: string;
  date: string; driverName: string; plate: string; model: string; km: number; hasData: boolean;
}

const km = (n: number) => `${n.toLocaleString("es-PE")} km`;
const STATUS: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: "Activo", color: "bg-blue-100 text-blue-700" },
  COMPLETADO: { label: "Completado", color: "bg-green-100 text-green-700" },
  CANCELADO: { label: "Cancelado", color: "bg-gray-100 text-gray-600" },
};

function monthKey(d: string) { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; }
function monthLabel(d: string) { return new Date(d).toLocaleDateString("es-PE", { month: "long", year: "numeric" }); }

export default function KilometrajeClient({ orders, isDriver }: { orders: Order[]; isDriver: boolean }) {
  const [tab, setTab] = useState<"orden" | "conductor" | "unidad">("orden");
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState("TODOS");
  const [exporting, setExporting] = useState(false);

  // Opciones de mes
  const meses = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) map.set(monthKey(o.date), monthLabel(o.date));
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/[-\s]/g, "");
    return orders.filter(o => {
      if (mes !== "TODOS" && monthKey(o.date) !== mes) return false;
      if (!q) return true;
      return [o.plate, o.driverName, o.clientName, `OS-${o.orderNumber}`].join(" ").toLowerCase().replace(/[-\s]/g, "").includes(q);
    });
  }, [orders, search, mes]);

  const totalKm = filtered.reduce((s, o) => s + o.km, 0);

  const porConductor = useMemo(() => {
    const map: Record<string, { name: string; km: number; ordenes: number }> = {};
    for (const o of filtered) {
      if (!map[o.driverName]) map[o.driverName] = { name: o.driverName, km: 0, ordenes: 0 };
      map[o.driverName].km += o.km; map[o.driverName].ordenes += 1;
    }
    return Object.values(map).sort((a, b) => b.km - a.km);
  }, [filtered]);

  const porUnidad = useMemo(() => {
    const map: Record<string, { plate: string; model: string; km: number; ordenes: number }> = {};
    for (const o of filtered) {
      if (!map[o.plate]) map[o.plate] = { plate: o.plate, model: o.model, km: 0, ordenes: 0 };
      map[o.plate].km += o.km; map[o.plate].ordenes += 1;
    }
    return Object.values(map).sort((a, b) => b.km - a.km);
  }, [filtered]);

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(o => ({
        Orden: `OS-${o.orderNumber}`, Fecha: format(new Date(o.date), "dd/MM/yyyy"), Tipo: o.type,
        Estado: STATUS[o.status]?.label ?? o.status, Cliente: o.clientName, Conductor: o.driverName,
        Unidad: o.plate, "Km recorridos": o.km,
      }))), "Por Orden");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porConductor.map(c => ({ Conductor: c.name, Órdenes: c.ordenes, "Km recorridos": c.km }))), "Por Conductor");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porUnidad.map(u => ({ Unidad: u.plate, Modelo: u.model, Órdenes: u.ordenes, "Km recorridos": u.km }))), "Por Unidad");
      XLSX.writeFile(wb, `kilometraje_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExporting(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kilometraje Recorrido</h1>
          <p className="text-sm text-gray-400 mt-0.5">Km recorridos según las órdenes {isDriver ? "que realizaste" : "por conductor y unidad"}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Km recorridos", value: km(totalKm), color: "bg-purple-500", icon: Gauge },
          { label: "Órdenes", value: filtered.length, color: "bg-blue-500", icon: Package },
          { label: "Conductores", value: porConductor.length, color: "bg-amber-500", icon: UserRound },
          { label: "Unidades", value: porUnidad.length, color: "bg-emerald-500", icon: Truck },
        ].map(k => { const Icon = k.icon; return (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><Icon size={18} className="text-white" /></div>
            <div><p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          </div>
        ); })}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([["orden", "Por Orden"], ["conductor", "Por Conductor"], ["unidad", "Por Unidad"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>{label}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar placa, conductor, orden…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <select value={mes} onChange={e => setMes(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 capitalize">
          <option value="TODOS">Todos los meses</option>
          {meses.map(m => <option key={m.key} value={m.key} className="capitalize">{m.label}</option>)}
        </select>
        <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-auto">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {/* Por Orden */}
          {tab === "orden" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Orden", "Fecha", "Conductor", "Unidad", "Cliente", "Estado", "Km recorridos"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin datos</td></tr> :
                  filtered.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800">OS-{o.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(o.date), "dd/MM/yyyy", { locale: es })}</td>
                      <td className="px-4 py-3 text-gray-700">{o.driverName}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{o.plate}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{o.clientName}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[o.status]?.color ?? "bg-gray-100"}`}>{STATUS[o.status]?.label ?? o.status}</span></td>
                      <td className="px-4 py-3 font-bold text-gray-900">{o.hasData ? km(o.km) : <span className="text-gray-300 font-normal text-xs">sin registro</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {/* Por Conductor */}
          {tab === "conductor" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Conductor", "Órdenes", "Km recorridos"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {porConductor.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Sin datos</td></tr> :
                  porConductor.map(c => (
                    <tr key={c.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.ordenes}</td>
                      <td className="px-4 py-3 font-bold text-purple-700">{km(c.km)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {/* Por Unidad */}
          {tab === "unidad" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Unidad", "Modelo", "Órdenes", "Km recorridos"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {porUnidad.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin datos</td></tr> :
                  porUnidad.map(u => (
                    <tr key={u.plate} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{u.plate}</td>
                      <td className="px-4 py-3 text-gray-500">{u.model}</td>
                      <td className="px-4 py-3 text-gray-600">{u.ordenes}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{km(u.km)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
