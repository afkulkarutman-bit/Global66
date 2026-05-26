"use client";

import Link from "next/link";

const cards = [
  {
    title: "Formulario onboarding",
    description: "Link para que nuevos ingresos completen sus datos y documentos.",
    href: "/onboarding",
    action: "Abrir formulario",
    external: true,
  },
  {
    title: "Status nuevos ingresos",
    description: "Seguimiento de personas por ingresar, documentación y estado de preparación.",
    href: "/status-ingresos",
    action: "Ver status",
    external: false,
  },
  {
    title: "Licencias médicas",
    description: "Módulo para gestión y revisión de licencias médicas.",
    href: "/licencias-medicas",
    action: "Abrir módulo",
    external: false,
  },
];

export default function FormulariosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 8px rgba(59,62,219,0.25)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} />
            </Link>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>BOOK</span>
            <span style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 13 }}>Formularios</span>
          </div>
          <Link href="/" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Empleados
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "var(--g66-text)" }}>Formularios</h1>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {cards.map(card => (
            <Link
              key={card.href}
              href={card.href}
              target={card.external ? "_blank" : undefined}
              rel={card.external ? "noreferrer" : undefined}
              className="g66-card"
              style={{
                padding: 20,
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                minHeight: 150,
                borderColor: "var(--g66-border)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, color: "var(--g66-text)", marginBottom: 8 }}>{card.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--g66-muted)", flex: 1 }}>{card.description}</div>
              <div style={{ marginTop: 18, color: "var(--g66-blue)", fontSize: 13, fontWeight: 900 }}>{card.action}</div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
