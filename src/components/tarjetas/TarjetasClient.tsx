"use client";
import { useState, useMemo } from "react";
import { Plus, X, CreditCard, Pencil, Trash2, Search, Download, Loader2, CalendarDays } from "lucide-react";

interface Unit   { id: string; plate: string; model: string }
interface Driver { id: string; name: string; dni: string }
interface MonthConsumo { label: string; consumido: number; limite: number }
interface Card {
  id: string; cardNumber: string | null; provider: string;
  holderName: string; holderDni: string; driverId: string | null;
  unitId: string | null; unit: { plate: string; model: string } | null;
  monthlyLimit: number; active: boolean; consumido: number; disponible: number;
  history?: MonthConsumo[];
}

const money = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EMPTY = { cardNumber: "", holderName: "", holderDni: "", driverId: "", unitId: "", monthlyLimit: "", active: true };

const MES = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });

export default function TarjetasClient({
  cards: initial, units, drivers, canAdmin,
}: { cards: Card[]; units: Unit[]; drivers: Driver[]; userRole: string; canAdmin: boolean }) {
  const [cards, setCards] = useState<Card[]>(initial);
  const [show, setShow]   = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [form, setForm]   = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [historyCard, setHistoryCard] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/[-\s]/g, "");
    if (!q) return cards;
    return cards.filter(c => [c.holderName, c.holderDni, c.unit?.plate ?? "", c.cardNumber ?? ""].join(" ").toLowerCase().replace(/[-\s]/g, "").includes(q));
  }, [cards, search]);

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = filtered.map(c => ({
        Conductor: c.holderName, DNI: c.holderDni, "N° tarjeta": c.cardNumber ?? "",
        Unidad: c.unit?.plate ?? "", Proveedor: c.provider,
        "Saldo mensual": c.monthlyLimit, "Consumido (mes)": c.consumido, "Disponible": c.disponible,
        Estado: c.active ? "Activa" : "Inactiva",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tarjetas");
      XLSX.writeFile(wb, `tarjetas_combustible_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExporting(false); }
  }

  const totalLimite = cards.reduce((s, c) => s + c.monthlyLimit, 0);
  const totalConsumido = cards.reduce((s, c) => s + c.consumido, 0);
  const totalDisponible = cards.reduce((s, c) => s + c.disponible, 0);

  function openNew() { setEditing(null); setForm({ ...EMPTY }); setError(""); setShow(true); }
  function openEdit(c: Card) {
    setEditing(c);
    setForm({ cardNumber: c.cardNumber ?? "", holderName: c.holderName, holderDni: c.holderDni, driverId: c.driverId ?? "", unitId: c.unitId ?? "", monthlyLimit: String(c.monthlyLimit), active: c.active });
    setError(""); setShow(true);
  }

  function pickDriver(driverId: string) {
    const d = drivers.find(x => x.id === driverId);
    setForm(f => ({ ...f, driverId, holderName: d?.name ?? f.holderName, holderDni: d?.dni || f.holderDni }));
  }

  async function save() {
    if (!form.holderName || !form.holderDni || !form.monthlyLimit) { setError("Conductor, DNI y saldo mensual son obligatorios"); return; }
    setSaving(true); setError("");
    const method = editing ? "PATCH" : "POST";
    const url = editing ? `/api/fuel-cards/${editing.id}` : "/api/fuel-cards";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      const unit = units.find(u => u.id === saved.unitId);
      const merged: Card = { ...saved, unit: unit ? { plate: unit.plate, model: unit.model } : null, consumido: saved.consumido ?? (editing?.consumido ?? 0), disponible: saved.disponible ?? Math.max(0, saved.monthlyLimit - (editing?.consumido ?? 0)) };
      if (editing) setCards(p => p.map(c => c.id === merged.id ? { ...merged, consumido: c.consumido, disponible: Math.max(0, merged.monthlyLimit - c.consumido) } : c));
      else setCards(p => [...p, merged]);
      setShow(false);
    } else { const d = await res.json(); setError(d.error ?? "Error"); }
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    await fetch(`/api/fuel-cards/${id}`, { method: "DELETE" });
    setCards(p => p.filter(c => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarjetas de Combustible</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">Saldo Petrothor por conductor — {MES}</p>
        </div>
        {canAdmin && (
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Nueva Tarjeta
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Saldo asignado (mes)", value: money(totalLimite), color: "bg-blue-500" },
          { label: "Consumido", value: money(totalConsumido), color: "bg-orange-500" },
          { label: "Disponible", value: money(totalDisponible), color: "bg-emerald-500" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.color} p-2.5 rounded-xl shrink-0`}><CreditCard size={18} className="text-white" /></div>
            <div><p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          </div>
        ))}
      </div>

      {/* Buscador + Exportar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por conductor, DNI o placa…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-auto">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportar Excel
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay tarjetas registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(c => {
            const pct = c.monthlyLimit > 0 ? Math.min(100, (c.disponible / c.monthlyLimit) * 100) : 0;
            const low = pct <= 15;
            return (
              <div key={c.id} className={`bg-white rounded-2xl shadow-sm p-5 border ${c.active ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-2.5 rounded-xl"><CreditCard size={20} className="text-white" /></div>
                    <div>
                      <p className="font-bold text-gray-900">{c.holderName}</p>
                      <p className="text-xs text-gray-400">DNI {c.holderDni}{c.cardNumber ? ` · ${c.cardNumber}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.history && c.history.length > 0 && (
                      <button onClick={() => setHistoryCard(c)} title="Historial mensual" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><CalendarDays size={14} /></button>
                    )}
                    {canAdmin && (
                      <>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={13} /></button>
                        <button onClick={() => del(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Unidad: <strong className="text-gray-700 font-mono">{c.unit?.plate ?? "—"}</strong></span>
                  <span>{c.provider}</span>
                </div>

                {/* Barra de saldo */}
                <div className="mt-2">
                  <div className="flex items-end justify-between mb-1">
                    <p className={`text-2xl font-extrabold ${low ? "text-red-600" : "text-emerald-600"}`}>{money(c.disponible)}</p>
                    <p className="text-xs text-gray-400">de {money(c.monthlyLimit)}</p>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Consumido este mes: {money(c.consumido)}</p>
                  {low && <p className="text-[11px] text-red-600 font-medium mt-0.5">⚠️ Saldo bajo</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Editar Tarjeta" : "Nueva Tarjeta"}</h2>
              <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Conductor</label>
                <select value={form.driverId} onChange={e => pickDriver(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Seleccionar conductor —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.dni ? ` (${d.dni})` : ""}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Al elegir un conductor se completan su nombre y DNI. También puedes escribirlos a mano.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Nombre titular *</label>
                  <input value={form.holderName} onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">DNI *</label>
                  <input value={form.holderDni} onChange={e => setForm(f => ({ ...f, holderDni: e.target.value }))} placeholder="Ej: 41885898"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unidad asignada</label>
                  <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Sin asignar —</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.plate} — {u.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">N° de tarjeta</label>
                  <input value={form.cardNumber} onChange={e => setForm(f => ({ ...f, cardNumber: e.target.value }))} placeholder="****0869"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Saldo mensual (S/) *</label>
                  <input type="number" step="0.01" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} placeholder="Ej: 8000"
                    className="w-full border-2 border-blue-400 rounded-lg px-3 py-2 text-base font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-[11px] text-gray-400 mt-1">Se renueva automáticamente el 1° de cada mes.</p>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input id="active" type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="active" className="text-sm text-gray-700">Tarjeta activa</label>
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShow(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial mensual */}
      {historyCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryCard(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Consumo mensual</h2>
                <p className="text-xs text-gray-400">{historyCard.holderName} · {historyCard.unit?.plate ?? "—"}</p>
              </div>
              <button onClick={() => setHistoryCard(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {(historyCard.history ?? []).map((m, i) => {
                const pct = m.limite > 0 ? Math.min(100, (m.consumido / m.limite) * 100) : 0;
                const over = m.consumido > m.limite;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize text-gray-600">{m.label}</span>
                      <span className={`font-semibold ${over ? "text-red-600" : "text-gray-800"}`}>{money(m.consumido)}<span className="text-gray-400 font-normal"> / {money(m.limite)}</span></span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(historyCard.history ?? []).every(m => m.consumido === 0) && (
                <p className="text-sm text-gray-400 text-center py-2">Sin consumo registrado en los últimos 6 meses.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
