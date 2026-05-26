"use client";

import Link from "next/link";
import { useState } from "react";

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
  {
    title: "Formulario feedback",
    description: "Formulario interno de feedback.",
    href: "/formulario-feedback",
    action: "Abrir formulario",
    external: false,
  },
];

export default function FormulariosPage() {
  const [copiedHref, setCopiedHref] = useState<string | null>(null);

  async function copyLink(href: string) {
    const url = `${window.location.origin}${href}`;
    await navigator.clipboard.writeText(url);
    setCopiedHref(href);
    window.setTimeout(() => setCopiedHref(current => current === href ? null : current), 1400);
  }

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
            <div
              key={card.href}
              className="g66-card"
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                minHeight: 150,
                borderColor: "var(--g66-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--g66-text)" }}>{card.title}</div>
                <button
                  type="button"
                  onClick={() => copyLink(card.href)}
                  title="Copiar link"
                  aria-label={`Copiar link de ${card.title}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid var(--g66-border)",
                    background: copiedHref === card.href ? "#dcfce7" : "#fff",
                    color: copiedHref === card.href ? "#166534" : "var(--g66-blue)",
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 900,
                    lineHeight: "30px",
                    flex: "0 0 auto",
                  }}
                >
                  {copiedHref === card.href ? "✓" : "⧉"}
                </button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--g66-muted)", flex: 1 }}>{card.description}</div>
              <Link
                href={card.href}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noreferrer" : undefined}
                style={{ marginTop: 18, color: "var(--g66-blue)", fontSize: 13, fontWeight: 900, textDecoration: "none" }}
              >
                {card.action}
              </Link>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
