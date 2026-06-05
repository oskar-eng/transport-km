"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Package, Truck, Users, BarChart3, LogOut, Menu, X,
  MapPin, FileText, Fuel, Wrench, Circle, DollarSign, ChevronLeft, ChevronRight, UserRound, Receipt, AlertOctagon, History, Container, ClipboardList,
  ChevronDown, Database, Settings, Wallet, ClipboardCheck, CalendarClock, Boxes, ShoppingCart, FileBarChart, AlertTriangle, ScrollText, Layers,
} from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/events";
import PushManager from "@/components/PushManager";
import Logo from "./Logo";

const ALL = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA"];

const navGroups: { title: string | null; key: string; icon: typeof Package | null; items: { href: string; label: string; icon: typeof Package; roles: string[] }[] }[] = [
  { title: null, key: "", icon: null, items: [
    { href: "/dashboard",   label: "Dashboard",     icon: LayoutDashboard, roles: ["all"] },
    { href: "/orders",      label: "Órdenes",       icon: Package,         roles: ["all"] },
    { href: "/tracking",    label: "Seguimiento",   icon: MapPin,          roles: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"] },
  ]},
  { title: "Actualización de Datos", key: "datos", icon: Database, items: [
    { href: "/units",       label: "Vehículos",     icon: Truck,           roles: ALL },
    { href: "/drivers",     label: "Conductores",   icon: UserRound,       roles: ALL },
    { href: "/carretas",    label: "Carretas",      icon: Container,       roles: ALL },
    { href: "/solicitudes", label: "Solicitudes",   icon: ClipboardList,   roles: ALL },
  ]},
  { title: "Operación", key: "operacion", icon: Settings, items: [
    { href: "/documents",   label: "Documentos",    icon: FileText,        roles: ALL },
    { href: "/fuel",        label: "Combustible",   icon: Fuel,            roles: [...ALL, "CONDUCTOR"] },
    { href: "/maintenance", label: "Mantenimiento", icon: Wrench,          roles: ALL },
    { href: "/tires",       label: "Neumáticos",    icon: Circle,          roles: ALL },
  ]},
  { title: "Mantenimiento de Flota", key: "mantflota", icon: Wrench, items: [
    { href: "/almacen",                          label: "Almacén de Repuestos",   icon: Boxes,         roles: ALL },
    { href: "/proximamente?m=Programación Preventiva",  label: "Programación Preventiva", icon: CalendarClock, roles: ALL },
    { href: "/proximamente?m=Plantillas de Mantenimiento", label: "Plantillas",          icon: Layers,        roles: ALL },
    { href: "/incidencias",                                label: "Incidencias",         icon: AlertTriangle, roles: [...ALL, "CONDUCTOR"] },
    { href: "/proximamente?m=Órdenes de Trabajo",          label: "Órdenes de Trabajo",  icon: ClipboardCheck, roles: ALL },
    { href: "/solicitud-materiales",                       label: "Solicitud Materiales", icon: ScrollText,   roles: ALL },
    { href: "/proximamente?m=Compras / Requerimientos",    label: "Compras",             icon: ShoppingCart,  roles: ALL },
    { href: "/proximamente?m=Costos de Mantenimiento",     label: "Costos Mantenimiento", icon: DollarSign,   roles: ALL },
    { href: "/proximamente?m=Reportes de Mantenimiento",   label: "Reportes Mant.",      icon: FileBarChart,  roles: ALL },
  ]},
  { title: "Finanzas", key: "finanzas", icon: Wallet, items: [
    { href: "/costs",       label: "Costos",        icon: DollarSign,      roles: ALL },
    { href: "/gastos",      label: "Gastos",        icon: Receipt,         roles: [...ALL, "CONDUCTOR"] },
    { href: "/sanciones",   label: "Sanciones",     icon: AlertOctagon,    roles: ALL },
  ]},
  { title: null, key: "", icon: null, items: [
    { href: "/bitacora",    label: "Bitácora",      icon: History,         roles: ALL },
    { href: "/reports",     label: "Reportes",      icon: BarChart3,       roles: ALL },
    { href: "/users",       label: "Usuarios",      icon: Users,           roles: ["ADMINISTRADOR"] },
  ]},
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

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles[0] === "all" || i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Expandir automáticamente el grupo que contiene la ruta activa
  useEffect(() => {
    const g = navGroups.find((gr) => gr.title && gr.items.some((i) => pathname.startsWith(i.href)));
    if (g) setExpanded((prev) => ({ ...prev, [g.key]: true }));
  }, [pathname]);
  const toggleGroup = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center border-b border-blue-700 transition-all duration-300 ${collapsed && !isMobile ? "p-3 justify-center" : "p-4 justify-between"}`}>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <Logo variant="onDark" size="sm" />
            <p className="text-blue-200 text-[11px] mt-1 ml-6 truncate">Gestión de Flotas</p>
          </div>
        )}
        {collapsed && !isMobile && (
          <div className="flex flex-col gap-[2px]">
            <span className="block w-3 h-[2px] rounded-full bg-red-500" />
            <span className="block w-2.5 h-[2px] rounded-full bg-red-500" />
            <span className="block w-3 h-[2px] rounded-full bg-red-500" />
          </div>
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
        {visibleGroups.map((group, gi) => {
          const iconMini = collapsed && !isMobile;

          // ── Grupo plano (sin título) ──
          if (!group.title) {
            return (
              <div key={gi} className={gi > 0 ? "mt-1" : ""}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      title={iconMini ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg text-sm transition-colors group relative
                        ${iconMini ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}
                        ${active ? "bg-white text-blue-700 font-semibold" : "text-blue-100 hover:bg-blue-700"}`}>
                      <Icon size={18} className="shrink-0" />
                      {!iconMini && <span className="truncate">{item.label}</span>}
                      {iconMini && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          }

          const ParentIcon = group.icon!;
          const groupActive = group.items.some((i) => pathname.startsWith(i.href));
          const isExpanded = !!expanded[group.key];

          // ── Sidebar colapsado: ícono + flyout al pasar el mouse ──
          if (iconMini) {
            return (
              <div key={gi} className="relative group mt-1">
                <div className={`flex items-center justify-center px-0 py-2.5 rounded-lg cursor-default ${groupActive ? "bg-blue-700 text-white" : "text-blue-100 group-hover:bg-blue-700"}`}>
                  <ParentIcon size={18} />
                </div>
                <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50">
                  <div className="bg-blue-800 rounded-lg shadow-2xl py-1.5 min-w-[190px] border border-blue-700">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">{group.title}</p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm ${active ? "bg-white text-blue-700 font-semibold" : "text-blue-100 hover:bg-blue-700"}`}>
                          <Icon size={15} className="shrink-0" /> <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // ── Sidebar expandido: acordeón desplegable ──
          return (
            <div key={gi} className="mt-1">
              <button onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${groupActive ? "text-white font-semibold bg-blue-700/40" : "text-blue-100 hover:bg-blue-700"}`}>
                <ParentIcon size={18} className="shrink-0" />
                <span className="flex-1 text-left truncate">{group.title}</span>
                <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-blue-700/60 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg text-sm px-3 py-2 transition-colors ${active ? "bg-white text-blue-700 font-semibold" : "text-blue-100 hover:bg-blue-700"}`}>
                        <Icon size={16} className="shrink-0" /> <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
