"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: number;
  dni: string;
  nombre: string;
  email_global?: string | null;
  email_personal?: string | null;
  cargo?: string | null;
  area?: string | null;
  centro_costo?: string | null;
  pais?: string | null;
  fecha_ingreso?: string | null;
};

function parseDate(value?: string | null) {
  if (!value || value === "NA") return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsAndHalf(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  next.setDate(next.getDate() + 15);
  return next;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isB2B(employee: Employee) {
  const text = `${employee.cargo ?? ""} ${employee.area ?? ""} ${employee.centro_costo ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return text.includes("b2b");
}

export default function CalculadoraFechasPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/employees?activo=1&limit=1000")
      .then(res => res.json())
      .then(data => setEmployees(data.employees ?? []))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .map(employee => {
        const ingreso = parseDate(employee.fecha_ingreso);
        const primerFeedback = ingreso ? addDays(ingreso, 90) : null;
        const b2b = isB2B(employee);
        const segundoFeedback = primerFeedback ? addMonthsAndHalf(primerFeedback, b2b ? 3 : 2) : null;
        const tercerFeedback = ingreso && b2b ? addMonthsAndHalf(ingreso, 5) : null;
        return { employee, ingreso, primerFeedback, segundoFeedback, tercerFeedback, b2b };
      })
      .filter(row => {
        if (!q) return true;
        return [
          row.employee.nombre,
          row.employee.dni,
          row.employee.email_global,
          row.employee.email_personal,
          row.employee.cargo,
          row.employee.area,
          row.employee.pais,
        ].some(value => String(value ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const aTime = a.primerFeedback?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.primerFeedback?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime || a.employee.nombre.localeCompare(b.employee.nombre, "es");
      });
  }, [employees, search]);

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
            <span style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 13 }}>Calculadora fechas</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              aria-label="Volver atrás"
              title="Volver atrás"
              style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, fontWeight: 900, cursor: "pointer" }}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => window.history.forward()}
              aria-label="Ir adelante"
              title="Ir adelante"
              style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, fontWeight: 900, cursor: "pointer" }}
            >
              →
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <section className="g66-card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, color: "var(--g66-text)", fontSize: 26, fontWeight: 900 }}>Calculadora fechas</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por nombre, mail, DNI, cargo, área, país..."
                style={{ width: 360, maxWidth: "100%", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none" }}
              />
              <Link
                href="/calculadora-fechas/reporte"
                style={{ background: "var(--g66-blue)", color: "#fff", border: "1px solid var(--g66-blue)", borderRadius: 8, padding: "9px 14px", fontWeight: 900, textDecoration: "none" }}
              >
                Reporte
              </Link>
            </div>
          </div>
        </section>

        <section className="g66-card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "var(--g66-muted)" }}>
                  {["Nombre", "País", "Área", "Cargo", "F. ingreso", "1° feedback", "Área", "2° feedback", "3° feedback"].map(header => (
                    <th key={header} style={{ padding: "11px 12px", textAlign: "left", borderBottom: "1px solid var(--g66-border)", fontWeight: 900, whiteSpace: "nowrap" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 18, color: "var(--g66-muted)", textAlign: "center" }}>Cargando...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 18, color: "var(--g66-muted)", textAlign: "center" }}>Sin resultados</td>
                  </tr>
                ) : rows.map(row => (
                  <tr key={row.employee.id} style={{ borderBottom: "1px solid var(--g66-border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "var(--g66-text)", minWidth: 220 }}>
                      <div>{row.employee.nombre}</div>
                      <div style={{ color: "var(--g66-muted)", fontSize: 11, fontWeight: 600 }}>{row.employee.dni}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{row.employee.pais ?? "-"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{row.employee.area ?? "-"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--g66-muted)", minWidth: 220 }}>{row.employee.cargo ?? "-"}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDate(row.ingreso)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 800, color: "var(--g66-blue)" }}>{formatDate(row.primerFeedback)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{ background: row.b2b ? "#eef2ff" : "#f1f5f9", color: row.b2b ? "var(--g66-blue)" : "var(--g66-muted)", borderRadius: 999, padding: "5px 9px", fontWeight: 900, fontSize: 11 }}>
                        {row.b2b ? "B2B" : "Otros"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 800, color: "var(--g66-text)" }}>{formatDate(row.segundoFeedback)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 800, color: row.b2b ? "var(--g66-text)" : "var(--g66-muted)" }}>{formatDate(row.tercerFeedback)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
