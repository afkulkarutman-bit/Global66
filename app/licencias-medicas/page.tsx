"use client";

import Link from "next/link";

export default function LicenciasMedicasPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "14px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} />
            </Link>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.25)" }} />
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>Licencias Médicas</h1>
          </div>
          <Link href="/" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            Empleados
          </Link>
        </div>
      </header>
    </div>
  );
}
