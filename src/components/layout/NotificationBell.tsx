"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Clock, Truck, UserRound, CheckCircle2 } from "lucide-react";

interface Alert {
  id: string; kind: "driver" | "unit"; titulo: string; doc: string;
  expiryDate: string; days: number; severity: "vencido" | "por_vencer"; link: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ total: number; vencidos: number; porVencer: number; alerts: Alert[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // refresca cada 5 min
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const total = data?.total ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="relative bg-white shadow-sm border border-gray-200 rounded-full p-2.5 hover:bg-gray-50 transition-colors">
        <Bell size={18} className="text-gray-600" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Notificaciones</h3>
            {data && total > 0 && (
              <div className="flex gap-2 text-xs">
                {data.vencidos > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{data.vencidos} vencidos</span>}
                {data.porVencer > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{data.porVencer} por vencer</span>}
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!data ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</p>
            ) : total === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm text-gray-500">¡Todo al día!</p>
                <p className="text-xs text-gray-400 mt-0.5">No hay documentos por vencer</p>
              </div>
            ) : (
              data.alerts.map(a => (
                <Link key={`${a.kind}-${a.id}`} href={a.link} onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                  <div className={`p-1.5 rounded-lg shrink-0 ${a.severity === "vencido" ? "bg-red-100" : "bg-amber-100"}`}>
                    {a.kind === "driver"
                      ? <UserRound size={15} className={a.severity === "vencido" ? "text-red-600" : "text-amber-600"} />
                      : <Truck size={15} className={a.severity === "vencido" ? "text-red-600" : "text-amber-600"} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.titulo}</p>
                    <p className="text-xs text-gray-500 truncate">{a.doc}</p>
                    <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${a.severity === "vencido" ? "text-red-600" : "text-amber-600"}`}>
                      {a.severity === "vencido"
                        ? <><AlertTriangle size={11} /> Vencido hace {Math.abs(a.days)} día{Math.abs(a.days) !== 1 ? "s" : ""}</>
                        : <><Clock size={11} /> Vence en {a.days} día{a.days !== 1 ? "s" : ""}</>}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
