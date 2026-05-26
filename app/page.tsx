"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import EmployeeModal from "@/components/EmployeeModal";
import NewEmployeeModal from "@/components/NewEmployeeModal";
import Dashboard from "@/components/Dashboard";
import PendingEmployees from "@/components/PendingEmployees";
import ChatWidget from "@/components/ChatWidget";

type Employee = {
  id: number;
  dni: string;
  nombre: string;
  activo: number;
  cargo: string;
  sexo: string;
  salario_bruto: number | null;
  area: string;
  centro_costo: string;
  pais: string;
  moneda: string;
  sueldo_local: number | null;
  domicilio: string;
  fecha_ingreso: string;
  fecha_termino?: string | null;
  tipo_contrato: string;
  jefatura: string;
  email_global: string;
  email_personal: string;
  presencialidad?: string | null;
};

const FLAG: Record<string, string> = {
  Chile: "🇨🇱", Argentina: "🇦🇷", Colombia: "🇨🇴",
  "Perú": "🇵🇪", "España": "🇪🇸", "Panamá": "🇵🇦", Singapur: "🇸🇬",
};

function tenure(fechaIngreso: string | null | undefined): string {
  if (!fechaIngreso || fechaIngreso === "NA") return "—";
  const start = new Date(fechaIngreso);
  if (isNaN(start.getTime())) return "—";
  const now = new Date();
  const totalDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
  if (totalDays < 0) return "—";
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  if (years >= 1) return months > 0 ? `${years}a ${months}m` : `${years} año${years !== 1 ? "s" : ""}`;
  if (months >= 1) return `${months} mes${months !== 1 ? "es" : ""}`;
  return `${totalDays} día${totalDays !== 1 ? "s" : ""}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d || d === "NA") return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
}

function fmtAmount(val: number | null) {
  if (!val) return "—";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);
}

function initials(nombre: string) {
  return nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterActivo, setFilterActivo] = useState<string>("1");
  const [filterPais, setFilterPais] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [paises, setPaises] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [stats, setStats] = useState({ activos: 0, inactivos: 0 });
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [activeTab, setActiveTab] = useState<"empleados" | "dashboard" | "pendientes">("empleados");
  const [sinJefe, setSinJefe] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hideSalaries, setHideSalaries] = useState(false);
  const [exportingEmployees, setExportingEmployees] = useState(false);
  const [activeManagerEmails, setActiveManagerEmails] = useState<Set<string>>(new Set());
  const router = useRouter();
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };
  const LIMIT = 50;

  const loadFilters = useCallback(() => {
    fetch("/api/employees/filters").then(r => r.json()).then(d => {
      setPaises(d.paises);
      setAreas(d.areas);
      const a = d.stats.find((s: { activo: number; c: number }) => s.activo === 1)?.c || 0;
      const i = d.stats.find((s: { activo: number; c: number }) => s.activo === 0)?.c || 0;
      setStats({ activos: a, inactivos: i });
      setSinJefe(d.sinJefe || 0);
      setPendingCount(d.pendingCount || 0);
    });
  }, []);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  useEffect(() => {
    fetch("/api/employees/managers")
      .then(r => r.json())
      .then((data: { nombre: string; email_global: string }[]) => {
        const values = data.flatMap(m => [m.email_global, m.nombre].filter(Boolean));
        setActiveManagerEmails(new Set(values));
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchEmployees = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filterActivo) params.set("activo", filterActivo);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterPais) params.set("pais", filterPais);
    if (filterArea) params.set("area", filterArea);
    fetch(`/api/employees?${params}`)
      .then(r => r.json())
      .then(d => { setEmployees(d.employees || []); setTotal(d.total || 0); })
      .finally(() => setLoading(false));
  }, [page, filterActivo, debouncedSearch, filterPais, filterArea]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const totalPages = Math.ceil(total / LIMIT);

  const exportEmployeesExcel = async () => {
    setExportingEmployees(true);
    try {
      const XLSX = await import("xlsx");
      const fetchScope = async (activo?: "1" | "0") => {
        const params = new URLSearchParams({ page: "1", limit: "10000" });
        if (activo) params.set("activo", activo);
        const res = await fetch(`/api/employees?${params.toString()}`);
        const data = await res.json();
        return (data.employees ?? []) as Record<string, unknown>[];
      };

      const headers = [
        "Estado", "DNI", "Nombre", "Sexo", "Cargo", "Área", "Centro de costo", "País",
        "Tipo de contrato", "Jefatura", "Email global", "Email personal",
        "Fecha ingreso", "Fecha término", "Antigüedad", "Presencialidad",
        "Moneda", "Sueldo local", "Salario bruto", "Usuario wallet",
        "Banco", "Tipo cuenta", "Número cuenta", "RUT/CUIT cuenta", "Email cuenta", "Nombre cuenta",
        "Domicilio", "Nacionalidad", "Fecha nacimiento", "Estado civil", "Teléfono",
        "Tiene hijos", "Fechas hijos", "Discapacidad", "Carnet discapacidad",
        "Alergias", "Alimentación especial", "Contacto emergencia",
      ];
      const makeSheet = (rows: Record<string, unknown>[]) => {
        const body = rows.map(emp => [
          Number(emp.activo ?? 0) === 1 ? "Activo" : "Inactivo",
          emp.dni ?? "",
          emp.nombre ?? "",
          emp.sexo ?? "",
          emp.cargo ?? "",
          emp.area ?? "",
          emp.centro_costo ?? "",
          emp.pais ?? "",
          emp.tipo_contrato ?? "",
          emp.jefatura ?? "",
          emp.email_global ?? "",
          emp.email_personal ?? "",
          fmtDate(String(emp.fecha_ingreso ?? "")),
          fmtDate(String(emp.fecha_termino ?? "")),
          Number(emp.activo ?? 0) === 1 ? tenure(String(emp.fecha_ingreso ?? "")) : "",
          emp.presencialidad ?? "",
          emp.moneda ?? "",
          emp.sueldo_local ?? "",
          emp.salario_bruto ?? "",
          emp.usuario_wallet ?? "",
          emp.banco ?? "",
          emp.tipo_cuenta ?? "",
          emp.numero_cuenta ?? "",
          emp.rut_cuenta ?? "",
          emp.email_cuenta ?? "",
          emp.nombre_cuenta ?? "",
          emp.domicilio ?? "",
          emp.nacionalidad ?? "",
          fmtDate(String(emp.fecha_nacimiento ?? "")),
          emp.estado_civil ?? "",
          emp.telefono ?? "",
          Number(emp.tiene_hijos ?? 0) === 1 ? "Sí" : "No",
          emp.fechas_hijos ?? "",
          Number(emp.discapacidad ?? 0) === 1 ? "Sí" : "No",
          Number(emp.carnet_discapacidad ?? 0) === 1 ? "Sí" : "No",
          emp.alergias ?? "",
          emp.alimentacion_especial ?? "",
          emp.contacto_emergencia ?? "",
        ]);

        const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
        sheet["!cols"] = headers.map(h => ({ wch: Math.max(12, Math.min(28, h.length + 4)) }));
        return sheet;
      };

      const [activos, inactivos] = await Promise.all([fetchScope("1"), fetchScope("0")]);
      const ambos = [...activos, ...inactivos].sort((a, b) => String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es"));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, makeSheet(activos), "Activos");
      XLSX.utils.book_append_sheet(workbook, makeSheet(inactivos), "Inactivos");
      XLSX.utils.book_append_sheet(workbook, makeSheet(ambos), "Ambos");
      XLSX.writeFile(workbook, `base-maestra-empleados.xlsx`, { compression: true });
    } finally {
      setExportingEmployees(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      {/* Header */}
      <header style={{
        background: "var(--g66-blue)",
        padding: "0 24px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 8px rgba(59,62,219,0.25)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, display: "block" }} />
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: "-0.2px" }}>BOOK</span>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: 4 }}>
            {(["empleados", "dashboard", "pendientes"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? "#fff" : "transparent",
                  color: activeTab === tab ? "var(--g66-blue)" : "rgba(255,255,255,0.8)",
                  border: "none",
                  borderRadius: 7, padding: "7px 18px", fontWeight: activeTab === tab ? 700 : 500,
                  cursor: "pointer", fontSize: 13, transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {tab === "empleados" ? "Empleados" : tab === "dashboard" ? "Dashboard" : (
                  <>
                    Pendientes
                    {pendingCount > 0 && (
                      <span style={{
                        background: activeTab === "pendientes" ? "var(--g66-red)" : "rgba(239,68,68,0.85)",
                        color: "#fff", borderRadius: 12, fontSize: 11, fontWeight: 700,
                        padding: "1px 7px", lineHeight: "16px",
                      }}>
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: menuOpen ? "#fff" : "rgba(255,255,255,0.12)",
                color: menuOpen ? "var(--g66-blue)" : "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 8, width: 40, height: 40,
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display: "block", width: 16, height: 2,
                  background: menuOpen ? "var(--g66-blue)" : "#fff",
                  borderRadius: 2,
                }} />
              ))}
            </button>

            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 99,
                  background: "#fff", borderRadius: 12, border: "1px solid var(--g66-border)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 210, overflow: "hidden",
                }}>
                  <a href="/contratos" style={{ display: "block", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", textDecoration: "none", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    ⚙️ Contratos
                  </a>
                  <a href="/certificados" style={{ display: "block", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", textDecoration: "none", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    Certificados
                  </a>
                  <a href="/nominas" style={{ display: "block", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", textDecoration: "none", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    Nóminas
                  </a>
                  <a href="/asistencia" style={{ display: "block", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", textDecoration: "none", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    Asistencia
                  </a>
                  <a href="/formularios" style={{ display: "block", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", textDecoration: "none", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    Formularios
                  </a>
                  <button onClick={() => { setShowNew(true); setMenuOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: "var(--g66-text)", background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid var(--g66-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    + Nuevo Empleado
                  </button>
                  <button onClick={handleLogout}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 18px", fontSize: 14, fontWeight: 600, color: "var(--g66-red)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {activeTab === "dashboard" && <Dashboard hideSalaries={hideSalaries} />}
        {activeTab === "pendientes" && (
          <PendingEmployees onEmployeeUpdated={() => { loadFilters(); }} />
        )}
        {activeTab === "empleados" && <>
        {/* Status tabs + stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "stretch" }}>
          {[
            { key: "1", label: "Activos", value: stats.activos, color: "var(--g66-blue)", border: "var(--g66-blue)" },
            { key: "0", label: "Inactivos", value: stats.inactivos, color: "var(--g66-red)", border: "var(--g66-red)" },
            { key: "", label: "Todos", value: stats.activos + stats.inactivos, color: "var(--g66-muted)", border: "var(--g66-border-dark)" },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => { setFilterActivo(s.key); setPage(1); }}
              style={{
                flex: 1, padding: "18px 24px", cursor: "pointer",
                background: filterActivo === s.key ? (s.key === "1" ? "var(--g66-blue)" : s.key === "0" ? "var(--g66-red)" : "#374151") : "#fff",
                border: `2px solid ${filterActivo === s.key ? (s.key === "1" ? "var(--g66-blue)" : s.key === "0" ? "var(--g66-red)" : "#374151") : "var(--g66-border)"}`,
                borderRadius: 12, textAlign: "left", transition: "all 0.15s",
                boxShadow: filterActivo === s.key ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: 11, color: filterActivo === s.key ? "rgba(255,255,255,0.8)" : "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: filterActivo === s.key ? "#fff" : s.color, lineHeight: 1 }}>{s.value}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="g66-card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--g66-muted)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
            <input
              className="g66-input"
              style={{ paddingLeft: 32 }}
              placeholder="Buscar nombre, DNI, cargo, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="g66-input" style={{ flex: "0 0 155px", width: 155 }} value={filterPais} onChange={e => { setFilterPais(e.target.value); setPage(1); }}>
            <option value="">Todos los países</option>
            {paises.map(p => <option key={p} value={p}>{FLAG[p] || ""} {p}</option>)}
          </select>
          <select className="g66-input" style={{ flex: "0 0 175px", width: 175 }} value={filterArea} onChange={e => { setFilterArea(e.target.value); setPage(1); }}>
            <option value="">Todas las áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(search || filterActivo || filterPais || filterArea) && (
            <button className="g66-btn-ghost" style={{ padding: "8px 14px", whiteSpace: "nowrap" }} onClick={() => { setSearch(""); setFilterActivo(""); setFilterPais(""); setFilterArea(""); setPage(1); }}>
              ✕ Limpiar
            </button>
          )}
          <button
            onClick={() => setHideSalaries(v => !v)}
            style={{
              background: hideSalaries ? "#111827" : "#fff",
              color: hideSalaries ? "#fff" : "var(--g66-text2)",
              border: `1px solid ${hideSalaries ? "#111827" : "var(--g66-border-dark)"}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {hideSalaries ? "Mostrar sueldos" : "Ocultar sueldos"}
          </button>
          <button
            onClick={exportEmployeesExcel}
            disabled={exportingEmployees}
            style={{
              background: exportingEmployees ? "var(--g66-border)" : "#ecfdf5",
              color: exportingEmployees ? "var(--g66-muted)" : "#047857",
              border: "1px solid #a7f3d0",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: exportingEmployees ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {exportingEmployees ? "Generando..." : "Descargar Excel"}
          </button>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--g66-muted)" }}>{total} resultado{total !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="g66-card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--g66-border)" }}>
                  {["Nombre", "DNI", "Estado", "Cargo", "Área", "País", "Sueldo", "Moneda", ...(filterActivo !== "0" ? ["Jefatura", "F. Ingreso"] : ["F. Término"])].map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", background: "#f9fafb", borderBottom: "2px solid var(--g66-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(31,41,55,0.4)" }}>
                      {Array.from({ length: filterActivo !== "0" ? 9 : 8 }).map((_, j) => (
                        <td key={j} style={{ padding: "14px 16px" }}>
                          <div style={{ height: 14, borderRadius: 4, background: "var(--g66-border)", animation: "pulse 1.5s infinite", width: j === 0 ? 160 : 80 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 48, textAlign: "center", color: "var(--g66-muted)", fontSize: 15 }}>Sin resultados para los filtros aplicados</td></tr>
                ) : employees.map(emp => (
                  <tr
                    key={emp.id}
                    className="row-hover"
                    style={{ borderBottom: "1px solid rgba(31,41,55,0.5)", transition: "background 0.1s" }}
                    onClick={() => setSelected(emp)}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: "var(--g66-blue-light)",
                          border: "1px solid var(--g66-blue-mid)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                          color: "var(--g66-blue)",
                          flexShrink: 0,
                        }}>
                          {initials(emp.nombre)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{emp.nombre}</div>
                          <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>
                            {emp.email_global !== "NA" ? emp.email_global : emp.email_personal !== "NA" ? emp.email_personal : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--g66-text2)", fontFamily: "monospace" }}>{emp.dni}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={emp.activo ? "badge-active" : "badge-inactive"}>{emp.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--g66-text2)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {emp.cargo !== "NA" ? emp.cargo : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--g66-text2)" }}>{emp.area !== "NA" ? emp.area : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{FLAG[emp.pais] || ""} {emp.pais !== "NA" ? emp.pais : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--g66-blue)", fontWeight: 600, textAlign: "right" }}>
                      {hideSalaries ? "••••••" : fmtAmount(emp.sueldo_local || emp.salario_bruto)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {emp.moneda && emp.moneda !== "NA"
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-blue)", background: "var(--g66-blue-light)", border: "1px solid var(--g66-blue-mid)", borderRadius: 6, padding: "2px 8px" }}>{emp.moneda}</span>
                        : <span style={{ color: "var(--g66-muted)" }}>—</span>}
                    </td>
                    {filterActivo !== "0" ? (
                      <>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>
                          {!emp.activo || emp.area === "Directorio" || emp.jefatura === "Directorio"
                            ? <span style={{ color: "var(--g66-muted)" }}>—</span>
                            : emp.jefatura && emp.jefatura !== "NA" && emp.jefatura !== ""
                                ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ color: "var(--g66-text2)" }}>{emp.jefatura}</span>
                                    {!activeManagerEmails.has(emp.jefatura) && activeManagerEmails.size > 0 && (
                                      <span title="Jefatura inactiva" style={{ color: "var(--g66-red)", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>⚠</span>
                                    )}
                                  </span>
                                : <span style={{ color: "var(--g66-red)", fontWeight: 600, fontSize: 12 }}>⚠ Falta asignar jefe</span>
                          }
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--g66-muted)", whiteSpace: "nowrap" }}>
                          {fmtDate(emp.fecha_ingreso)}
                        </td>
                      </>
                    ) : (
                      <td style={{ padding: "12px 16px", fontSize: 12, whiteSpace: "nowrap" }}>
                        {emp.fecha_termino && emp.fecha_termino !== "NA"
                          ? <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 12 }}>{fmtDate(emp.fecha_termino)}</span>
                          : <span style={{ color: "var(--g66-muted)" }}>—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--g66-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--g66-muted)" }}>
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total} empleados
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="g66-btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
                <span style={{ padding: "0 8px", color: "var(--g66-muted)", fontSize: 13 }}>Pág {page} / {totalPages}</span>
                <button className="g66-btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
              </div>
            </div>
          )}
        </div>
        </>}
      </main>

      {selected && (
        <EmployeeModal
          employee={selected}
          hideSalaries={hideSalaries}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            setSelected(updated);
            setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
            loadFilters();
          }}
        />
      )}

      {showNew && (
        <NewEmployeeModal
          onClose={() => setShowNew(false)}
          onCreate={(emp) => {
            setShowNew(false);
            fetchEmployees();
            loadFilters();
            setSelected(emp);
          }}
        />
      )}

      <ChatWidget />
    </div>
  );
}
