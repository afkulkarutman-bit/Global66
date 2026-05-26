"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import HeaderNavArrows from "@/components/HeaderNavArrows";

type IngresoStatus = "listo" | "pendiente" | "critico";

type NuevoIngreso = {
  id: string;
  mes: string;
  anio: number;
  jefatura: string;
  buddy: string;
  area: string;
  cargo: string;
  fechaIngreso: string;
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correoPersonal: string;
  pais: string;
  modalidad: string;
  tipoEquipo: string;
  recruiter: string;
  origen: string;
  tipoContrato: string;
  kitBienvenida: boolean;
  salarioBase: number | null;
  salarioLiquido: number | null;
  moneda: string;
  cartaOferta: string;
};

const seedRows: NuevoIngreso[] = [
  {
    id: "sergio-torres",
    mes: "Abril",
    anio: 2026,
    jefatura: "Rodrigo Lama",
    buddy: "Sofia Gomez",
    area: "B2B",
    cargo: "Sales Specialist Hunter B2B",
    fechaIngreso: "2026-05-04",
    dni: "1022424700",
    nombres: "Sergio Felipe",
    apellidoPaterno: "Torres",
    apellidoMaterno: "Gonzalez",
    correoPersonal: "sergio.14.st@gmail.com",
    pais: "Colombia",
    modalidad: "Híbrido (4x1)",
    tipoEquipo: "Tipo A",
    recruiter: "Sandra Cardozo",
    origen: "Hunting",
    tipoContrato: "Prestación de Servicios",
    kitBienvenida: false,
    salarioBase: 4500000,
    salarioLiquido: null,
    moneda: "COP",
    cartaOferta: "Carta Oferta Prestación de Servicios Sergio Torres",
  },
  {
    id: "javier-cerpa",
    mes: "Abril",
    anio: 2026,
    jefatura: "Julio Montilla",
    buddy: "Maximiliano Toledo",
    area: "Experience",
    cargo: "UX UI Designer",
    fechaIngreso: "2026-05-11",
    dni: "15906351-8",
    nombres: "Javier Alfonso",
    apellidoPaterno: "Cerpa",
    apellidoMaterno: "Cerpa",
    correoPersonal: "jacerpac@gmail.com",
    pais: "Chile",
    modalidad: "Híbrido (4x1)",
    tipoEquipo: "Tipo A",
    recruiter: "Sandra Cardozo",
    origen: "Postulación",
    tipoContrato: "Contrato Planilla",
    kitBienvenida: false,
    salarioBase: 2504228,
    salarioLiquido: 2400000,
    moneda: "CLP",
    cartaOferta: "Carta Oferta Javier Cerpa",
  },
  {
    id: "luisa-salas",
    mes: "Marzo",
    anio: 2026,
    jefatura: "Ivan Olivo",
    buddy: "",
    area: "Finanzas",
    cargo: "Auxiliar de Oficina",
    fechaIngreso: "2026-03-23",
    dni: "",
    nombres: "Luisa Verónica",
    apellidoPaterno: "Salas",
    apellidoMaterno: "",
    correoPersonal: "luisa.veronica.salas6363@gmail.com",
    pais: "",
    modalidad: "",
    tipoEquipo: "",
    recruiter: "Catalina Perez",
    origen: "Referido",
    tipoContrato: "Contrato Planilla",
    kitBienvenida: false,
    salarioBase: 432900,
    salarioLiquido: 600000,
    moneda: "CLP",
    cartaOferta: "https://docs.google.com/document/d/ejemplo",
  },
  {
    id: "paula-nieto",
    mes: "Abril",
    anio: 2026,
    jefatura: "Rodrigo Lama",
    buddy: "Sofia Gomez",
    area: "B2B",
    cargo: "Sales Specialist Hunter B2B",
    fechaIngreso: "2026-05-04",
    dni: "1010233197",
    nombres: "Paula Andrea",
    apellidoPaterno: "Nieto",
    apellidoMaterno: "Marin",
    correoPersonal: "paula.nietom@hotmail.com",
    pais: "Colombia",
    modalidad: "Híbrido (4x1)",
    tipoEquipo: "Tipo A",
    recruiter: "Sandra Cardozo",
    origen: "Hunting",
    tipoContrato: "Prestación de Servicios",
    kitBienvenida: false,
    salarioBase: 4500000,
    salarioLiquido: null,
    moneda: "COP",
    cartaOferta: "Carta Oferta Paula Nieto",
  },
  {
    id: "diego-larraguibel",
    mes: "Mayo",
    anio: 2026,
    jefatura: "Leopoldo Soto",
    buddy: "",
    area: "Fraude",
    cargo: "AI Specialist",
    fechaIngreso: "2026-05-18",
    dni: "20808977-3",
    nombres: "Diego Ignacio",
    apellidoPaterno: "Larraguibel",
    apellidoMaterno: "Ipinza",
    correoPersonal: "diego@larraguibelf.cl",
    pais: "Chile",
    modalidad: "Híbrido (4x1)",
    tipoEquipo: "",
    recruiter: "Trini Zanetta",
    origen: "Postulación",
    tipoContrato: "Contrato Planilla",
    kitBienvenida: false,
    salarioBase: 1985098,
    salarioLiquido: 2000000,
    moneda: "CLP",
    cartaOferta: "https://docs.google.com/document/d/ejemplo",
  },
  {
    id: "federico-sanchez",
    mes: "Mayo",
    anio: 2026,
    jefatura: "Leopoldo Soto",
    buddy: "",
    area: "Fraude",
    cargo: "AI Specialist",
    fechaIngreso: "2026-05-18",
    dni: "20071632-9",
    nombres: "Federico Andrés",
    apellidoPaterno: "Sánchez",
    apellidoMaterno: "Torres",
    correoPersonal: "fasanchez3@uc.cl",
    pais: "Chile",
    modalidad: "Híbrido (4x1)",
    tipoEquipo: "Tipo D",
    recruiter: "Catalina Perez",
    origen: "Postulación",
    tipoContrato: "Contrato Planilla",
    kitBienvenida: false,
    salarioBase: 3433870,
    salarioLiquido: 3200000,
    moneda: "CLP",
    cartaOferta: "https://docs.google.com/document/d/ejemplo",
  },
];

