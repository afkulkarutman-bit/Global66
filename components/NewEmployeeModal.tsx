"use client";
import { useState } from "react";

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
  tipo_contrato: string;
  jefatura: string;
  email_global: string;
  email_personal: string;
  usuario_wallet?: string | null;
  presencialidad?: string | null;
};

const PAISES = ["Chile", "Argentina", "Colombia", "Perú", "España", "Panamá", "Singapur", "Otro"];
const MONEDAS = ["CLP", "COP", "PEN", "USD", "ARS", "EUR"];

export default function NewEmployeeModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (emp: Employee) => void;
}) {
  const [form, setForm] = useState({
    dni: "", nombre: "", activo: true, cargo: "", sexo: "NA",
    salario_bruto: "", sueldo_local: "", area: "", centro_costo: "",
    pais: "Chile", moneda: "CLP", domicilio: "", fecha_ingreso: "",
    tipo_contrato: "", jefatura: "", email_global: "", email_personal: "",
    usuario_wallet: "", presencialidad: "4x1",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dni.trim()) { setError("El DNI es requerido"); return; }
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        salario_bruto: form.salario_bruto ? parseFloat(form.salario_bruto) : null,
        sueldo_local: form.sueldo_local ? parseFloat(form.sueldo_local) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error al crear empleado"); return; }
    onCreate(data);
  };

  const inp = (field: keyof typeof form, label: string, type = "text", required = false) => (
    <div>
      <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>
        {label}{required && <span style={{ color: "var(--g66-blue)", marginLeft: 2 }}>*</span>}
      </label>
      <input
        className="g66-input"
        type={type}
        value={(form[field] as string) ?? ""}
        onChange={f(field)}
        placeholder={required ? "Requerido" : "NA"}
      />
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--g66-card)", border: "1px solid var(--g66-border)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g66-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Nuevo Empleado</div>
            <div style={{ fontSize: 12, color: "var(--g66-muted)" }}>Completar los datos del nuevo ingreso</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--g66-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ overflowY: "auto", flex: 1, padding: "24px" }}>
            {/* Required */}
            <div style={{ fontSize: 11, color: "var(--g66-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Datos Principales</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {inp("nombre", "Nombre completo", "text", true)}
              {inp("dni", "DNI / RUT / CI", "text", true)}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Estado</label>
                <select className="g66-input" value={form.activo ? "1" : "0"} onChange={e => setForm(p => ({ ...p, activo: e.target.value === "1" }))}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Sexo</label>
                <select className="g66-input" value={form.sexo} onChange={f("sexo")}>
                  <option value="NA">NA</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--g66-border)", marginBottom: 20 }} />
            <div style={{ fontSize: 11, color: "var(--g66-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Cargo & Organización</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {inp("cargo", "Cargo")}
              {inp("area", "Área")}
              {inp("centro_costo", "Centro de Costo")}
              {inp("jefatura", "Jefatura")}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Presencialidad</label>
                <select className="g66-input" value={form.presencialidad} onChange={f("presencialidad")}>
                  {["4x1","3x2","2x3","1x4","Remoto","Presencial","Flexible"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>País</label>
                <select className="g66-input" value={form.pais} onChange={f("pais")}>
                  {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {inp("domicilio", "Domicilio")}
            </div>

            <div style={{ height: 1, background: "var(--g66-border)", marginBottom: 20 }} />
            <div style={{ fontSize: 11, color: "var(--g66-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Contrato & Salario</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {inp("tipo_contrato", "Tipo de Contrato")}
              {inp("fecha_ingreso", "Fecha de Ingreso", "date")}
              <div>
                <label style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Moneda</label>
                <select className="g66-input" value={form.moneda} onChange={f("moneda")}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {inp("sueldo_local", "Sueldo Bruto", "number")}
              {inp("salario_bruto", "Sueldo Líquido", "number")}
            </div>

            <div style={{ height: 1, background: "var(--g66-border)", marginBottom: 20 }} />
            <div style={{ fontSize: 11, color: "var(--g66-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Contacto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {inp("email_global", "Correo Global66", "email")}
              {inp("email_personal", "Correo Personal", "email")}
              {inp("usuario_wallet", "Usuario Wallet")}
            </div>
          </div>

          {error && (
            <div style={{ margin: "0 24px 0", padding: "10px 14px", background: "var(--g66-red-bg)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "var(--g66-red)", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--g66-border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0, background: "#f9fafb" }}>
            <button type="button" className="g66-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="g66-btn" disabled={saving}>{saving ? "Creando…" : "Crear Empleado"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
