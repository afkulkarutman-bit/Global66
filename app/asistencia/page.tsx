"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AttendanceRow = {
  employee_id: number;
  dni: string;
  nombre: string;
  pais: string;
  cargo: string | null;
  area: string | null;
  presencialidad: string;
  dias_habiles_mes: number;
  dias_esperados: number;
  dias_asistidos: number;
  porcentaje_requerido?: number;
  porcentaje_cumplimiento?: number | null;
  porcentaje_asistencia: number | null;
  fechas: string[];
  estado: "Cumple" | "Revisar" | "No cumple" | "No aplica";
  alertas: string[];
};

type AttendanceUnmatched = {
  dni: string;
  email?: string;
  name_key?: string;
  match_key?: string;
  nombre_excel: string;
  dias_asistidos: number;
  fechas: string[];
};

type AttendanceAiReview = {
  status: "ok" | "warning" | "error" | "disabled";
  summary: string;
  findings: string[];
  generatedAt: string;
  error?: string | null;
};

type AttendanceResult = {
  reportId: string | null;
  saved: boolean;
  saveError: string | null;
  summary: {
    country: string;
    year: number;
    month: number;
    mes: string;
    sheetName: string;
    rawRows: number;
    parsedRows: number;
    employees: number;
    monthBusinessDays: number;
    holidays: string[];
    holidaysSource: string;
    holidaysError: string | null;
    cumple: number;
    noCumple: number;
    revisar: number;
    noAplica: number;
    alertas: number;
  };
  rows: AttendanceRow[];
  unmatched: AttendanceUnmatched[];
  aiReview?: AttendanceAiReview | null;
};

type SavedAttendanceReport = {
  id: string;
  country: string;
  year: number;
  month: number;
  month_name: string;
  source_file: string | null;
  sheet_name: string | null;
  business_days: number;
  summary: AttendanceResult["summary"];
  rows: AttendanceRow[];
  unmatched: AttendanceUnmatched[];
  ai_review?: AttendanceAiReview | null;
  created_at: string;
};

