"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "model"; text: string };
type GeminiMsg = { role: "user" | "model"; parts: { text: string }[] };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setLoading(true);

    const history: GeminiMsg[] = newMessages.slice(0, -1).map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "model", text: data.text || data.error || "Sin respuesta" }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Error al conectar con el asistente." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Asistente Global66"
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 500,
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--g66-blue)", border: "none",
          boxShadow: "0 4px 16px rgba(59,62,219,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="18" height="13" rx="3" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
            <circle cx="9" cy="12" r="1.2" fill="white"/>
            <circle cx="12" cy="12" r="1.2" fill="white"/>
            <circle cx="15" cy="12" r="1.2" fill="white"/>
            <path d="M8 6V4.5a1.5 1.5 0 013 0V6" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M13 6V4.5a1.5 1.5 0 013 0V6" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 28, zIndex: 499,
          width: 380, height: 520,
          background: "#fff", borderRadius: 16,
          border: "1px solid var(--g66-border)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            background: "var(--g66-blue)", padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="13" rx="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.5"/>
                <circle cx="9" cy="12" r="1.2" fill="white"/>
                <circle cx="12" cy="12" r="1.2" fill="white"/>
                <circle cx="15" cy="12" r="1.2" fill="white"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Asistente People</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Preguntame sobre empleados, sueldos, datos</div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{
                  background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.6)",
                  borderRadius: 7, padding: "5px 10px", color: "#fca5a5",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                Borrar conversación
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--g66-muted)", fontSize: 13, marginTop: 40, lineHeight: 1.6 }}>
                Hola, soy el asistente de Global66 People.<br />
                Preguntame sobre empleados, sueldos, áreas o datos faltantes.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "9px 13px", borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  background: m.role === "user" ? "var(--g66-blue)" : "#f1f3f9",
                  color: m.role === "user" ? "#fff" : "var(--g66-text)",
                  fontSize: 13, lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "#f1f3f9", borderRadius: "14px 14px 14px 2px", padding: "10px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%", background: "var(--g66-muted)",
                      animation: "pulse 1.2s infinite", animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--g66-border)", display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escribí tu pregunta..."
              disabled={loading}
              style={{
                flex: 1, border: "1px solid var(--g66-border)", borderRadius: 10,
                padding: "9px 13px", fontSize: 13, outline: "none",
                background: loading ? "#f9fafb" : "#fff",
              }}
              onFocus={e => e.target.style.borderColor = "var(--g66-blue)"}
              onBlur={e => e.target.style.borderColor = "var(--g66-border)"}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "var(--g66-border)" : "var(--g66-blue)",
                border: "none", borderRadius: 10, width: 38, height: 38,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 10L17 10M17 10L11 4M17 10L11 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
