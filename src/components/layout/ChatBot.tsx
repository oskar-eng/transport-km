"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

const SUGERENCIAS = [
  "¿Qué documentos le faltan a cada conductor?",
  "¿Qué placas tienen documentos vencidos o por vencer?",
  "¿Qué unidades están deshabilitadas y por qué?",
  "¿Qué unidades están en mantenimiento?",
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: res.ok ? data.reply : (data.error ?? "Error") }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "No pude conectarme. Intenta de nuevo." }]);
    }
    setLoading(false);
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105">
          <Bot size={20} /> <span className="font-semibold text-sm hidden sm:inline">Pregúntale a Yacz</span>
        </button>
      )}

      {/* Panel del chat */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 h-[70vh] sm:h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full p-1.5"><Bot size={18} /></div>
              <div>
                <p className="font-bold text-sm leading-tight">Yacz</p>
                <p className="text-blue-200 text-xs">Tu asistente de la flota 💙</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-blue-200 hover:text-white"><X size={20} /></button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="inline-flex bg-blue-100 rounded-full p-3 mb-2"><Sparkles size={22} className="text-blue-700" /></div>
                <p className="text-sm font-semibold text-gray-700">¡Hola! Soy Yacz 😊</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">Estoy encantada de ayudarte. Pregúntame lo que quieras sobre tu flota 💙</p>
                <div className="space-y-2">
                  {SUGERENCIAS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="block w-full text-left text-xs bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-700 rounded-lg px-3 py-2 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-800 text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); send(input); }}
            className="border-t border-gray-100 p-3 flex items-center gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} disabled={loading}
              placeholder="Escribe tu pregunta…"
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={loading || !input.trim()}
              className="bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full p-2.5 transition-colors">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
