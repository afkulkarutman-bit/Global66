"use client";

import { useEffect, useMemo, useState } from "react";

type OnboardingResponse = Record<string, unknown> & {
  id?: string;
  dni?: string;
  nombre?: string;
  cargo?: string;
  area?: string;
  pais?: string;
  activo?: number;
  email_personal?: string;
  email_global?: string;
  onboarding_fecha?: string;
  onboarding_completado?: number;
};

type Field = { key: string; label: string };
type Section = { title: string; fields: Field[] };

const SECTIONS: Section[] = [
  {
    title: "Identificacion",
    fields: [
      { key: "nombre", label: "Nombre completo" },
      { key: "dni", label: "RUT / DNI / Pasaporte" },
      { key: "pais", label: "Pais" },
      { key: "nacionalidad", label: "Nacionalidad" },
      { key: "fecha_nacimiento", label: "Fecha nacimiento" },
      { key: "estado_civil", label: "Estado civil" },
    ],
  },
  {
    title: "Contacto y direccion",
    fields: [
      { key: "domicilio_completo", label: "Direccion completa" },
      { key: "domicilio", label: "Domicilio" },
      { key: "pais_ciudad_comuna", label: "Pais, ciudad y comuna" },
      { key: "telefono", label: "Telefono" },
      { key: "email_personal", label: "Mail personal" },
      { key: "email_global", label: "Mail Global66" },
    ],
  },
  {
    title: "Salud y familia",
    fields: [
      { key: "prevision", label: "Isapre / Fonasa" },
      { key: "afp", label: "AFP" },
      { key: "alergias", label: "Alergias" },
      { key: "alimentacion_especial", label: "Alimentacion especial" },
      { key: "tiene_hijos", label: "Tiene hijos" },
      { key: "fechas_hijos", label: "Fechas hijos" },
      { key: "discapacidad", label: "Discapacidad" },
      { key: "carnet_discapacidad", label: "Carnet discapacidad" },
      { key: "contacto_emergencia", label: "Contacto emergencia" },
    ],
  },
  {
    title: "Banco",
    fields: [
      { key: "banco", label: "Banco" },
      { key: "tipo_cuenta", label: "Tipo cuenta" },
      { key: "numero_cuenta", label: "Numero cuenta" },
      { key: "rut_cuenta", label: "RUT titular" },
      { key: "email_cuenta", label: "Mail titular" },
      { key: "nombre_cuenta", label: "Nombre titular" },
    ],
  },
  {
    title: "Wallet Global66",
    fields: [
      { key: "usuario_wallet", label: "Usuario wallet" },
      { key: "usuario_global66", label: "Usuario Global66" },
    ],
  },
  {
    title: "Documentos",
    fields: [
      { key: "foto_path", label: "Foto" },
      { key: "doc_ci", label: "CI" },
      { key: "doc_isapre", label: "Isapre / Fonasa" },
      { key: "doc_afp", label: "AFP" },
      { key: "doc_estudios", label: "Estudios" },
      { key: "doc_antecedentes", label: "Antecedentes" },
      { key: "doc_finiquito", label: "Finiquito" },
      { key: "doc_visa", label: "Visa" },
      { key: "doc_cv", label: "CV" },
    ],
  },
  {
    title: "Datos base empleado",
    fields: [
      { key: "cargo", label: "Cargo" },
      { key: "area", label: "Area" },
      { key: "centro_costo", label: "Centro costo" },
      { key: "tipo_contrato", label: "Tipo contrato" },
      { key: "jefatura", label: "Jefatura" },
      { key: "fecha_ingreso", label: "Fecha ingreso" },
      { key: "fecha_termino", label: "Fecha termino" },
      { key: "moneda", label: "Moneda" },
      { key: "sueldo_local", label: "Sueldo local" },
      { key: "presencialidad", label: "Presencialidad" },
      { key: "activo", label: "Activo" },
    ],
  },
  {
    title: "Estado onboarding",
    fields: [
      { key: "onboarding_completado", label: "Completado" },
      { key: "onboarding_fecha", label: "Fecha respuesta" },
    ],
  },
];

