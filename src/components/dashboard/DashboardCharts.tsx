"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface DailyOrder { day: string; total: number }
interface TypeDist   { name: string; value: number }
interface FleetDist  { name: string; value: number; color: string }

interface Props {
  dailyOrders: DailyOrder[];
  typeDist: TypeDist[];
  fleetDist: FleetDist[];
}

const TYPE_COLORS = ["#1d4ed8", "#f59e0b"];

export default function DashboardCharts({ dailyOrders, typeDist, fleetDist }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* Actividad últimos 7 días */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Órdenes — últimos 7 días</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyOrders} barSize={28}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.10)", fontSize: 12 }}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar dataKey="total" name="Órdenes" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Importación vs Exportación */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Tipo de servicio</h3>
        {typeDist.every(d => d.value === 0) ? (
          <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={typeDist} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                dataKey="value" paddingAngle={3}>
                {typeDist.map((_, i) => (
                  <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Estado de flota */}
      <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Estado de la flota</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {fleetDist.map((f) => {
            const total = fleetDist.reduce((a, b) => a + b.value, 0);
            const pct = total > 0 ? Math.round((f.value / total) * 100) : 0;
            return (
              <div key={f.name} className="text-center">
                <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={f.color} strokeWidth="3"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-lg font-bold text-gray-900">{f.value}</span>
                </div>
                <p className="text-xs font-semibold text-gray-700">{f.name}</p>
                <p className="text-xs text-gray-400">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
