"use client";
import { useState, useEffect, useRef } from "react";

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
  usuario_wallet?: string | null;
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
  const totalDays = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
  if (totalDays < 0) return "—";
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  if (years >= 1) return months > 0 ? `${years} año${years !== 1 ? "s" : ""} y ${months} mes${months !== 1 ? "es" : ""}` : `${years} año${years !== 1 ? "s" : ""}`;
  if (months >= 1) return `${months} mes${months !== 1 ? "es" : ""}`;
  return `${totalDays} día${totalDays !== 1 ? "s" : ""}`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val || val === "NA") return "—";
  const v = val.trim().slice(0, 10);
  const [y, m, d] = v.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return val;
}

function fmtAmount(val: number | null) {
  if (!val) return "NA";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);
}

function initials(nombre: string) {
  return nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  const display = value && value !== "NA" ? value : "—";
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: display === "—" ? "var(--g66-muted)" : "var(--g66-text)", fontFamily: mono ? "monospace" : undefined }}>{display}</div>
    </div>
  );
}

type EmployeeDocs = {
  foto_path?: string;
  doc_ci?: string;
  doc_cv?: string;
  doc_estudios?: string;
  doc_antecedentes?: string;
  doc_finiquito?: string;
  doc_isapre?: string;
  doc_afp?: string;
  doc_visa?: string;
};

const DOCS: { key: keyof EmployeeDocs; label: string }[] = [
  { key: "foto_path",        label: "Foto" },
  { key: "doc_ci",           label: "Cédula / RUT" },
  { key: "doc_cv",           label: "CV" },
  { key: "doc_estudios",     label: "Certificado de Estudios" },
  { key: "doc_antecedentes", label: "Antecedentes" },
  { key: "doc_finiquito",    label: "Finiquito Anterior" },
  { key: "doc_isapre",       label: "Isapre" },
  { key: "doc_afp",          label: "AFP" },
  { key: "doc_visa",         label: "Visa" },
];

