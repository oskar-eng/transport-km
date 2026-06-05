"use client";
import { useState } from "react";
import { Plus, Pencil, UserCheck, UserX, Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/events";

interface User {
  id: string; name: string; email: string; role: string; active: boolean; createdAt: string;
}

const ROLES = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR", "ANALISTA", "CONDUCTOR"];
const ROLE_BADGE: Record<string, string> = {
  ADMINISTRADOR: "bg-red-100 text-red-800",
  JEFE_TRANSPORTE: "bg-purple-100 text-purple-800",
  SUPERVISOR: "bg-blue-100 text-blue-800",
  ANALISTA: "bg-yellow-100 text-yellow-800",
  CONDUCTOR: "bg-green-100 text-green-800",
};

export default function UsersClient({ users: initial }: { users: User[] }) {
  const [users, setUsers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CONDUCTOR", active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "CONDUCTOR", active: true });
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, active: u.active });
    setShowForm(true);
  }

  async function handleDelete(u: User) {
    if (!confirm(`¿Eliminar al usuario "${u.name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } else {
      const data = await res.json();
      alert(data.error ?? "No se pudo eliminar el usuario");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const method = editing ? "PATCH" : "POST";
    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const body = editing
      ? { name: form.name, role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) }
      : form;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      const saved = await res.json();
      if (editing) {
        setUsers((prev) => prev.map((u) => (u.id === saved.id ? { ...u, ...saved } : u)));
      } else {
        setUsers((prev) => [...prev, { ...saved, createdAt: new Date().toISOString() }]);
      }
      setShowForm(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">{editing ? "Editar Usuario" : "Nuevo Usuario"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Nombre completo *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!editing && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  {editing ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={!editing}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Rol *</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
                  Usuario activo
                </label>
              )}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 bg-blue-800 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.active ? (
                    <span className="flex items-center gap-1 text-green-700 text-xs"><UserCheck size={13} /> Activo</span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500 text-xs"><UserX size={13} /> Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
