"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Truck, UserRound, Fuel, Wrench, CheckCircle2, FileText } from "lucide-react";

interface Alert {
  id: string;
  category: "documento" | "combustible" | "mantenimiento";
  icon: "driver" | "unit" | "fuel" | "wrench";
  titulo: string; doc: string; fecha: string;
  severity: "alta" | "media" | "info"; link: string;
}
interface Data {
  total: number;
  porCategoria: { documento: number; combustible: number; mantenimiento: number };
  alerts: Alert[];
}

const TABS = [
  { key: "todos",         label: "Todos" },
  { key: "documento",     label: "Documentos" },
  { key: "combustible",   label: "Combustible" },
  { key: "mantenimiento", label: "Mantenimiento" },
] as const;

const ICONS = { driver: UserRound, unit: Truck, fuel: Fuel, wrench: Wrench };

function sevColor(s: Alert["severity"]) {
  if (s === "alta")  return { bg: "bg-red-100",   text: "text-red-600",   dot: "bg-red-500" };
  if (s === "media") return { bg: "bg-amber-100", text: "text-amber-600", dot: "bg-amber-500" };
  return                     { bg: "bg-blue-100",  text: "text-blue-600",  dot: "bg-blue-400" };
}

const STORAGE_KEY = "notif-read-ids";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("todos");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try { const res = await fetch("/api/alerts"); if (res.ok) setData(await res.json()); } catch { /* ignore */ }
  }

  // Cargar IDs leídos guardados
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function markAllRead() {
    if (!data) return;
    const ids = new Set(data.alerts.map(a => a.id));
    setReadIds(ids);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
  }

  // Al abrir la campana, marcar todo como leído (el globito desaparece)
  useEffect(() => {
    if (open && data) {
      const id = setTimeout(markAllRead, 800);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const unread = data ? data.alerts.filter(a => !readIds.has(a.id)).length : 0;
  const total = data?.total ?? 0;
  const filtered = data ? (tab === "todos" ? data.alerts : data.alerts.filter(a => a.category === tab)) : [];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="relative bg-white shadow-sm border border-gray-200 rounded-full p-2.5 hover:bg-gray-50 transition-colors">
        <Bell size={18} className="text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-sm">Notificaciones</h3>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Marcar todas como leídas</button>
              )}
            </div>
            {/* Tabs por categoría */}
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
              {TABS.map(t => {
                const count = t.key === "todos" ? total : data?.porCategoria[t.key as keyof Data["porCategoria"]] ?? 0;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors ${tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                    {t.label}{count > 0 && <span className="ml-0.5 text-gray-400">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!data ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</p>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm text-gray-500">¡Sin pendientes!</p>
                <p className="text-xs text-gray-400 mt-0.5">No hay notificaciones en esta categoría</p>
              </div>
            ) : (
              filtered.map(a => {
                const Icon = ICONS[a.icon] ?? FileText;
                const c = sevColor(a.severity);
                const isUnread = !readIds.has(a.id);
                return (
                  <Link key={a.id} href={a.link} onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${isUnread ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${c.bg}`}>
                      <Icon size={15} className={c.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{a.titulo}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{a.doc}</p>
                    </div>
                    {isUnread
                      ? <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${c.dot}`} />
                      : <span className="w-2 h-2 shrink-0 mt-1.5" />}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