export default function EmployeeModal({ employee, onClose, onUpdate, hideSalaries = false }: {
  employee: Employee;
  onClose: () => void;
  onUpdate: (emp: Employee) => void;
  hideSalaries?: boolean;
}) {
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...employee });
  const [managers, setManagers] = useState<{ nombre: string; email_global: string }[]>([]);
  const [jefSearch, setJefSearch] = useState("");
  const [showJefList, setShowJefList] = useState(false);
  const jefInputRef = useRef<HTMLInputElement>(null);
  const [jefPos, setJefPos] = useState({ top: 0, left: 0, width: 0 });
  const [modalTab, setModalTab] = useState<"perfil" | "fichas">("perfil");
  const [docs, setDocs] = useState<EmployeeDocs | null>(null);

  useEffect(() => {
    fetch("/api/employees/managers").then(r => r.json()).then((data: { nombre: string; email_global: string }[]) => {
      setManagers(data);
      const currentJef = employee.jefatura;
      if (currentJef && currentJef !== "NA" && currentJef !== "" && currentJef !== "Directorio") {
        const match = data.find(m => m.email_global === currentJef || m.nombre === currentJef);
        if (match) {
          setJefSearch(match.nombre);
          setForm(f => ({ ...f, jefatura: match.email_global }));
        } else {
          setJefSearch(currentJef);
        }
      }
    });
  }, [employee.jefatura]);

  useEffect(() => {
    if (modalTab === "fichas" && !docs) {
      fetch(`/api/employees/${employee.id}`).then(r => r.json()).then(setDocs);
    }
  }, [modalTab, docs, employee.id]);

  const filteredManagers = jefSearch.trim().length > 0
    ? managers.filter(m =>
        m.nombre.toLowerCase().includes(jefSearch.toLowerCase()) ||
        m.email_global.toLowerCase().includes(jefSearch.toLowerCase())
      )
    : managers;

  const handleToggle = async () => {
    setToggling(true);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !employee.activo }),
    });
    const updated = await res.json();
    setToggling(false);
    onUpdate(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, activo: form.activo === 1 || (form.activo as unknown as boolean) === true }),
    });
    const updated = await res.json();
    setSaving(false);
    setEditing(false);
    onUpdate(updated);
  };

  const inp = (field: keyof Employee, label: string, type = "text") => (
    <div>
      <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>{label}</label>
      <input
        className="g66-input"
        type={type}
        value={(form[field] as string | number) ?? ""}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      />
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--g66-card)", border: "1px solid var(--g66-border)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Modal Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g66-border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: "var(--g66-blue-light)",
            border: "2px solid var(--g66-blue)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700,
            color: "var(--g66-blue)",
          }}>
            {initials(employee.nombre)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{employee.nombre}</div>
            <div style={{ fontSize: 13, color: "var(--g66-muted)" }}>
              {employee.cargo !== "NA" ? employee.cargo : ""}{employee.cargo !== "NA" && employee.pais !== "NA" ? " · " : ""}
              {FLAG[employee.pais] || ""} {employee.pais !== "NA" ? employee.pais : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <span className={employee.activo ? "badge-active" : "badge-inactive"} style={{ fontSize: 13, padding: "4px 14px" }}>
              {employee.activo ? "Activo" : "Inactivo"}
            </span>
            <button
              onClick={() => { if (editing) { setEditing(false); setForm({ ...employee }); } else setEditing(true); }}
              className="g66-btn-ghost"
              style={{ padding: "7px 14px", fontSize: 13 }}
            >
              {editing ? "Cancelar" : "✏️ Editar"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--g66-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--g66-border)", paddingLeft: 24, flexShrink: 0 }}>
          {(["perfil", "fichas"] as const).map(t => (
            <button key={t} onClick={() => setModalTab(t)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 20px", fontSize: 13, fontWeight: modalTab === t ? 700 : 500,
              color: modalTab === t ? "var(--g66-blue)" : "var(--g66-muted)",
              borderBottom: modalTab === t ? "2px solid var(--g66-blue)" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s",
            }}>
              {t === "perfil" ? "Perfil" : "Fichas"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px" }}>
          {modalTab === "fichas" ? (
            <div>
              {!docs ? (
                <div style={{ color: "var(--g66-muted)", textAlign: "center", padding: 40 }}>Cargando documentos…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {DOCS.map(({ key, label }) => {
                    const path = docs[key];
                    const uploaded = !!path && path !== "" && path !== "NA";
                    return (
                      <div key={key} style={{
                        border: `1px solid ${uploaded ? "var(--g66-border)" : "var(--g66-border)"}`,
                        borderRadius: 10, padding: "14px 16px",
                        background: uploaded ? "#fff" : "#f9fafb",
                        display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                        {uploaded ? (
                          <a href={path} target="_blank" rel="noopener noreferrer" style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 13, fontWeight: 600, color: "var(--g66-blue)",
                            textDecoration: "none",
                          }}>
                            Ver documento →
                          </a>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--g66-muted)" }}>Sin documento</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {inp("nombre", "Nombre completo")}
              {inp("dni", "DNI / RUT / CI", "text")}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Estado</label>
                <select className="g66-input" value={form.activo ? "1" : "0"} onChange={e => setForm(f => ({ ...f, activo: parseInt(e.target.value) }))}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Sexo</label>
                <select className="g66-input" value={form.sexo || "NA"} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                  <option value="NA">NA</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              {inp("cargo", "Cargo")}
              {inp("area", "Área")}
              {inp("centro_costo", "Centro de Costo")}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Presencialidad</label>
                <select className="g66-input" value={form.presencialidad || "4x1"} onChange={e => setForm(f => ({ ...f, presencialidad: e.target.value }))}>
                  {["4x1","3x2","2x3","1x4","Remoto","Presencial","Flexible"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {inp("pais", "País")}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Moneda</label>
                <select className="g66-input" value={form.moneda || "NA"} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  {["NA","CLP","COP","PEN","USD","ARS","EUR"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Sueldo Bruto</label>
                <input className="g66-input" type="number" value={form.sueldo_local ?? ""} onChange={e => setForm(f => ({ ...f, sueldo_local: e.target.value ? parseFloat(e.target.value) : null }))} />
              </div>
              {(form.pais === "Chile" || form.pais === "Perú") && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Sueldo Líquido</label>
                  <input className="g66-input" type="number" value={form.salario_bruto ?? ""} onChange={e => setForm(f => ({ ...f, salario_bruto: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
              )}
              {inp("domicilio", "Domicilio")}
              {inp("fecha_ingreso", "Fecha de Ingreso", "date")}
              {!form.activo && inp("fecha_termino", "Fecha de Término", "date")}
              {inp("tipo_contrato", "Tipo de Contrato")}
              {/* Jefatura */}
              <div style={{ gridColumn: "span 2", position: "relative" }}>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Jefatura</label>
                <div style={{ position: "relative" }}>
                  <input
                    ref={jefInputRef}
                    className="g66-input"
                    type="text"
                    placeholder="Buscar jefe por apellido o nombre... (dejar vacío = sin jefe)"
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
                    <button
                      type="button"
                      onMouseDown={() => { setJefSearch(""); setForm(f => ({ ...f, jefatura: "" })); }}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--g66-muted)", fontSize: 16, lineHeight: 1, padding: 2 }}
                    >✕</button>
                  )}
                </div>
                {(!form.jefatura || form.jefatura === "NA" || form.jefatura === "") && (
                  <div style={{ fontSize: 11, color: "var(--g66-red)", marginTop: 3 }}>Sin jefe asignado</div>
                )}
                {showJefList && filteredManagers.length > 0 && (
                  <div style={{ position: "fixed", top: jefPos.top, left: jefPos.left, width: jefPos.width, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 9999, maxHeight: 240, overflowY: "auto" }}>
                    {filteredManagers.slice(0, 10).map(m => (
                      <div
                        key={m.email_global}
                        onMouseDown={() => { setForm(f => ({ ...f, jefatura: m.email_global })); setJefSearch(m.nombre); setShowJefList(false); }}
                        style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid var(--g66-border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g66-text)" }}>{m.nombre}</div>
                        <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>{m.email_global}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {inp("email_global", "Correo Global66")}
              {inp("email_personal", "Correo Personal")}
              {inp("usuario_wallet", "Usuario Wallet")}
            </div>
          ) : (
            <>
              {/* Identity */}
              <Section title="Identificación">
                <Field label="DNI / RUT / CI" value={employee.dni} mono />
                <Field label="Sexo" value={employee.sexo === "M" ? "Masculino" : employee.sexo === "F" ? "Femenino" : employee.sexo} />
                <Field label="País" value={`${FLAG[employee.pais] || ""} ${employee.pais}`} />
                <Field label="Domicilio" value={employee.domicilio} />
              </Section>
              <Divider />
              <Section title="Cargo & Organización">
                <Field label="Cargo" value={employee.cargo} />
                <Field label="Área" value={employee.area} />
                <Field label="Centro de Costo" value={employee.centro_costo} />
                <Field label="Presencialidad" value={employee.presencialidad || "4x1"} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Jefatura</div>
                  {employee.jefatura && employee.jefatura !== "NA" && employee.jefatura !== "" && employee.jefatura !== "Directorio"
                    ? <div style={{ fontSize: 14, color: "var(--g66-text)" }}>{employee.jefatura}</div>
                    : <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g66-red)" }}>Sin jefatura</div>
                  }
                </div>
              </Section>
              <Divider />
              <Section title="Contrato & Ingreso">
                <Field label="Tipo de Contrato" value={employee.tipo_contrato} />
                <Field label="Fecha de Ingreso" value={fmtDate(employee.fecha_ingreso)} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Tiempo en Global66</div>
                  <div style={{ fontSize: 14, color: "var(--g66-blue)", fontWeight: 600 }}>{tenure(employee.fecha_ingreso)}</div>
                </div>
                {!employee.activo && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Fecha de Término</div>
                    <div style={{ fontSize: 14, color: employee.fecha_termino ? "var(--g66-red)" : "var(--g66-muted)", fontWeight: employee.fecha_termino ? 600 : 400 }}>
                      {fmtDate(employee.fecha_termino)}
                    </div>
                  </div>
                )}
              </Section>
              <Divider />
              <Section title="Salario">
                <div>
                  <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Sueldo Bruto</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "var(--g66-blue)" }}>{hideSalaries ? "••••••" : fmtAmount(employee.sueldo_local)}</span>
                    {employee.moneda && employee.moneda !== "NA" && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-blue)", background: "var(--g66-blue-light)", border: "1px solid var(--g66-blue-mid)", borderRadius: 6, padding: "2px 8px" }}>{employee.moneda}</span>
                    )}
                  </div>
                </div>
                {(employee.pais === "Chile" || employee.pais === "Perú") && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Sueldo Líquido</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--g66-blue)" }}>{hideSalaries ? "••••••" : fmtAmount(employee.salario_bruto)}</span>
                      {employee.moneda && employee.moneda !== "NA" && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-blue)", background: "var(--g66-blue-light)", border: "1px solid var(--g66-blue-mid)", borderRadius: 6, padding: "2px 8px" }}>{employee.moneda}</span>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Moneda</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--g66-text)" }}>
                    {employee.moneda !== "NA" ? employee.moneda : "—"}
                  </div>
                </div>
              </Section>
              <Divider />
              <Section title="Contacto">
                <Field label="Correo Global66" value={employee.email_global} />
                <Field label="Correo Personal" value={employee.email_personal} />
                <Field label="Usuario Wallet" value={employee.usuario_wallet} />
              </Section>
            </>
          )}
        </div>


        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--g66-border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0, background: "#f9fafb" }}>
          {editing ? (
            <>
              <button className="g66-btn-ghost" onClick={() => { setEditing(false); setForm({ ...employee }); }}>Cancelar</button>
              <button className="g66-btn" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Guardar Cambios"}</button>
            </>
          ) : (
            <>
              <button
                onClick={handleToggle}
                disabled={toggling}
                style={{
                  background: employee.activo ? "var(--g66-red-bg)" : "var(--g66-blue-light)",
                  color: employee.activo ? "var(--g66-red)" : "var(--g66-blue)",
                  border: `1px solid ${employee.activo ? "var(--g66-red-border)" : "var(--g66-blue-mid)"}`,
                  borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: toggling ? "not-allowed" : "pointer",
                  fontSize: 14, transition: "all 0.15s",
                }}
              >
                {toggling ? "…" : employee.activo ? "Marcar Inactivo" : "Marcar Activo"}
              </button>
              <button className="g66-btn-ghost" onClick={onClose}>Cerrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-blue)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--g66-border)", marginBottom: 20 }} />;
}
