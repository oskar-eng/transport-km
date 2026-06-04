"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Point { date: string; kmPerLiter: number | null; liters: number }

export default function FuelEfficiencyChart({ data, avg }: { data: Point[]; avg: number | null }) {
  const chartData = data
    .filter((d) => d.kmPerLiter != null)
    .map((d) => ({
      fecha: format(new Date(d.date), "dd/MM", { locale: es }),
      "km/Gal": d.kmPerLiter,
      Galones: d.liters,
    }));

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-300 text-sm">
        Se necesitan al menos 2 cargas para calcular rendimiento
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData}>
        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.10)", fontSize: 12 }}
        />
        {avg && <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Prom ${avg}`, fontSize: 10, fill: "#94a3b8" }} />}
        <Line type="monotone" dataKey="km/Gal" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3, fill: "#1d4ed8" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
