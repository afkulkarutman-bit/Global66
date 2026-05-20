"use client";
import { useEffect, useState, useRef } from "react";

type PendingEmployee = {
  id: number;
  dni: string;
  nombre: string;
  cargo: string;
  area: string;
  jefatura: string;
  email_global: string;
  email_personal: string;
  tipo_contrato: string;
  pais: string;
  moneda: string;
  sueldo_local: number | null;
  salario_bruto: number | null;
  domicilio: string;
  sexo: string;
  fecha_ingreso: string;
  onboarding_completado: number;
  usuario_wallet?: string | null;
};

type Manager = { nombre: string; email_global: string };

const STRING_FIELDS = [
  { key: "cargo",           label: "Cargo" },
  { key: "area",            label: "Área" },
  { key: "jefatura",        label: "Jefatura" },
  { key: "email_global",    label: "Correo Global66" },
  { key: "email_personal",  label: "Correo Personal" },
  { key: "tipo_contrato",   label: "Tipo de Contrato" },
  { key: "domicilio",       label: "Dirección" },
  { key: "usuario_wallet",  label: "Usuario Wallet" },
] as const;

function isMissing(val: string | null | undefined) {
  return !val || val === "NA" || val === "";
}

function missingFields(emp: PendingEmployee) {
  const missing: { key: string; label: string }[] = STRING_FIELDS.filter(f => isMissing(emp[f.key as keyof PendingEmployee] as string));
  if (emp.sueldo_local === null && emp.salario_bruto === null) {
    missing.push({ key: "sueldo", label: "Sueldo" });
  }
  if (!emp.sexo || emp.sexo === "NA" || emp.sexo === "") {
    missing.push({ key: "sexo", label: "Género" });
  }
  return missing;
}

