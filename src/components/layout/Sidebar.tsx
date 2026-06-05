"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Package, Truck, Users, BarChart3, LogOut, Menu, X,
  MapPin, FileText, Fuel, Wrench, Circle, DollarSign, ChevronLeft, ChevronRight, UserRound, Receipt,
} from "lucide-react";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/events";
import PushManager from "@/components/PushManager";

const navItems = [
  { href: "/dashboard",   label: "Dashboard",     icon: LayoutDashboard, roles: ["all"] },
  { href: "/orders",      label: "Órdenes",       icon: Package,         roles: ["all"] },
  { href: "/tracking",    label: "Seguimiento",   icon: MapPin,          roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"] },
  { href: "/units",       label: "Unidades",      icon: Truck,           roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/documents",   label: "Documentos",    icon: FileText,        roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/fuel",        label: "Combustible",   icon: Fuel,            roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA", "CONDUCTOR"] },
  { href: "/maintenance", label: "Mantenimiento", icon: Wrench,          roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/tires",       label: "Neumáticos",    icon: Circle,          roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/costs",       label: "Costos",        icon: DollarSign,      roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/gastos",      label: "Gastos",        icon: Receipt,         roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA", "CONDUCTOR"] },
  { href: "/drivers",     label: "Conductores",   icon: UserRound,       roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
  { href: "/users",       label: "Usuarios",      icon: Users,           roles: ["ADMINISTRADOR"] },
  { href: "/reports",     label: "Reportes",      icon: BarChart3,       roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"] },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = (session?.user as { role: string })?.role ?? "";

  const visible = navItems.filter(
    (item) => item.roles[0] === "all" || item.roles.includes(role)
  );

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center border-b border-blue-700 transition-all duration-300 ${collapsed && !isMobile ? "p-3 justify-center" : "p-4 justify-between"}`}>
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="text-white shrink-0" size={22} />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">Yacz Cargo</p>
              <p className="text-blue-200 text-xs truncate">Gestión de Flotas</p>
            </div>
          </div>
        )}
        {collapsed && !isMobile && (
          <Truck className="text-white" size={22} />
        )}
        {/* Desktop collapse toggle */}
        {!isMobile && (
          <button
            onClick={onToggle}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-blue-200 hover:bg-blue-700 transition-colors shrink-0"
            title={collapsed ? "Expandir menú" : "Minimizar menú"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed && !isMobile ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm transition-colors group relative
                ${collapsed && !isMobile ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}
                ${active
                  ? "bg-white text-blue-700 font-semibold"
                  : "text-blue-100 hover:bg-blue-700"
                }`}
            >
              <Icon size={18} className="shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
              {/* Tooltip when collapsed */}
              {collapsed && !isMobile && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-blue-700 ${collapsed && !isMobile ? "p-2" : "p-3"}`}>
        {(!collapsed || isMobile) && (
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-blue-200 text-xs">{ROLE_LABELS[role] ?? role}</p>
          </div>
        )}
        {role === "CONDUCTOR" && (!collapsed || isMobile) && <PushManager />}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed && !isMobile ? "Cerrar Sesión" : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm text-blue-100 hover:bg-blue-700 w-full transition-colors mt-1 group relative
            ${collapsed && !isMobile ? "px-0 py-2 justify-center" : "px-3 py-2"}`}
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || isMobile) && <span>Cerrar Sesión</span>}
          {collapsed && !isMobile && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Cerrar Sesión
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-800 text-white p-2 rounded-lg shadow"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 h-full bg-blue-800 z-40 transition-all duration-300 overflow-hidden ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <NavContent />
      </aside>

      {/* Mobile sidebar (always full width) */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-60 bg-blue-800 z-40 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <NavContent isMobile />
      </aside>
    </>
  );
}
