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

type FeedbackResponse = {
  id: number;
  created_at: string;
  tipo_feedback: string;
  evaluado_employee_id?: number | null;
  evaluado_email?: string | null;
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

function formatShortDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function isSameMonth(date: Date | null, reference: Date) {
  return !!date && date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function isBetween(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function isB2B(employee: Employee) {
  const text = `${employee.cargo ?? ""} ${employee.area ?? ""} ${employee.centro_costo ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return text.includes("b2b");
}

function primaryEmail(employee: Employee) {
  const globalEmail = String(employee.email_global || "").trim();
  if (globalEmail && globalEmail.toUpperCase() !== "NA") return globalEmail;
  const personalEmail = String(employee.email_personal || "").trim();
  if (personalEmail && personalEmail.toUpperCase() !== "NA") return personalEmail;
  return "";
}

export default function ReporteFeedbackPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [feedbackResponses, setFeedbackResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/employees?activo=1&limit=1000").then(res => res.json()),
      fetch("/api/feedback").then(res => res.json()).catch(() => ({ responses: [] })),
    ])
      .then(([employeesData, feedbackData]) => {
        setEmployees(employeesData.employees ?? []);
        setFeedbackResponses(feedbackData.responses ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const report = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const inThreeDays = endOfDay(addDays(today, 3));
    const inFiveDays = endOfDay(addDays(today, 5));
    const weekStart = startOfWeek(now);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const rows = employees
      .map(employee => {
        const ingreso = parseDate(employee.fecha_ingreso);
        const primerFeedback = ingreso ? addDays(ingreso, 90) : null;
        const b2b = isB2B(employee);
        const segundoFeedback = primerFeedback ? addMonthsAndHalf(primerFeedback, b2b ? 3 : 2) : null;
        const tercerFeedback = ingreso && b2b ? addMonthsAndHalf(ingreso, 5) : null;
        return { employee, ingreso, primerFeedback, segundoFeedback, tercerFeedback, b2b };
      })
      .sort((a, b) => {
        const aTime = a.primerFeedback?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.primerFeedback?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime || a.employee.nombre.localeCompare(b.employee.nombre, "es");
      });

    const answeredThisMonth = feedbackResponses.filter(response => {
      if (response.tipo_feedback !== "primer_feedback") return false;
      return isSameMonth(parseDate(response.created_at), now);
    });

    const answeredKeys = new Set(
      feedbackResponses
        .filter(response => response.tipo_feedback === "primer_feedback")
        .flatMap(response => [
          response.evaluado_employee_id ? `id:${response.evaluado_employee_id}` : "",
          response.evaluado_email ? `email:${response.evaluado_email.toLowerCase()}` : "",
        ])
        .filter(Boolean)
    );

    const hasAnswer = (row: typeof rows[number]) => {
      const email = primaryEmail(row.employee).toLowerCase();
      return answeredKeys.has(`id:${row.employee.id}`) || (!!email && answeredKeys.has(`email:${email}`));
    };

    const decorated = rows.map(row => {
      const answered = hasAnswer(row);
      const firstDueSoon3 = !answered && isBetween(row.primerFeedback, today, inThreeDays);
      const firstDueSoon5 = !answered && isBetween(row.primerFeedback, today, inFiveDays);
      const firstThisMonth = isSameMonth(row.primerFeedback, now);
      const secondThisWeek = isBetween(row.segundoFeedback, weekStart, weekEnd);
      const thirdThisWeek = isBetween(row.tercerFeedback, weekStart, weekEnd);
      return { ...row, answered, firstDueSoon3, firstDueSoon5, firstThisMonth, secondThisWeek, thirdThisWeek };
    });

    const q = search.trim().toLowerCase();
    const filtered = decorated.filter(row => {
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
    });

    return {
      metrics: {
        firstSentThisMonth: decorated.filter(row => row.firstThisMonth).length,
        firstAnsweredThisMonth: answeredThisMonth.length,
        firstPendingFiveDays: decorated.filter(row => row.firstDueSoon5).length,
        firstPendingThreeDays: decorated.filter(row => row.firstDueSoon3).length,
        secondSentThisWeek: decorated.filter(row => row.secondThisWeek).length,
        thirdSentThisWeek: decorated.filter(row => row.thirdThisWeek).length,
      },
      rows: filtered,
      periodLabel: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
    };
  }, [employees, feedbackResponses, search]);

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
            <span style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 13 }}>Reporte feedback</span>
          </div>
          <Link href="/calculadora-fechas" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Calculadora
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <section className="g66-card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, color: "var(--g66-text)", fontSize: 26, fontWeight: 900 }}>Reporte feedback</h1>
              <div style={{ marginTop: 4, color: "var(--g66-muted)", fontSize: 13, fontWeight: 700 }}>
                Semana actual: {report.periodLabel}. Por ahora “enviado” significa que corresponde enviar según calendario.
              </div>
            </div>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por persona, mail, nombre, apellido, DNI..."
              style={{ width: 420, maxWidth: "100%", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none" }}
            />
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
          {[
            ["Primer feedback enviado este mes", report.metrics.firstSentThisMonth],
            ["Primer feedback respondido este mes", report.metrics.firstAnsweredThisMonth],
            ["Pendiente por vencer en 5 días", report.metrics.firstPendingFiveDays],
            ["Pendiente por vencer en 3 días", report.metrics.firstPendingThreeDays],
            ["Segundo feedback enviado esta semana", report.metrics.secondSentThisWeek],
            ["Tercer feedback enviado esta semana", report.metrics.thirdSentThisWeek],
          ].map(([label, value]) => (
            <div key={String(label)} className="g66-card" style={{ padding: 16 }}>
              <div style={{ color: "var(--g66-muted)", fontSize: 11, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.25 }}>{label}</div>
              <div style={{ color: "var(--g66-text)", fontSize: 30, fontWeight: 950, marginTop: 9 }}>{value}</div>
            </div>
          ))}
        </section>

        <section className="g66-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--g66-border)", color: "var(--g66-muted)", fontSize: 12, fontWeight: 800 }}>
            {loading ? "Cargando..." : `${report.rows.length} personas encontradas`}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "var(--g66-muted)" }}>
                  {["Persona", "Mail", "País", "1° feedback", "Estado 1°", "2° feedback", "3° feedback"].map(header => (
                    <th key={header} style={{ padding: "10px 11px", textAlign: "left", borderBottom: "1px solid var(--g66-border)", fontWeight: 900, whiteSpace: "nowrap" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 18, color: "var(--g66-muted)", textAlign: "center" }}>Cargando...</td>
                  </tr>
                ) : report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 18, color: "var(--g66-muted)", textAlign: "center" }}>Sin resultados</td>
                  </tr>
                ) : report.rows.map(row => {
                  const status = row.answered ? "Respondido" : row.firstDueSoon3 ? "Pendiente 3 días" : row.firstDueSoon5 ? "Pendiente 5 días" : row.firstThisMonth ? "Enviar este mes" : "Sin acción";
                  return (
                    <tr key={row.employee.id} style={{ borderBottom: "1px solid var(--g66-border)" }}>
                      <td style={{ padding: "10px 11px", fontWeight: 800, color: "var(--g66-text)", minWidth: 220 }}>
                        <div>{row.employee.nombre}</div>
                        <div style={{ color: "var(--g66-muted)", fontSize: 11 }}>{row.employee.dni}</div>
                      </td>
                      <td style={{ padding: "10px 11px", color: "var(--g66-muted)", minWidth: 220 }}>{primaryEmail(row.employee) || "-"}</td>
                      <td style={{ padding: "10px 11px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{row.employee.pais ?? "-"}</td>
                      <td style={{ padding: "10px 11px", whiteSpace: "nowrap", fontWeight: 800 }}>{formatDate(row.primerFeedback)}</td>
                      <td style={{ padding: "10px 11px", whiteSpace: "nowrap" }}>
                        <span style={{ borderRadius: 999, padding: "4px 8px", fontWeight: 900, background: row.answered ? "#dcfce7" : row.firstDueSoon3 ? "#fee2e2" : row.firstDueSoon5 ? "#fef3c7" : "#f1f5f9", color: row.answered ? "#166534" : row.firstDueSoon3 ? "#991b1b" : row.firstDueSoon5 ? "#92400e" : "var(--g66-muted)" }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 11px", whiteSpace: "nowrap", fontWeight: 800, color: row.secondThisWeek ? "var(--g66-blue)" : "var(--g66-muted)" }}>{formatDate(row.segundoFeedback)}</td>
                      <td style={{ padding: "10px 11px", whiteSpace: "nowrap", fontWeight: 800, color: row.thirdThisWeek ? "var(--g66-blue)" : "var(--g66-muted)" }}>{formatDate(row.tercerFeedback)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
