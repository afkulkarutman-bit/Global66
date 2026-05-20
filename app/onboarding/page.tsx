"use client";
import React, { useState } from "react";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { n: 1 as Step, label: "Datos Personales" },
  { n: 2 as Step, label: "Salud & Familia" },
  { n: 3 as Step, label: "Datos Bancarios" },
  { n: 4 as Step, label: "Cuenta Global66" },
  { n: 5 as Step, label: "Documentos" },
];

const PAISES = ["Chile", "Argentina", "Colombia", "Perú", "España", "Panamá", "Singapur", "Otro"];
const BANCOS_CL = ["Banco de Chile", "Banco Santander", "Banco BCI", "Banco Estado", "Banco BBVA", "Banco Scotiabank", "Banco Itaú", "Banco Falabella", "Banco Security", "Banco Internacional", "Otro"];
const AFP_CL = ["Capital", "Cuprum", "Habitat", "PlanVital", "ProVida", "Modelo", "Uno", "No aplica"];
const ISAPRE = ["Fonasa", "Banmédica", "Colmena", "Cruz Blanca", "Consalud", "Esencial", "Nueva Masvida", "Vida Tres", "Otro / No aplica"];
const ESTADO_CIVIL = ["Soltero/a", "Casado/a", "Conviviente civil", "Divorciado/a", "Viudo/a", "Otro"];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: 6 }}>
      {children}{required && <span style={{ color: "#3b3edb", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function Input({ label, required, type = "text", value, onChange, placeholder }: {
  label: string; required?: boolean; type?: string;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = "#3b3edb"}
        onBlur={e => e.target.style.borderColor = "#d1d5db"}
      />
    </div>
  );
}

function Select({ label, required, value, onChange, options }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" }}>
        <option value="">— Selecciona —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function RadioGroup({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {options.map(opt => (
          <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#374151" }}>
            <input type="radio" value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)}
              style={{ accentColor: "#3b3edb", width: 16, height: 16 }} />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function FileInput({ label, name, accept, onChange }: { label: string; name: string; accept?: string; onChange: (f: File | null) => void }) {
  const [fileName, setFileName] = useState<string>("");
  return (
    <div>
      <Label>{label}</Label>
      <label style={{
        display: "flex", alignItems: "center", gap: 10, border: "1.5px dashed #d1d5db", borderRadius: 8,
        padding: "10px 14px", cursor: "pointer", background: "#f9fafb", fontSize: 13, color: "#6b7280"
      }}>
        <span style={{ fontSize: 18 }}>📎</span>
        <span style={{ flex: 1 }}>{fileName || "Adjuntar archivo (PDF, JPG, PNG)"}</span>
        <input type="file" name={name} accept={accept || ".pdf,.jpg,.jpeg,.png"} style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0] || null;
            setFileName(f?.name || "");
            onChange(f);
          }} />
      </label>
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#3b3edb", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16, marginTop: 4, paddingBottom: 8, borderBottom: "1px solid #e5e7eb", ...style }}>
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ action: string; nombre: string } | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const [form, setForm] = useState({
    nombre_completo: "", rut: "",
    domicilio_completo: "", pais_ciudad_comuna: "",
    pais: "Chile", nacionalidad: "",
    fecha_nacimiento: "", estado_civil: "",
    telefono: "", email_personal: "",
    // salud
    prevision: "", afp: "",
    tiene_hijos: "no", fechas_hijos: "",
    discapacidad: "no", carnet_discapacidad: "no",
    alergias: "", alimentacion_especial: "",
    // banco
    banco: "", tipo_cuenta: "", numero_cuenta: "",
    rut_cuenta: "", email_cuenta: "", nombre_cuenta: "",
    // global
    usuario_wallet: "",
    // emergencia
    contacto_emergencia: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const setFile = (k: string) => (f: File | null) => setFiles(prev => ({ ...prev, [k]: f }));

  const validateStep = (): string => {
    if (step === 1) {
      if (!form.nombre_completo.trim()) return "El nombre completo es requerido";
      if (!form.rut.trim()) return "El RUT/DNI es requerido";
    }
    return "";
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep(s => Math.min(s + 1, 5) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setError("");
    setStep(s => Math.max(s - 1, 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    // Limpiar RUT chileno: quitar puntos si los escriben
    const cleanedForm = { ...form };
    if (form.pais === "Chile") {
      cleanedForm.rut = form.rut.replace(/\./g, "").trim();
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(cleanedForm)) fd.append(k, v);
    for (const [k, f] of Object.entries(files)) { if (f) fd.append(k, f); }

    const res = await fetch("/api/onboarding", { method: "POST", body: fd });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "Error al enviar"); return; }
    setDone(data);
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f6fa", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", maxWidth: 500, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            {done.action === "created" ? "¡Bienvenido/a a Global66!" : "¡Datos actualizados!"}
          </div>
          <div style={{ fontSize: 15, color: "#6b7280", marginBottom: 24 }}>
            {done.nombre}, tu información fue guardada exitosamente.
            {done.action === "created" ? " El equipo de People se pondrá en contacto contigo." : ""}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Global66" style={{ height: 28, borderRadius: 4, opacity: 0.8 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6fa" }}>
      {/* Header */}
      <div style={{ background: "#3b3edb", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Global66" style={{ height: 34, borderRadius: 6, display: "block" }} />
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Formulario de Onboarding</div>
      </div>

      {/* Progress */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "20px 32px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              {/* Step circle + label */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: step > s.n ? "#3b3edb" : step === s.n ? "#3b3edb" : "#e5e7eb",
                  color: step >= s.n ? "#fff" : "#9ca3af",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  border: step === s.n ? "3px solid #a5b4fc" : "3px solid transparent",
                  boxSizing: "border-box",
                }}>
                  {step > s.n ? "✓" : s.n}
                </div>
                <div style={{ fontSize: 11, fontWeight: step === s.n ? 700 : 400, color: step === s.n ? "#3b3edb" : "#9ca3af", whiteSpace: "nowrap" }}>
                  {s.label}
                </div>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? "#3b3edb" : "#e5e7eb", margin: "0 6px", marginBottom: 18, transition: "background 0.3s" }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 760, margin: "32px auto", padding: "0 16px" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>

          {step === 1 && (
            <>
              <SectionTitle>Datos de Identificación</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input label="Nombre Completo" required value={form.nombre_completo} onChange={set("nombre_completo")}
                    placeholder="Primer nombre, segundo nombre, primer apellido, segundo apellido" />
                </div>
                <div>
                  <Label required>RUT / DNI / Pasaporte</Label>
                  <input
                    type="text" value={form.rut}
                    onChange={e => set("rut")(e.target.value)}
                    placeholder={form.pais === "Chile" ? "Sin puntos, con guion — Ej: 12345678-9" : "Ej: 1234567890"}
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#3b3edb"}
                    onBlur={e => e.target.style.borderColor = "#d1d5db"}
                  />
                  {form.pais === "Chile" && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Formato: sin puntos y con guion — Ej: <strong>12345678-9</strong>
                    </div>
                  )}
                </div>
                <Select label="País" required value={form.pais} onChange={set("pais")} options={PAISES} />
                <Input label="Nacionalidad" value={form.nacionalidad} onChange={set("nacionalidad")} placeholder="Ej: Chilena" />
                <Input label="Fecha de Nacimiento" required type="date" value={form.fecha_nacimiento} onChange={set("fecha_nacimiento")} />
                <Select label="Estado Civil" value={form.estado_civil} onChange={set("estado_civil")} options={ESTADO_CIVIL} />
              </div>

              <SectionTitle>Dirección y Contacto</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input label="Dirección Completa" value={form.domicilio_completo} onChange={set("domicilio_completo")}
                    placeholder="Calle/Avenida, N° de Calle, N° Edificio/Casa" />
                </div>
                <Input label="País, Ciudad y Comuna" value={form.pais_ciudad_comuna} onChange={set("pais_ciudad_comuna")}
                  placeholder="Ej: Chile, Santiago, Providencia" />
                <Input label="Celular" type="tel" value={form.telefono} onChange={set("telefono")} placeholder="+56 9 XXXX XXXX" />
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input label="Mail Personal" type="email" value={form.email_personal} onChange={set("email_personal")} placeholder="tu@email.com" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SectionTitle>Salud y Previsión</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <Select label="Isapre / Fonasa" value={form.prevision} onChange={set("prevision")} options={ISAPRE} />
                <Select label="AFP" value={form.afp} onChange={set("afp")} options={AFP_CL} />
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input label="Alergias farmacológicas o alimentarias" value={form.alergias} onChange={set("alergias")}
                    placeholder="Especifica tus alergias o escribe 'Ninguna'" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input label="Tipo de alimentación especial" value={form.alimentacion_especial} onChange={set("alimentacion_especial")}
                    placeholder="Ej: Vegetariano, Vegano, Celíaco, Ninguna" />
                </div>
              </div>

              <SectionTitle>Familia</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <RadioGroup label="¿Tienes hijos?" value={form.tiene_hijos} onChange={set("tiene_hijos")}
                  options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} />
                {form.tiene_hijos === "si" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Input label="Fecha(s) de nacimiento de tus hijos" value={form.fechas_hijos} onChange={set("fechas_hijos")}
                      placeholder="Ej: 2018-03-15, 2021-07-22" />
                  </div>
                )}
              </div>

              <SectionTitle>Discapacidad</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <RadioGroup label="¿Cuentas con alguna discapacidad?" value={form.discapacidad} onChange={set("discapacidad")}
                  options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} />
                {form.discapacidad === "si" && (
                  <RadioGroup label="¿Cuentas con carnet de discapacidad?" value={form.carnet_discapacidad} onChange={set("carnet_discapacidad")}
                    options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} />
                )}
              </div>

              <SectionTitle style={{ marginTop: 24 }}>Contacto de Emergencia</SectionTitle>
              <Input label="¿A quién podemos llamar en caso de emergencia?" value={form.contacto_emergencia} onChange={set("contacto_emergencia")}
                placeholder="Nombre, número de teléfono y parentesco. Ej: María González, +56912345678, Madre" />
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle>Datos Bancarios</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <Select label="Banco" value={form.banco} onChange={set("banco")} options={BANCOS_CL} />
                <Select label="Tipo de Cuenta" value={form.tipo_cuenta} onChange={set("tipo_cuenta")}
                  options={["Cuenta Corriente", "Cuenta Vista / RUT", "Cuenta de Ahorro", "Cuenta Digital", "Otro"]} />
                <Input label="Número de Cuenta" value={form.numero_cuenta} onChange={set("numero_cuenta")} placeholder="Ej: 00123456789" />
                <Input label="RUT del Titular de Cuenta" value={form.rut_cuenta} onChange={set("rut_cuenta")} placeholder="Ej: 12.345.678-9" />
                <Input label="Mail del Titular" type="email" value={form.email_cuenta} onChange={set("email_cuenta")} placeholder="tu@email.com" />
                <Input label="Nombre del Titular" value={form.nombre_cuenta} onChange={set("nombre_cuenta")} placeholder="Nombre completo" />
              </div>
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", fontSize: 13, color: "#1e40af" }}>
                💡 Esta información se usará exclusivamente para el pago de remuneraciones. Tus datos están protegidos.
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <SectionTitle>Cuenta Global66</SectionTitle>
              <div style={{ display: "grid", gap: 20 }}>
                <Input label="Usuario Wallet de la app Global66" value={form.usuario_wallet} onChange={set("usuario_wallet")}
                  placeholder="Tu usuario Wallet o email en la app Global66" />
                <div style={{ padding: "16px", background: "#f5f6fa", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>¿Por qué necesitamos tu cuenta?</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Global66 ofrece beneficios exclusivos a sus colaboradores a través de la plataforma. Registrar tu cuenta nos permite activarlos automáticamente.
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <SectionTitle>Foto de Perfil</SectionTitle>
              <div style={{ marginBottom: 24 }}>
                <FileInput label="Una foto tuya ¡Queremos presentarte al equipo! (JPG, PNG)" name="foto" accept=".jpg,.jpeg,.png" onChange={setFile("foto")} />
              </div>

              <SectionTitle>Documentos de Previsión</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <FileInput label="Certificado de Registro Isapre o Fonasa" name="doc_isapre" onChange={setFile("doc_isapre")} />
                <FileInput label="Certificado de Incorporación AFP" name="doc_afp" onChange={setFile("doc_afp")} />
              </div>

              <SectionTitle>Documentos de Identidad y Estudios</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <FileInput label="Fotocopia CI (ambos lados)" name="doc_ci" onChange={setFile("doc_ci")} />
                <FileInput label="Certificado de Estudios (si tienes)" name="doc_estudios" onChange={setFile("doc_estudios")} />
                <FileInput label="Certificado de Antecedentes Penales" name="doc_antecedentes" onChange={setFile("doc_antecedentes")} />
                <FileInput label="Curriculum Vitae" name="doc_cv" onChange={setFile("doc_cv")} />
              </div>

              <SectionTitle>Documentos Laborales (si aplica)</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FileInput label="Finiquito o Carta de Renuncia (empleador anterior)" name="doc_finiquito" onChange={setFile("doc_finiquito")} />
                <FileInput label="Certificado de Visa en Trámite (solo extranjeros)" name="doc_visa" onChange={setFile("doc_visa")} />
              </div>

              <div style={{ marginTop: 20, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13, color: "#166534" }}>
                ✅ Todos los archivos son opcionales excepto los marcados. Puedes completar los que tengas disponibles ahora.
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={prevStep} disabled={step === 1}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 22px", fontSize: 14, color: "#374151", cursor: step === 1 ? "not-allowed" : "pointer", opacity: step === 1 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Paso {step} de {STEPS.length}</span>
            {step < 5 ? (
              <button onClick={nextStep}
                style={{ background: "#3b3edb", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                style={{ background: "#3b3edb", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Enviando…" : "Enviar Formulario ✓"}
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#9ca3af" }}>
          © 2025 Global66 — Uso interno. Tus datos están protegidos.
        </div>
      </div>
    </div>
  );
}
