"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--g66-bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 16px" }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32, gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Global66" style={{ height: 52, borderRadius: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--g66-text)" }}>Global66 People</div>
          <div style={{ fontSize: 14, color: "var(--g66-muted)" }}>Ingresá con tu cuenta</div>
        </div>

        {/* Card */}
        <div className="g66-card" style={{ padding: "32px 28px" }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
                Correo electrónico
              </label>
              <input
                className="g66-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@global66.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                className="g66-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "var(--g66-red)", background: "var(--g66-red-bg)", border: "1px solid var(--g66-red-border)", borderRadius: 8, padding: "10px 14px" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="g66-btn"
              style={{ width: "100%", padding: "12px", fontSize: 15, marginTop: 4 }}
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