const MONTH_ORDER = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function fmtDate(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return day && month && year ? `${day}-${month}-${year}` : value;
}

function ingresoMonth(value: string) {
  if (!value) return "";
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) ? "" : String(date.getMonth() + 1);
}

function fmtMoney(value: number | null, moneda: string) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value)} ${moneda}`;
}

function fullName(row: NuevoIngreso) {
  return [row.nombres, row.apellidoPaterno, row.apellidoMaterno].filter(Boolean).join(" ");
}

function getStatus(row: NuevoIngreso): { value: IngresoStatus; label: string } {
  const missingCore = !row.dni || !row.pais || !row.tipoContrato || !row.fechaIngreso || !row.correoPersonal;
  const missingMoney = row.salarioBase === null || !row.moneda;
  const missingOffer = !row.cartaOferta;
  if (missingCore || missingMoney) return { value: "critico", label: "Falta data" };
  if (missingOffer || !row.kitBienvenida || !row.buddy || !row.tipoEquipo) return { value: "pendiente", label: "Pendiente" };
  return { value: "listo", label: "Listo" };
}

function daysToStart(date: string) {
  const target = new Date(date + "T12:00:00");
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((target.getTime() - current.getTime()) / 86400000);
}

function uniqueValues(rows: NuevoIngreso[], key: keyof NuevoIngreso) {
  return [...new Set(rows.map(r => String(r[key] ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

export default function StatusIngresosPage() {
  const [rows] = useState<NuevoIngreso[]>(seedRows);
  const [search, setSearch] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [filterPais, setFilterPais] = useState("");
  const [filterRecruiter, setFilterRecruiter] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(row => !filterMes || `${row.mes} ${row.anio}` === filterMes)
      .filter(row => !filterPais || row.pais === filterPais)
      .filter(row => !filterRecruiter || row.recruiter === filterRecruiter)
      .filter(row => !filterStatus || getStatus(row).value === filterStatus)
      .filter(row => {
        if (!q) return true;
        return [
          fullName(row), row.dni, row.cargo, row.area, row.jefatura, row.buddy,
          row.correoPersonal, row.recruiter, row.tipoContrato, row.cartaOferta,
        ].some(value => String(value ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => a.fechaIngreso.localeCompare(b.fechaIngreso) || fullName(a).localeCompare(fullName(b), "es"));
  }, [rows, search, filterMes, filterPais, filterRecruiter, filterStatus]);

  const metrics = useMemo(() => {
    const pending = rows.filter(r => getStatus(r).value === "pendiente").length;
    const critical = rows.filter(r => getStatus(r).value === "critico").length;
    const ready = rows.filter(r => getStatus(r).value === "listo").length;
    const next = [...rows].sort((a, b) => a.fechaIngreso.localeCompare(b.fechaIngreso))[0];
    return { total: rows.length, pending, critical, ready, next };
  }, [rows]);

  const monthOptions = useMemo(() => {
    return [...new Set(rows.map(r => `${r.mes} ${r.anio}`))]
      .sort((a, b) => {
        const [ma, ya] = a.split(" ");
        const [mb, yb] = b.split(" ");
        return Number(ya) - Number(yb) || MONTH_ORDER.indexOf(ma) - MONTH_ORDER.indexOf(mb);
      });
  }, [rows]);

  const paises = useMemo(() => uniqueValues(rows, "pais"), [rows]);
  const recruiters = useMemo(() => uniqueValues(rows, "recruiter"), [rows]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 8px rgba(59,62,219,0.25)" }}>
        <div style={{ maxWidth: 1500, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} />
            </Link>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>BOOK</span>
          </div>
          <HeaderNavArrows />
        </div>
      </header>

      <main style={{ maxWidth: 1500, margin: "0 auto", padding: 24 }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Ingresos", value: metrics.total, color: "var(--g66-blue)", bg: "var(--g66-blue-light)" },
            { label: "Listos", value: metrics.ready, color: "#166534", bg: "#dcfce7" },
            { label: "Pendientes", value: metrics.pending, color: "#92400e", bg: "#fef3c7" },
            { label: "Falta data", value: metrics.critical, color: "#991b1b", bg: "#fee2e2" },
            { label: "Próximo ingreso", value: metrics.next ? `${daysToStart(metrics.next.fechaIngreso)} días` : "-", color: "var(--g66-text)", bg: "#fff" },
          ].map(card => (
            <div key={card.label} className="g66-card" style={{ padding: "16px 18px", background: card.bg }}>
              <div style={{ fontSize: 11, color: card.color, fontWeight: 800, textTransform: "uppercase" }}>{card.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
            </div>
          ))}
        </section>

        <section className="g66-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, DNI, cargo, recruiter, carta..."
              style={{ width: 360, maxWidth: "100%", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none" }}
            />
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} style={selectStyle}>
              <option value="">Todos los meses</option>
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterPais} onChange={e => setFilterPais(e.target.value)} style={selectStyle}>
              <option value="">Todos los países</option>
              {paises.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterRecruiter} onChange={e => setFilterRecruiter(e.target.value)} style={selectStyle}>
              <option value="">Todos los recruiters</option>
              {recruiters.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="">Todos los estados</option>
              <option value="listo">Listo</option>
              <option value="pendiente">Pendiente</option>
              <option value="critico">Falta data</option>
            </select>
            {(search || filterMes || filterPais || filterRecruiter || filterStatus) && (
              <button
                onClick={() => { setSearch(""); setFilterMes(""); setFilterPais(""); setFilterRecruiter(""); setFilterStatus(""); }}
                style={{ background: "#fff", color: "var(--g66-muted)", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Limpiar
              </button>
            )}
            <div style={{ marginLeft: "auto", color: "var(--g66-muted)", fontSize: 12, fontWeight: 700 }}>{filteredRows.length}/{rows.length}</div>
          </div>
        </section>

        <section className="g66-card" style={{ overflow: "hidden" }}>
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 255px)" }}>
            <table style={{ width: "100%", minWidth: 1850, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#eef2ff" }}>
                  {[
                    "mes", "Año", "Jefatura", "Buddy", "Área", "Cargo", "Fecha Ingreso", "Mes de Ingreso",
                    "DNI", "Nombres", "Apellido Paterno", "Apellido Materno", "Correo Personal", "Pais",
                    "Presencial o Remoto", "Tipo Equipo", "Recruiter", "Origen del Candidato", "Tipo de Contrato",
                    "Se entrego Kit de Bienvenida?", "Salario Base", "Salario liquido (Chile)", "Moneda", "Carta Oferta",
                  ].map((h, i) => (
                    <th key={h} style={{
                      position: "sticky", top: 0, zIndex: 2, background: "#eef2ff",
                      textAlign: i >= 20 && i <= 22 ? "right" : "left",
                      padding: "10px 9px", borderBottom: "1px solid #c7d2fe",
                      color: "#3730a3", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const status = getStatus(row);
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--g66-border)", background: status.value === "critico" ? "#fffafa" : "#fff" }}>
                      <td style={tdStyle}>{row.mes}</td>
                      <td style={tdStyle}>{row.anio}</td>
                      <td style={tdStyle}>{row.jefatura || <Missing />}</td>
                      <td style={tdStyle}>{row.buddy || <Missing />}</td>
                      <td style={tdStyle}>{row.area || <Missing />}</td>
                      <td style={{ ...tdStyle, minWidth: 210 }}>{row.cargo || <Missing />}</td>
                      <td style={tdStyle}>{fmtDate(row.fechaIngreso)}</td>
                      <td style={tdStyle}>{ingresoMonth(row.fechaIngreso) || <Missing />}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", color: row.dni ? "var(--g66-text2)" : "var(--g66-red)", fontWeight: row.dni ? 500 : 800 }}>{row.dni || "Sin DNI"}</td>
                      <td style={{ ...tdStyle, minWidth: 150, fontWeight: 800 }}>{row.nombres || <Missing />}</td>
                      <td style={tdStyle}>{row.apellidoPaterno || <Missing />}</td>
                      <td style={tdStyle}>{row.apellidoMaterno || ""}</td>
                      <td style={{ ...tdStyle, minWidth: 230 }}>{row.correoPersonal || <Missing />}</td>
                      <td style={tdStyle}>{row.pais || <Missing />}</td>
                      <td style={tdStyle}>{row.modalidad || <Missing />}</td>
                      <td style={tdStyle}>{row.tipoEquipo || <Missing />}</td>
                      <td style={tdStyle}>{row.recruiter || <Missing />}</td>
                      <td style={tdStyle}>{row.origen || <Missing />}</td>
                      <td style={tdStyle}>{row.tipoContrato || <Missing />}</td>
                      <td style={{ ...tdStyle, minWidth: 145 }}>
                        <span style={{ color: row.kitBienvenida ? "#166534" : "#92400e", fontWeight: 800 }}>
                          {row.kitBienvenida ? "Sí" : "No"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{fmtMoney(row.salarioBase, row.moneda)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(row.salarioLiquido, row.moneda)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{row.moneda || <Missing />}</td>
                      <td style={{ ...tdStyle, minWidth: 280 }}>
                        {row.cartaOferta ? (
                          row.cartaOferta.startsWith("http") ? (
                            <a href={row.cartaOferta} target="_blank" rel="noreferrer" style={{ color: "var(--g66-blue)", fontWeight: 700 }}>Abrir carta</a>
                          ) : (
                            <span style={{ color: "var(--g66-blue)", fontWeight: 700 }}>{row.cartaOferta}</span>
                          )
                        ) : <Missing />}
                      </td>
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

const selectStyle: CSSProperties = {
  border: "1px solid var(--g66-border)",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13,
  background: "#fff",
  color: "var(--g66-text)",
  outline: "none",
};

const tdStyle: CSSProperties = {
  padding: "9px 9px",
  verticalAlign: "top",
  color: "var(--g66-text2)",
  whiteSpace: "nowrap",
};

function Missing() {
  return <span style={{ color: "var(--g66-red)", fontWeight: 800 }}>Falta</span>;
}
