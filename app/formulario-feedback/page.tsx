"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type EmployeeOption = {
  id: number;
  nombre: string;
  email_global?: string | null;
  email_personal?: string | null;
  cargo?: string | null;
};

type EmployeeSearchOption = EmployeeOption & { email: string };

function cleanEmail(value?: string | null) {
  const email = String(value || "").trim();
  if (!email || email.toUpperCase() === "NA") return "";
  return email;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0 }}>
      {children}{required ? <span style={{ color: "var(--g66-blue)", marginLeft: 4 }}>*</span> : null}
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <FieldLabel required>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={6}
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 136,
          border: "1px solid var(--g66-border)",
          borderRadius: 8,
          padding: "12px 14px",
          background: "#fff",
          color: "var(--g66-text)",
          fontSize: 14,
          lineHeight: 1.5,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function SearchableEmployeeSelect({
  label,
  value,
  onChange,
  options,
  loading,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: EmployeeSearchOption[];
  loading: boolean;
  placeholder: string;
}) {
  const selected = options.find(option => option.email === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    const option = options.find(item => item.email === value);
    setQuery(option ? `${option.nombre} · ${option.email}` : value);
  }, [options, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = options
    .filter(option => {
      if (!normalizedQuery) return true;
      return `${option.nombre} ${option.email} ${option.cargo || ""}`.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 12);

  const choose = (option: EmployeeSearchOption) => {
    onChange(option.email);
    setQuery(`${option.nombre} · ${option.email}`);
    setOpen(false);
  };

  const commitTypedEmail = () => {
    const typed = query.trim().toLowerCase();
    if (!typed) return;
    const match = options.find(option => option.email.toLowerCase() === typed);
    if (match) choose(match);
  };

  return (
    <div style={{ position: "relative" }}>
      <FieldLabel required>{label}</FieldLabel>
      <input
        value={query}
        disabled={loading}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          commitTypedEmail();
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={event => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        placeholder={loading ? "Cargando..." : placeholder}
        style={{
          width: "100%",
          border: "1px solid var(--g66-border)",
          borderRadius: 8,
          padding: "11px 12px",
          background: loading ? "#f8fafc" : "#fff",
          color: "var(--g66-text)",
          fontSize: 14,
          boxSizing: "border-box",
          outline: "none",
        }}
      />
      {open && !loading ? (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 16px 38px rgba(15,23,42,0.16)", zIndex: 20, maxHeight: 320, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", color: "var(--g66-muted)", fontSize: 13, fontWeight: 700 }}>Sin resultados</div>
          ) : filtered.map(option => (
            <button
              key={`${label}-${option.id}`}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                choose(option);
              }}
              style={{
                width: "100%",
                display: "block",
                textAlign: "left",
                border: 0,
                background: selected?.email === option.email ? "rgba(59,62,219,0.08)" : "#fff",
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #eef2f7",
              }}
            >
              <div style={{ color: "var(--g66-text)", fontWeight: 900, fontSize: 13 }}>{option.nombre}</div>
              <div style={{ color: "var(--g66-muted)", fontSize: 12, marginTop: 2 }}>{option.email}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FormularioFeedbackPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    evaluador_email: "",
    evaluado_email: "",
    stop: "",
    start: "",
    continue: "",
    aprueba_continuidad: "",
  });

  useEffect(() => {
    async function loadEmployees() {
      setLoadingEmployees(true);
      const res = await fetch("/api/employees?activo=1&limit=1000");
      const data = await res.json();
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      setLoadingEmployees(false);
    }
    loadEmployees().catch(() => {
      setError("No se pudieron cargar los empleados activos.");
      setLoadingEmployees(false);
    });
  }, []);

  const employeeOptions = useMemo(() => {
    return employees
      .map(employee => {
        const email = cleanEmail(employee.email_global) || cleanEmail(employee.email_personal);
        return { ...employee, email };
      })
      .filter(employee => employee.email)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [employees]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.evaluador_email) return setError("Selecciona el mail del evaluador.");
    if (!form.evaluado_email) return setError("Selecciona el mail del evaluado.");
    if (!form.stop.trim()) return setError("Completa Stop.");
    if (!form.start.trim()) return setError("Completa Start.");
    if (!form.continue.trim()) return setError("Completa Continue.");
    if (!form.aprueba_continuidad) return setError("Indica si se aprueba continuidad.");

    setSubmitting(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "No se pudo guardar el feedback.");
      return;
    }

    setDone(true);
    setForm({ evaluador_email: "", evaluado_email: "", stop: "", start: "", continue: "", aprueba_continuidad: "" });
  };

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
            <span style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 13 }}>Formulario feedback</span>
          </div>
          <Link href="/formularios" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Formularios
          </Link>
        </div>
      </header>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 56px" }}>
        <section style={{ marginBottom: 24 }}>
          <div style={{ color: "var(--g66-muted)", fontSize: 13, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>Primer feedback</div>
          <h1 style={{ margin: 0, color: "var(--g66-text)", fontSize: 34, lineHeight: 1.1 }}>Feedback líder</h1>
        </section>

        <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--g66-shadow)" }}>
          <div style={{ padding: 22, borderBottom: "1px solid var(--g66-border)", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
            <SearchableEmployeeSelect
              label="Mail del evaluador"
              value={form.evaluador_email}
              onChange={set("evaluador_email")}
              options={employeeOptions}
              loading={loadingEmployees}
              placeholder="Buscar por nombre o mail"
            />
            <SearchableEmployeeSelect
              label="Mail del evaluado"
              value={form.evaluado_email}
              onChange={set("evaluado_email")}
              options={employeeOptions}
              loading={loadingEmployees}
              placeholder="Buscar por nombre o mail"
            />
          </div>

          <div style={{ padding: 22, display: "grid", gap: 18 }}>
            <Textarea label="Stop" value={form.stop} onChange={set("stop")} placeholder="Qué debe dejar de hacer o reducir." />
            <Textarea label="Start" value={form.start} onChange={set("start")} placeholder="Qué debe empezar a hacer." />
            <Textarea label="Continue" value={form.continue} onChange={set("continue")} placeholder="Qué debe seguir haciendo." />

            <div>
              <FieldLabel required>Se aprueba continuidad</FieldLabel>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No" },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set("aprueba_continuidad")(option.value)}
                    style={{
                      border: form.aprueba_continuidad === option.value ? "1px solid var(--g66-blue)" : "1px solid var(--g66-border)",
                      background: form.aprueba_continuidad === option.value ? "rgba(59,62,219,0.09)" : "#fff",
                      color: form.aprueba_continuidad === option.value ? "var(--g66-blue)" : "var(--g66-text)",
                      borderRadius: 8,
                      padding: "10px 18px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "11px 13px", fontWeight: 800, fontSize: 13 }}>{error}</div> : null}
            {done ? <div style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 8, padding: "11px 13px", fontWeight: 800, fontSize: 13 }}>Feedback guardado correctamente.</div> : null}

            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--g66-border)", paddingTop: 18 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ background: "var(--g66-blue)", color: "#fff", border: 0, borderRadius: 8, padding: "12px 20px", fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Guardando..." : "Guardar feedback"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
