"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  fuel: number;
  maintenance: number;
  other: Record<string, number>;
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

const CAT_LABELS: Record<string, string> = {
  PEAJE: "Peajes", SEGURO: "Seguros", LLANTAS: "Llantas",
  CONDUCTOR: "Conductor", ADMINISTRATIVO: "Administrativo", OTRO: "Otros",
};

export default function CostBreakdownChart({ fuel, maintenance, other }: Props) {
  const data = [
    { name: "Combustible",   value: Math.round(fuel) },
    { name: "Mantenimiento", value: Math.round(maintenance) },
    ...Object.entries(other).map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, value: Math.round(v) })),
  ].filter((d) => d.value > 0);

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos de costos</div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          formatter={(v: number) => `S/ ${v.toLocaleString("es-PE")}`}
          contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