const COUNTRIES = ["Chile", "Argentina", "Colombia", "Perú"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmtPct(value: number | null) {
  if (value === null) return "N/A";
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}

function sortAttendanceRows(rows: AttendanceRow[]) {
  return [...rows].sort((a, b) => {
    const pctA = getCompliancePct(a) ?? -1;
    const pctB = getCompliancePct(b) ?? -1;
    return pctB - pctA || b.dias_asistidos - a.dias_asistidos || a.nombre.localeCompare(b.nombre);
  });
}

function hasAiReview(review: AttendanceAiReview | null | undefined): review is AttendanceAiReview {
  return Boolean(review?.summary);
}

function getCompliancePct(row: AttendanceRow) {
  if (row.porcentaje_cumplimiento !== undefined) return row.porcentaje_cumplimiento;
  if (!row.dias_esperados) return null;
  return Number(((row.dias_asistidos / row.dias_esperados) * 100).toFixed(2));
}

function downloadCsv(result: AttendanceResult) {
  const header = ["DNI","Nombre","Pais","Cargo","Area","Presencialidad","Dias esperados","Dias asistidos","% Cumplimiento"];
  const rows = sortAttendanceRows(result.rows).map(row => [
    row.dni,
    row.nombre,
    row.pais,
    row.cargo ?? "",
    row.area ?? "",
    row.presencialidad,
    row.dias_esperados,
    row.dias_asistidos,
    getCompliancePct(row) ?? "",
  ]);
  const csv = [header, ...rows]
    .map(cols => cols.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asistencia-${result.summary.country}-${result.summary.year}-${String(result.summary.month).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadPdf(result: AttendanceResult) {
  const rows = sortAttendanceRows(result.rows);
  const htmlRows = rows.map(row => {
    return `
      <tr>
        <td class="name">${escapeHtml(row.nombre)}</td>
        <td>${escapeHtml(row.dni)}</td>
        <td>${escapeHtml(row.area ?? "")}</td>
        <td>${escapeHtml(row.cargo ?? "")}</td>
        <td>${escapeHtml(row.presencialidad)}</td>
        <td class="num">${row.dias_esperados}</td>
        <td class="num">${row.dias_asistidos}</td>
        <td class="num strong">${fmtPct(getCompliancePct(row))}</td>
      </tr>
    `;
  }).join("");

  const review = hasAiReview(result.aiReview) ? `
    <section class="review">
      <h2>Revisión IA</h2>
      <p>${escapeHtml(result.aiReview.summary)}</p>
      ${result.aiReview.findings.length > 0 ? `<ul>${result.aiReview.findings.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
  ` : "";

  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    alert("El navegador bloqueó la ventana de PDF. Habilita pop-ups para esta página.");
    return;
  }

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Asistencia ${escapeHtml(result.summary.country)} ${escapeHtml(result.summary.mes)} ${result.summary.year}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 28px; color: #111827; }
          header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b3edb; padding-bottom: 14px; margin-bottom: 18px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { height: 38px; border-radius: 5px; }
          h1 { font-size: 22px; margin: 0; }
          .subtitle { color: #6b7280; font-size: 12px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #f3f4f6; color: #4b5563; text-align: left; padding: 6px; border-bottom: 1px solid #d1d5db; }
          td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          .name { font-weight: 700; }
          .num { text-align: right; white-space: nowrap; }
          .strong { font-weight: 900; }
          .review { border-left: 4px solid #3b3edb; background: #f8fafc; padding: 10px 12px; margin: 14px 0; font-size: 12px; }
          .review h2 { font-size: 14px; margin: 0 0 6px; }
          .review p { margin: 0 0 6px; }
          .review ul { margin: 6px 0 0 18px; padding: 0; }
          @media print {
            body { margin: 14mm; }
            button { display: none; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="brand">
            <img src="/logo.jpg" alt="Global66" />
            <div>
              <h1>${escapeHtml(result.summary.country)} · ${escapeHtml(result.summary.mes)} ${result.summary.year}</h1>
              <div class="subtitle">People</div>
            </div>
          </div>
          <button onclick="window.print()" style="background:#3b3edb;color:white;border:0;border-radius:7px;padding:8px 12px;font-weight:800">Guardar PDF</button>
        </header>

        ${review}
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>DNI</th><th>Area</th><th>Cargo</th><th>Pres.</th><th>Esp.</th><th>Asist.</th><th>% Cumpl.</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
}

export default function AsistenciaPage() {
  const today = new Date();
  const defaultMonth = today.getMonth() === 0 ? 12 : today.getMonth();
  const defaultYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const [country, setCountry] = useState("Chile");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [savedReports, setSavedReports] = useState<SavedAttendanceReport[]>([]);
  const [reportsError, setReportsError] = useState("");
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingAiReview, setLoadingAiReview] = useState(false);

  const loadReports = async () => {
    setLoadingReports(true);
    setReportsError("");
    const res = await fetch("/api/asistencia/report");
    const data = await res.json();
    setLoadingReports(false);
    if (!res.ok) {
      setReportsError(data.error || "No se pudieron cargar reportes guardados.");
      return;
    }
    setSavedReports(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports();
  }, []);

  const sortedRows = useMemo(() => {
    return sortAttendanceRows(result?.rows ?? []);
  }, [result]);

  const openSavedReport = (report: SavedAttendanceReport) => {
    setResult({
      reportId: report.id,
      saved: true,
      saveError: null,
      summary: report.summary,
      rows: report.rows ?? [],
      unmatched: report.unmatched ?? [],
      aiReview: hasAiReview(report.ai_review) ? report.ai_review : null,
    });
  };

  const deleteReport = async (report: SavedAttendanceReport) => {
    if (!confirm(`¿Eliminar reporte ${report.country} ${report.month_name} ${report.year}?`)) return;
    const res = await fetch(`/api/asistencia/report?id=${encodeURIComponent(report.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "No se pudo eliminar el reporte.");
      return;
    }
    if (result?.reportId === report.id) setResult(null);
    await loadReports();
  };

  const processFile = async () => {
    if (!file) { setError("Sube un Excel primero."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("country", country);
    form.append("year", String(year));
    form.append("month", String(month));
    const res = await fetch("/api/asistencia/report", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "No se pudo procesar el archivo.");
      return;
    }
    setResult(data);
    await loadReports();
  };

  const generateReview = async () => {
    if (!result?.reportId) {
      alert("Primero genera y guarda el reporte para poder revisar con IA.");
      return;
    }
    setLoadingAiReview(true);
    const res = await fetch("/api/asistencia/report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: result.reportId }),
    });
    const data = await res.json();
    setLoadingAiReview(false);
    if (!res.ok) {
      alert(data.error || "No se pudo generar la revisión IA.");
      return;
    }
    setResult(prev => prev ? { ...prev, aiReview: data.aiReview } : prev);
    await loadReports();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(59,62,219,0.25)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link href="/"><img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} /></Link>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>People</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>← Empleados</Link>
            <div style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13 }}>Asistencia</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" }}>
          <section className="g66-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--g66-text)", marginBottom: 4 }}>Reporte mensual</div>
            <div style={{ fontSize: 13, color: "var(--g66-muted)", marginBottom: 18 }}>Sube el Excel del país y cruza asistencia contra empleados activos.</div>

            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase" }}>País</span>
                <select className="g66-input" value={country} onChange={e => setCountry(e.target.value)}>
                  {COUNTRIES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase" }}>Mes</span>
                  <select className="g66-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase" }}>Año</span>
                  <input className="g66-input" type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
                </label>
              </div>

              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 10, fontSize: 12, color: "#1d4ed8", lineHeight: 1.45 }}>
                Los feriados se cargan automáticamente según país y año. No tienes que ingresarlos manualmente.
              </div>

              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase" }}>Excel de accesos</span>
                <input className="g66-input" type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>

              <button onClick={processFile} disabled={loading} style={{ background: loading ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: loading ? "default" : "pointer" }}>
                {loading ? "Procesando..." : "Generar reporte"}
              </button>

              {error && <div style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 8, padding: 10, fontSize: 13 }}>{error}</div>}
              {result && !result.saved && (
                <div style={{ background: "#f8fafc", color: "var(--g66-text)", border: "1px solid var(--g66-border)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                  Reporte calculado, pero no guardado en Supabase: {result.saveError}
                </div>
              )}
            </div>
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            <div className="g66-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Reportes guardados</div>
                </div>
                <button onClick={loadReports} disabled={loadingReports} style={{ background: "#fff", color: "var(--g66-blue)", border: "1px solid var(--g66-blue-mid)", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: loadingReports ? "default" : "pointer" }}>
                  {loadingReports ? "Cargando..." : "Actualizar"}
                </button>
              </div>
              {reportsError ? (
                <div style={{ background: "#f8fafc", color: "var(--g66-text)", border: "1px solid var(--g66-border)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                  {reportsError}
                </div>
              ) : savedReports.length === 0 ? (
                <div style={{ color: "var(--g66-muted)", fontSize: 13 }}>No hay reportes guardados todavía.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {savedReports.slice(0, 8).map(report => (
                    <div key={report.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 10px", background: result?.reportId === report.id ? "#eef2ff" : "#fff" }}>
                      <button onClick={() => openSavedReport(report)} style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--g66-text)" }}>{report.country} · {report.month_name} {report.year}</div>
                      </button>
                      <button onClick={() => openSavedReport(report)} style={{ background: "var(--g66-blue-light)", color: "var(--g66-blue)", border: "1px solid var(--g66-blue-mid)", borderRadius: 7, padding: "6px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Ver</button>
                      <button onClick={() => deleteReport(report)} style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 7, padding: "6px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!result ? (
              <div className="g66-card" style={{ padding: 28, color: "var(--g66-muted)", fontSize: 14 }}>Aún no hay reporte generado.</div>
            ) : (
              <>
                {hasAiReview(result.aiReview) && (
                  <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid var(--g66-blue)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 15, color: "var(--g66-text)" }}>Revisión IA</div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                          Gemini revisa inconsistencias. No modifica el cálculo.
                        </div>
                      </div>
                      <span style={{ borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 900, background: "#f3f4f6", color: "var(--g66-text)" }}>
                        {result.aiReview.status === "ok" ? "OK" : result.aiReview.status === "disabled" ? "Sin IA" : "Revisar"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--g66-text)", lineHeight: 1.45 }}>{result.aiReview.summary}</div>
                    {result.aiReview.error && (
                      <div style={{ fontSize: 12, color: "var(--g66-text)", marginTop: 6, fontWeight: 700 }}>{result.aiReview.error}</div>
                    )}
                    {result.aiReview.findings.length > 0 && (
                      <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
                        {result.aiReview.findings.map((finding, index) => (
                          <div key={`${index}-${finding}`} style={{ fontSize: 12, color: "var(--g66-text)", background: "#f8fafc", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "7px 9px" }}>
                            {finding}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="g66-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{result.summary.country} · {result.summary.mes} {result.summary.year}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={generateReview} disabled={loadingAiReview} style={{ background: "#fff", color: "var(--g66-blue)", border: "1px solid var(--g66-blue-mid)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 800, cursor: loadingAiReview ? "default" : "pointer" }}>{loadingAiReview ? "Revisando..." : "Generar revisión IA"}</button>
                      <button onClick={() => downloadPdf(result)} style={{ background: "var(--g66-blue)", color: "#fff", border: "1px solid var(--g66-blue)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Descargar PDF</button>
                      <button onClick={() => downloadCsv(result)} style={{ background: "#fff", color: "var(--g66-blue)", border: "1px solid var(--g66-blue-mid)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Descargar CSV</button>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--g66-bg)" }}>
                          {["Nombre","DNI","Cargo","Pres.","Esperados","Asistidos","% Cumpl."].map(h => (
                            <th key={h} style={{ padding: "8px 9px", textAlign: ["Esperados","Asistidos","% Cumpl."].includes(h) ? "right" : "left", color: "var(--g66-muted)", fontSize: 11, fontWeight: 800, borderBottom: "1px solid var(--g66-border)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map(row => (
                          <tr key={row.employee_id} style={{ borderBottom: "1px solid var(--g66-border)" }}>
                            <td style={{ padding: "7px 9px", fontWeight: 700 }}>{row.nombre}</td>
                            <td style={{ padding: "7px 9px", color: "var(--g66-muted)", fontFamily: "monospace" }}>{row.dni}</td>
                            <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{row.cargo}</td>
                            <td style={{ padding: "7px 9px", fontWeight: 800 }}>{row.presencialidad}</td>
                            <td style={{ padding: "7px 9px", textAlign: "right" }}>{row.dias_esperados}</td>
                            <td style={{ padding: "7px 9px", textAlign: "right", fontWeight: 800 }}>{row.dias_asistidos}</td>
                            <td style={{ padding: "7px 9px", textAlign: "right", fontWeight: 900, color: "var(--g66-blue)" }}>{fmtPct(getCompliancePct(row))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
