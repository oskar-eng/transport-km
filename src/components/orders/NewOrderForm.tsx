"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface Unit { id: string; plate: string; model: string; activeOrder?: { id: string; orderNumber: string } | null }
interface Driver { id: string; name: string; activeOrder?: { id: string; orderNumber: string } | null }

export default function NewOrderForm({ units, drivers }: { units: Unit[]; drivers: Driver[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    orderNumber: "",
    type: "IMPORTACION",
    clientName: "",
    origin: "",
    destination: "",
    containerNumber: "",
    driverId: "",
    unitId: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const selectedUnit = units.find((u) => u.id === form.unitId);
  const selectedDriver = drivers.find((d) => d.id === form.driverId);
  const unitWarning = selectedUnit?.activeOrder ?? null;
  const driverWarning = selectedDriver?.activeOrder ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/orders");
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al crear la orden");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 max-w-2xl space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">N° de Orden *</label>
          <input
            value={form.orderNumber}
            onChange={(e) => set("orderNumber", e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ORD-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Servicio *</label>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="IMPORTACION">Importación</option>
            <option value="EXPORTACION">Exportación</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
          <input
            value={form.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre del cliente"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
          <input
            value={form.origin}
            onChange={(e) => set("origin", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Puerto / Almacén origen"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
          <input
            value={form.destination}
            onChange={(e) => set("destination", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Dirección de entrega"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">N° Contenedor</label>
          <input
            value={form.containerNumber}
            onChange={(e) => set("containerNumber", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="TCKU1234567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
          <select
            value={form.unitId}
            onChange={(e) => set("unitId", e.target.value)}
            required
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              unitWarning ? "border-orange-400 bg-orange-50" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar unidad</option>
            {units.map((u) => (
              <option key={u.id} value={u.id} disabled={!!u.activeOrder}>
                {u.plate} — {u.model}{u.activeOrder ? " (En servicio)" : ""}
              </option>
            ))}
          </select>
          {unitWarning && (
            <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                Unidad ocupada — orden <strong>{unitWarning.orderNumber}</strong> en curso.
                Debe finalizarse antes de asignar un nuevo servicio.{" "}
                <button
                  type="button"
                  onClick={() => router.push(`/orders/${unitWarning.id}`)}
                  className="underline font-semibold hover:text-red-900"
                >
                  Ver orden →
                </button>
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conductor *</label>
          <select
            value={form.driverId}
            onChange={(e) => set("driverId", e.target.value)}
            required
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              driverWarning ? "border-orange-400 bg-orange-50" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar conductor</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} disabled={!!d.activeOrder}>
                {d.name}{d.activeOrder ? " (En ruta)" : ""}
              </option>
            ))}
          </select>
          {driverWarning && (
            <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                Conductor en ruta — orden <strong>{driverWarning.orderNumber}</strong> activa.
                Debe finalizar antes de poder asignarle un nuevo servicio.{" "}
                <button
                  type="button"
                  onClick={() => router.push(`/orders/${driverWarning.id}`)}
                  className="underline font-semibold hover:text-red-900"
                >
                  Ver orden →
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-800 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? "Guardando..." : "Crear Orden"}
        </button>
      </div>
    </form>
  );
}
