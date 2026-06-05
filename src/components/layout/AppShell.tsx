"use client";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        {/* Campana de notificaciones — esquina superior derecha */}
        <div className="fixed top-3 right-4 z-40">
          <NotificationBell />
        </div>
        <div className="p-4 lg:p-6 pt-16 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