function initials(nombre: string) {
  return nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function PendingEmployees({ onEmployeeUpdated }: { onEmployeeUpdated?: () => void }) {
  const [pending, setPending] = useState<PendingEmployee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<PendingEmployee>>({});
  const [saving, setSaving] = useState(false);
  const [jefSearch, setJefSearch] = useState("");
  const [showJefList, setShowJefList] = useState(false);
  const [jefPos, setJefPos] = useState({ top: 0, left: 0, width: 0 });
  const jefInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/employees/pending").then(r => r.json()),
      fetch("/api/employees/managers").then(r => r.json()),
    ]).then(([p, m]) => {
      setPending(p);
      setManagers(m);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const startEdit = (emp: PendingEmployee) => {
    setEditing(emp.id);
    setForm({ ...emp });
    const match = managers.find(m => m.email_global === emp.jefatura || m.nombre === emp.jefatura);
    setJefSearch(match ? match.nombre : (isMissing(emp.jefatura) ? "" : emp.jefatura));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/employees/${editing}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, activo: true }),
    });
    setSaving(false);
    setEditing(null);
    load();
    onEmployeeUpdated?.();
  };

  const filteredManagers = jefSearch.trim().length > 0
    ? managers.filter(m =>
        m.nombre.toLowerCase().includes(jefSearch.toLowerCase()) ||
        m.email_global.toLowerCase().includes(jefSearch.toLowerCase())
      )
    : managers;

  const inp = (field: keyof PendingEmployee, label: string, type = "text") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        className="g66-input" type={type}
        value={(form[field] as string) ?? ""}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      />
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--g66-muted)" }}>
      Cargando pendientes…
    </div>
  );

  if (pending.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--g66-text)" }}>Todo al día</div>
      <div style={{ fontSize: 14, color: "var(--g66-muted)" }}>Todos los empleados activos tienen sus datos completos.</div>
    </div>
  );

  const filtered = pending.filter(emp =>
    search.trim() === "" ||
    emp.nombre.toLowerCase().includes(search.toLowerCase()) ||
    emp.dni.toLowerCase().includes(search.toLowerCase()) ||
    emp.cargo?.toLowerCase().includes(search.toLowerCase()) ||
    emp.area?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--g66-text)" }}>Pendientes de revisión</div>
          <div style={{ fontSize: 13, color: "var(--g66-muted)", marginTop: 2 }}>
            {pending.length} empleado{pending.length !== 1 ? "s" : ""} activo{pending.length !== 1 ? "s" : ""} con datos incompletos
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--g66-muted)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
            <input
              className="g66-input"
              style={{ paddingLeft: 32, width: 240 }}
              placeholder="Buscar nombre, DNI, cargo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ padding: "8px 16px", background: "var(--g66-red-bg)", border: "1px solid var(--g66-red-border)", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "var(--g66-red)" }}>
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && search && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--g66-muted)", fontSize: 14 }}>
            Sin resultados para "{search}"
          </div>
        )}
        {filtered.map(emp => {
          const missing = missingFields(emp);
          const isEditing = editing === emp.id;

          return (
            <div key={emp.id} className="g66-card" style={{ padding: "20px 24px", border: isEditing ? "2px solid var(--g66-blue)" : "1px solid var(--g66-border)" }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: isEditing ? 20 : 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "var(--g66-blue-light)", border: "2px solid var(--g66-blue)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "var(--g66-blue)",
                }}>
                  {initials(emp.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.nombre}</div>
                  <div style={{ fontSize: 12, color: "var(--g66-muted)" }}>{emp.dni}</div>
                </div>
                {emp.onboarding_completado === 1 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 10px" }}>
                    Formulario llenado
                  </span>
                )}
                {!isEditing && (
                  <button
                    onClick={() => startEdit(emp)}
                    className="g66-btn"
                    style={{ padding: "7px 18px", fontSize: 13 }}
                  >
                    Completar datos
                  </button>
                )}
              </div>

              {/* Missing tags */}
              {!isEditing && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {missing.map(f => (
                    <span key={f.key} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)" }}>
                      ✕ {f.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {inp("cargo", "Cargo")}
                    {inp("area", "Área")}
                    {inp("email_global", "Correo Global66")}
                    {inp("email_personal", "Correo Personal")}
                    {inp("tipo_contrato", "Tipo de Contrato")}
                    {inp("fecha_ingreso", "Fecha de Ingreso", "date")}
                    <div>
                      <label style={labelStyle}>Género</label>
                      <select className="g66-input" value={form.sexo || "NA"} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                        <option value="NA">Sin especificar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle }}>Moneda</label>
                      <select className="g66-input" value={form.moneda || "NA"} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                        {["NA","CLP","COP","PEN","USD","ARS","EUR"].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Sueldo Local</label>
                      <input className="g66-input" type="number"
                        value={form.sueldo_local ?? ""}
                        onChange={e => setForm(f => ({ ...f, sueldo_local: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    {inp("domicilio", "Dirección")}
                    {inp("usuario_wallet", "Usuario Wallet")}
                    {/* Jefatura con buscador */}
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Jefatura</label>
                      <div style={{ position: "relative" }}>
                        <input
                          ref={jefInputRef}
                          className="g66-input"
                          type="text"
                          placeholder="Buscar por apellido... (dejar vacío = sin jefe)"
                          value={jefSearch}
                          onChange={e => { setJefSearch(e.target.value); setShowJefList(true); if (!e.target.value) setForm(f => ({ ...f, jefatura: "" })); }}
                          onFocus={() => {
                            if (jefInputRef.current) {
                              const r = jefInputRef.current.getBoundingClientRect();
                              setJefPos({ top: r.bottom + 4, left: r.left, width: r.width });
                            }
                            setShowJefList(true);
                          }}
                          onBlur={() => setTimeout(() => setShowJefList(false), 180)}
                          style={{ borderColor: (!form.jefatura || form.jefatura === "NA" || form.jefatura === "") ? "var(--g66-red)" : undefined, paddingRight: jefSearch ? 32 : undefined }}
                        />
                        {jefSearch && (
                          <button type="button" onMouseDown={() => { setJefSearch(""); setForm(f => ({ ...f, jefatura: "" })); }}
                            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--g66-muted)", fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
                        )}
                      </div>
                      {(!form.jefatura || form.jefatura === "NA" || form.jefatura === "") && (
                        <div style={{ fontSize: 11, color: "var(--g66-red)", marginTop: 3 }}>Sin jefe asignado</div>
                      )}
                      {showJefList && filteredManagers.length > 0 && (
                        <div style={{ position: "fixed", top: jefPos.top, left: jefPos.left, width: jefPos.width, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 9999, maxHeight: 240, overflowY: "auto" }}>
                          {filteredManagers.slice(0, 10).map(m => (
                            <div key={m.email_global}
                              onMouseDown={() => { setForm(f => ({ ...f, jefatura: m.email_global })); setJefSearch(m.nombre); setShowJefList(false); }}
                              style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid var(--g66-border)" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                            >
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nombre}</div>
                              <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>{m.email_global}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="g66-btn-ghost" onClick={() => { setEditing(null); setJefSearch(""); }}>Cancelar</button>
                    <button className="g66-btn" disabled={saving} onClick={handleSave}>
                      {saving ? "Guardando…" : "Guardar y completar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--g66-muted)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.5px",
  display: "block", marginBottom: 4,
};
