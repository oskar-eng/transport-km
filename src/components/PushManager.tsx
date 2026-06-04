"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushManager() {
  const [status, setStatus] = useState<"unsupported" | "denied" | "subscribed" | "idle">("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setStatus("subscribed");
      else if (Notification.permission === "denied") setStatus("denied");
    });
  }, []);

  async function subscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); setLoading(false); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus("subscribed");
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus("idle");
    setLoading(false);
  }

  if (status === "unsupported") return null;

  return (
    <div className="px-3 py-2 border-t border-blue-700 mt-1">
      {status === "subscribed" ? (
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-blue-200 hover:text-white w-full"
        >
          <Bell size={13} className="text-green-400" />
          Notificaciones activas
        </button>
      ) : status === "denied" ? (
        <p className="flex items-center gap-2 text-xs text-red-300">
          <BellOff size={13} /> Notificaciones bloqueadas
        </p>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-blue-200 hover:text-white w-full"
        >
          <Bell size={13} />
          {loading ? "Activando..." : "Activar notificaciones"}
        </button>
      )}
    </div>
  );
}
