"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Package, Wrench, Receipt, Fuel, AlertOctagon, Search } from "lucide-react";

interface Item { tipo: string; fecha: string; titulo: string; detalle: string; monto: number | null; link: string }

const CFG: Record<string, { icon: typeof Package; color: string; label: string }> = {
  orden:         { icon: Package,      color: "bg-blue-100 text-blue-700",     label: "Órdenes" },
  mantenimiento: { icon: Wrench,       color: "bg-amber-100 text-amber-700",   label: "Mantenimiento" },
  gasto:         { icon: Receipt,      color: "bg-slate-100 text-slate-700",   label: "Gastos" },
  combustible:   { icon: Fuel,         color: "bg-indigo-100 text-indigo-700", label: "Combustible" },
  sancion:       { icon: AlertOctagon, color: "bg-red-100 text-red-700",       label: "Sanciones" },
};

const TABS = [["todos","Todo"],["orden","Órdenes"],["mantenimiento","Mantenimiento"],["gasto","Gastos"],["combustible","Combustible"],["sancion","Sanciones"]] as const;

export default function BitacoraClient({ items }: { items: Item[] }) {
  const [tab, setTab] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => items.filter(it => {
    const matchTab = tab === "todos" || it.tipo === tab;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || it.titulo.toLowerCase().includes(q) || it.detalle.toLowerCase().includes(q);
    return matchTab && matchSearch;
  }), [items, tab, search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History size={22} className="text-blue-700" /> Bitácora General</h1>
        <p className="text-sm text-gray-400 mt-0.5">Registro de toda la actividad de la flota</p>
      </div>

      {/* Buscador */}
      <div className="relative mb-4 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por placa, cliente, descripción…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5 flex-wrap">
        {TABS.map(([k, label]) => {
          const count = k === "todos" ? items.length : items.filter(i => i.tipo === k).length;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {label} <span className="text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <History size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin actividad registrada</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-3">
              {filtered.map((it, i) => {
                const cfg = CFG[it.tipo] ?? CFG.gasto;
                const Icon = cfg.icon;
                return (
                  <Link key={i} href={it.link} className="flex items-start gap-4 relative group">
                    <div className={`z-10 mt-0.5 rounded-full flex items-center justify-center w-8 h-8 shrink-0 ${cfg.color}`}><Icon size={15} /></div>
                    <div className="flex-1 pb-1 group-hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <p className="text-sm font-semibold text-gray-900">{it.titulo}</p>
                        <span className="text-xs text-gray-400">{format(new Date(it.fecha), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{it.detalle}</p>
                      {it.monto != null && <p className="text-xs font-semibold text-gray-700 mt-0.5">S/ {it.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