const KNOWN_KEYS = new Set(SECTIONS.flatMap(section => section.fields.map(field => field.key)));

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "number") {
    if (value === 1) return "Si";
    if (value === 0) return "No";
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function isFilePath(value: unknown) {
  return typeof value === "string" && value.startsWith("/uploads/");
}

function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function FieldValue({ value }: { value: unknown }) {
  if (isFilePath(value)) {
    return (
      <a href={String(value)} target="_blank" rel="noreferrer" style={{ color: "#1A3DF5", fontWeight: 800, textDecoration: "none" }}>
        Ver archivo
      </a>
    );
  }
  return <>{displayValue(value)}</>;
}

function DataSection({ title, fields, row }: { title: string; fields: Field[]; row: OnboardingResponse }) {
  return (
    <section style={{ border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "10px 12px", background: "var(--g66-bg)", fontSize: 12, fontWeight: 900, color: "var(--g66-text)" }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
        {fields.map(field => (
          <div key={field.key} style={{ padding: "10px 12px", borderTop: "1px solid var(--g66-border)", minHeight: 54 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--g66-muted)", marginBottom: 4 }}>
              {field.label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: displayValue(row[field.key]) === "Sin dato" ? "var(--g66-muted)" : "var(--g66-text)", overflowWrap: "anywhere" }}>
              <FieldValue value={row[field.key]} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RespuestaFormularioPage() {
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pais, setPais] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (pais) params.set("pais", pais);
      const res = await fetch(`/api/onboarding/responses?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar las respuestas");
        setResponses([]);
      } else {
        setResponses(data.responses ?? []);
      }
      setLoading(false);
    };
    const timeout = window.setTimeout(load, 220);
    return () => window.clearTimeout(timeout);
  }, [search, pais]);

  useEffect(() => {
    if (responses.length === 0) {
      setSelectedId("");
      return;
    }
    if (!responses.some(row => String(row.id ?? row.dni) === selectedId)) {
      setSelectedId(String(responses[0].id ?? responses[0].dni));
    }
  }, [responses, selectedId]);

  const selected = responses.find(row => String(row.id ?? row.dni) === selectedId) ?? responses[0] ?? null;

  const countries = useMemo(() => {
    return Array.from(new Set(responses.map(row => String(row.pais ?? "")).filter(Boolean))).sort();
  }, [responses]);

  const stats = useMemo(() => {
    const completed = responses.filter(row => Number(row.onboarding_completado ?? 0) === 1).length;
    const withDocs = responses.filter(row =>
      ["foto_path", "doc_ci", "doc_isapre", "doc_afp", "doc_estudios", "doc_antecedentes", "doc_finiquito", "doc_visa", "doc_cv"]
        .some(key => Boolean(row[key]))
    ).length;
    return { total: responses.length, completed, withDocs };
  }, [responses]);

  const extraFields = selected
    ? Object.keys(selected)
        .filter(key => !KNOWN_KEYS.has(key))
        .filter(key => selected[key] !== null && selected[key] !== undefined && selected[key] !== "")
        .sort()
        .map(key => ({ key, label: key.replaceAll("_", " ") }))
    : [];

  return (
    <main style={{ minHeight: "100vh", background: "#f5f6fa", color: "var(--g66-text)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Global66" style={{ height: 34, borderRadius: 6, display: "block" }} />
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.35)" }} />
          <div>
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 900, margin: 0 }}>Respuesta formulario</h1>
            <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 2 }}>Onboarding Global66</div>
          </div>
        </div>
        <a href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 800, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "8px 12px" }}>
          Base maestra
        </a>
      </header>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 20 }}>
        <aside style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: "calc(100vh - 112px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "Respuestas", value: stats.total },
              { label: "Completas", value: stats.completed },
              { label: "Con docs", value: stats.withDocs },
            ].map(card => (
              <div key={card.label} style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: "var(--g66-muted)", fontWeight: 800, textTransform: "uppercase" }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--g66-blue)", marginTop: 2 }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nombre, DNI, mail, cargo..."
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "9px 10px", fontSize: 13, boxSizing: "border-box", outline: "none" }}
            />
            <select
              value={pais}
              onChange={e => setPais(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "9px 10px", fontSize: 13, background: "#fff", boxSizing: "border-box" }}
            >
              <option value="">Todos los paises</option>
              {countries.map(country => <option key={country} value={country}>{country}</option>)}
            </select>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", flex: 1, minHeight: 260 }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--g66-border)", fontSize: 12, fontWeight: 900 }}>
              Personas
            </div>
            <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
              {loading && <div style={{ padding: 16, fontSize: 13, color: "var(--g66-muted)" }}>Cargando...</div>}
              {!loading && error && <div style={{ padding: 16, fontSize: 13, color: "#dc2626", fontWeight: 700 }}>{error}</div>}
              {!loading && !error && responses.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--g66-muted)" }}>No hay respuestas.</div>}
              {!loading && !error && responses.map(row => {
                const id = String(row.id ?? row.dni);
                const active = id === String(selected?.id ?? selected?.dni);
                const hayMatch = normalizedText(`${row.nombre} ${row.dni} ${row.email_personal} ${row.email_global} ${row.cargo}`).includes(normalizedText(search));
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid var(--g66-border)",
                      background: active ? "#eef2ff" : hayMatch ? "#fff" : "#fafafa",
                      padding: "11px 12px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: "var(--g66-text)", overflowWrap: "anywhere" }}>{displayValue(row.nombre)}</div>
                    <div style={{ fontSize: 11, color: "var(--g66-muted)", marginTop: 3 }}>{displayValue(row.dni)} · {displayValue(row.pais)}</div>
                    <div style={{ fontSize: 11, color: "var(--g66-muted)", marginTop: 3 }}>{displayValue(row.onboarding_fecha)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>
          {!selected ? (
            <div style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 10, padding: 24, color: "var(--g66-muted)" }}>
              Selecciona una respuesta para ver el detalle.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 10, padding: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 950, color: "var(--g66-text)", marginBottom: 4 }}>{displayValue(selected.nombre)}</div>
                  <div style={{ fontSize: 13, color: "var(--g66-muted)", fontWeight: 700 }}>
                    {displayValue(selected.dni)} · {displayValue(selected.cargo)} · {displayValue(selected.pais)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ background: Number(selected.onboarding_completado ?? 0) === 1 ? "#dcfce7" : "#fef3c7", color: Number(selected.onboarding_completado ?? 0) === 1 ? "#166534" : "#92400e", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900 }}>
                    {Number(selected.onboarding_completado ?? 0) === 1 ? "Completado" : "Pendiente"}
                  </span>
                  <span style={{ background: "#eef2ff", color: "var(--g66-blue)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900 }}>
                    {displayValue(selected.onboarding_fecha)}
                  </span>
                </div>
              </div>

              {SECTIONS.map(section => (
                <DataSection key={section.title} title={section.title} fields={section.fields} row={selected} />
              ))}

              {extraFields.length > 0 && (
                <DataSection title="Todos los otros campos guardados" fields={extraFields} row={selected} />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
