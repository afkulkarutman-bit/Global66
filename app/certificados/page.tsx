"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import HeaderNavArrows from "@/components/HeaderNavArrows";

type Employee = {
  id: number;
  nombre: string;
  dni: string;
  cargo: string;
  pais: string;
  moneda: string;
  sueldo_local: number | null;
  salario_bruto: number | null;
  fecha_ingreso: string | null;
  fecha_termino: string | null;
  sexo: string;
  tipo_contrato: string;
  activo: number;
  in_payroll?: boolean;
};

const MESES = ["enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"];

function formatDateLong(val: string | null | undefined): string {
  if (!val) return "__________";
  const v = String(val).trim().slice(0, 10);
  const p = v.split("-").map(Number);
  if (p.length === 3 && p[0] > 1900 && p[1] >= 1 && p[1] <= 12) {
    return `${p[2]} de ${MESES[p[1] - 1]} de ${p[0]}`;
  }
  return val;
}

const PAIS_ID: Record<string, string> = {
  chile: "RUT",
  colombia: "Identificación",
  argentina: "DNI",
  perú: "DNI",
  peru: "DNI",
  españa: "NIE",
  espana: "NIE",
};

function tipoId(pais: string): string {
  return PAIS_ID[(pais || "").toLowerCase().trim()] ?? "DNI";
}

function fmtSalario(n: number | null | undefined): string {
  if (!n) return "_________";
  return n.toLocaleString("es-CL");
}

function todayLong(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
}

export default function CertificadosPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [totalEmps, setTotalEmps] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualEmp, setManualEmp] = useState<Employee>({
    id: 0,
    nombre: "",
    dni: "",
    cargo: "",
    pais: "Chile",
    moneda: "CLP",
    sueldo_local: null,
    salario_bruto: null,
    fecha_ingreso: null,
    fecha_termino: null,
    sexo: "M",
    tipo_contrato: "Prestación de Servicios",
    activo: 1,
    in_payroll: true,
  });
  const certRef = useRef<HTMLDivElement>(null);

  // Load total on mount
  useEffect(() => {
    fetch("/api/certificados").then(r => r.json()).then(d => setTotalEmps(d.total));
  }, []);

  // Search
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/certificados?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.employees || []);
      setShowSugg(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const selectEmp = useCallback((emp: Employee) => {
    setSelected(emp);
    setQuery(emp.nombre);
    setShowSugg(false);
    setActiveIdx(-1);
    setEditMode(false);
    setEditSnapshot(null);
    setManualMode(false);
  }, []);

  const selectedCert = manualMode ? manualEmp : selected;

  const startManualCertificate = () => {
    setManualMode(true);
    setSelected(null);
    setQuery("");
    setShowSugg(false);
    setActiveIdx(-1);
    setEditMode(false);
    setEditSnapshot(null);
  };

  const updateManual = <K extends keyof Employee>(key: K, value: Employee[K]) => {
    setManualEmp(emp => ({ ...emp, [key]: value }));
    setEditSnapshot(null);
  };

  const handleEnterEdit = () => setEditMode(true);

  const handleDoneEdit = () => {
    const html = certRef.current?.innerHTML ?? null;
    setEditSnapshot(html);
    setEditMode(false);
  };

  const handleDiscardEdit = () => {
    setEditSnapshot(null);
    setEditMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSugg || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectEmp(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setShowSugg(false); }
  };

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!selectedCert || !certRef.current) return;
    setLoadingPdf(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let html2pdf = (window as any).html2pdf;
      if (!html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html2pdf = (window as any).html2pdf;
      }
      const nombre = (selectedCert.nombre || "Manual").replace(/\s+/g, "_");
      await html2pdf().set({
        margin: [5, 10, 10, 10],
        filename: `Certificado_${nombre}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(certRef.current).save();
    } finally {
      setLoadingPdf(false);
    }
  };

  const sal = selectedCert?.sueldo_local ?? selectedCert?.salario_bruto ?? null;
  const isActive = selectedCert ? selectedCert.activo === 1 : true;
  const hasEmployee = !!selectedCert;
  const isServiceCertificate = selectedCert ? (manualMode ? selectedCert.tipo_contrato.toLowerCase().includes("servicio") : selectedCert.in_payroll === true) : false;
  const certificateTitle = isServiceCertificate ? "Certificado Prestación de Servicios" : "Certificado Laboral";

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cert-printable, #cert-printable * { visibility: visible !important; }
          #cert-printable {
            position: fixed !important;
            left: 0; top: 0;
            width: 100%; height: auto;
            padding: 10mm 22mm 25mm !important;
            box-shadow: none !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#e8ecf4" }}>
        {/* Header */}
        <header style={{ background: "var(--g66-blue)", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 8px rgba(59,62,219,0.25)" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} />
              </Link>
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>BOOK</span>
              <span style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 13 }}>Certificados</span>
            </div>
            <HeaderNavArrows />
          </div>
        </header>

        {/* Layout */}
        <div style={{
          display: "flex", gap: 24, maxWidth: 1200,
          margin: "28px auto", padding: "0 20px", alignItems: "flex-start",
        }}>

          {/* Form panel */}
          <div style={{
            width: 300, flexShrink: 0, background: "#fff", borderRadius: 10,
            boxShadow: "0 1px 6px rgba(0,0,0,0.1)", padding: 20,
            position: "sticky", top: 20,
            fontFamily: "'Segoe UI', Arial, sans-serif",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#1A3DF5", borderBottom: "2px solid #e8ecff", paddingBottom: 8, marginBottom: 14 }}>
              Datos
            </div>

            {/* Status bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: totalEmps !== null ? "#10b981" : "#f59e0b",
                flexShrink: 0,
                animation: totalEmps === null ? "pulse .9s infinite" : "none",
              }} />
              <span>
                {totalEmps === null ? "Cargando nómina…" : `${totalEmps} empleados cargados`}
              </span>
            </div>

            {/* Search */}
            <label style={labelStyle}>CI / RUT / DNI</label>
            <div style={{ position: "relative" }}>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); setManualMode(false); }}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="Buscar por número o nombre…"
                style={inputStyle}
                autoComplete="off"
                autoFocus
              />
              {showSugg && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#fff", border: "1.5px solid #1A3DF5",
                  borderRadius: 8, boxShadow: "0 8px 20px rgba(26,61,245,0.18)",
                  zIndex: 9999, maxHeight: 200, overflowY: "auto",
                }}>
                  {suggestions.map((emp, i) => (
                    <div key={emp.id} onMouseDown={() => selectEmp(emp)}
                      style={{
                        padding: "9px 12px", cursor: "pointer", fontSize: 12,
                        borderBottom: "1px solid #f3f4f6",
                        background: i === activeIdx ? "#e8ecff" : "#fff",
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                    >
                      <strong style={{ color: "#1A3DF5" }}>{emp.dni}</strong> — {emp.nombre}
                      <div style={{ fontSize: 10, color: "#6b7280" }}>
                        {emp.cargo} · {emp.pais} · <span style={{ color: emp.activo ? "#059669" : "#dc2626", fontWeight: 600 }}>{emp.activo ? "Activo" : "Ex-empleado"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={startManualCertificate} style={{
              width: "100%",
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 7,
              border: manualMode ? "1.5px solid #1A3DF5" : "1.5px solid #d1d5db",
              background: manualMode ? "#eef2ff" : "#fff",
              color: manualMode ? "#1A3DF5" : "#374151",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}>
              Crear certificado manual
            </button>

            {manualMode && (
              <div style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 7,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 11,
                lineHeight: 1.45,
              }}>
                Completa los datos, revisa la vista previa y luego usa Editar para agregar texto libre al certificado.
              </div>
            )}

            <label style={labelStyle}>Nombre</label>
            <input
              value={selectedCert?.nombre ?? ""}
              readOnly={!manualMode}
              onChange={e => updateManual("nombre", e.target.value)}
              placeholder={manualMode ? "Nombre completo" : "Autocomplete"}
              style={manualMode ? inputStyle : roInputStyle}
            />

            <label style={labelStyle}>Documento</label>
            <input
              value={selectedCert?.dni ?? ""}
              readOnly={!manualMode}
              onChange={e => updateManual("dni", e.target.value)}
              placeholder={manualMode ? "RUT / DNI / ID" : "Autocomplete"}
              style={manualMode ? inputStyle : roInputStyle}
            />

            <label style={labelStyle}>Cargo</label>
            <input
              value={selectedCert?.cargo ?? ""}
              readOnly={!manualMode}
              onChange={e => updateManual("cargo", e.target.value)}
              placeholder={manualMode ? "Cargo" : "Autocomplete"}
              style={manualMode ? inputStyle : roInputStyle}
            />

            <label style={labelStyle}>País</label>
            <input
              value={selectedCert?.pais ?? ""}
              readOnly={!manualMode}
              onChange={e => updateManual("pais", e.target.value)}
              placeholder={manualMode ? "País" : "Autocomplete"}
              style={manualMode ? inputStyle : roInputStyle}
            />

            <label style={labelStyle}>Fecha de ingreso</label>
            <input
              type={manualMode ? "date" : "text"}
              value={manualMode ? (selectedCert?.fecha_ingreso?.slice(0,10) ?? "") : (() => { const v = selectedCert?.fecha_ingreso?.slice(0,10); if(!v) return ""; const [y,m,d] = v.split("-"); return y&&m&&d ? `${d}-${m}-${y}` : v; })()}
              readOnly={!manualMode}
              onChange={e => updateManual("fecha_ingreso", e.target.value || null)}
              placeholder={manualMode ? "" : "Autocomplete"}
              style={manualMode ? inputStyle : roInputStyle}
            />

            {manualMode && (
              <>
                <label style={labelStyle}>Estado</label>
                <select
                  value={manualEmp.activo === 1 ? "1" : "0"}
                  onChange={e => updateManual("activo", e.target.value === "1" ? 1 : 0)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="1">Activo</option>
                  <option value="0">Ex-empleado</option>
                </select>

                {manualEmp.activo !== 1 && (
                  <>
                    <label style={labelStyle}>Fecha de término</label>
                    <input
                      type="date"
                      value={manualEmp.fecha_termino?.slice(0,10) ?? ""}
                      onChange={e => updateManual("fecha_termino", e.target.value || null)}
                      style={inputStyle}
                    />
                  </>
                )}
              </>
            )}

            <label style={labelStyle}>Salario mensual</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualMode ? (manualEmp.sueldo_local ?? "") : (sal !== null && sal !== undefined ? sal.toLocaleString("es-CL") : "")}
                readOnly={!manualMode}
                onChange={e => updateManual("sueldo_local", e.target.value === "" ? null : Number(e.target.value))}
                type={manualMode ? "number" : "text"}
                placeholder="0"
                style={{ ...(manualMode ? inputStyle : roInputStyle), flex: 1 }}
              />
              <input
                value={selectedCert?.moneda ?? ""}
                readOnly={!manualMode}
                onChange={e => updateManual("moneda", e.target.value)}
                placeholder="CLP"
                style={{ ...(manualMode ? inputStyle : roInputStyle), width: 70, textAlign: "center" }}
              />
            </div>

            <label style={labelStyle}>Tratamiento</label>
            <select
              value={selectedCert?.sexo === "F" ? "F" : "M"}
              disabled={!manualMode}
              style={{ ...inputStyle, width: "100%", background: manualMode ? "#fff" : "#f9fafb", color: manualMode ? "#1f2937" : "#6b7280" }}
              onChange={e => updateManual("sexo", e.target.value)}
            >
              <option value="M">Don (Masculino)</option>
              <option value="F">Doña (Femenino)</option>
            </select>

            {/* Print button */}
            <button onClick={handlePrint} disabled={!hasEmployee} style={hasEmployee ? btnPrimaryStyle : btnDisabledStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimir
            </button>

            {/* Download button */}
            <button onClick={handleDownload} disabled={!hasEmployee || loadingPdf} style={hasEmployee && !loadingPdf ? btnSecondaryStyle : btnSecDisabledStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {loadingPdf ? "Generando…" : "Descargar PDF"}
            </button>
          </div>

          {/* Preview */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
                Vista previa {editMode && <span style={{ color: "#1A3DF5" }}>— Modo edición</span>}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {!editMode ? (
                  <button onClick={handleEnterEdit} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", background: "#fff", color: "#1A3DF5",
                    border: "1.5px solid #1A3DF5", borderRadius: 7,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar
                  </button>
                ) : (
                  <>
                    <button onClick={handleDoneEdit} style={{
                      padding: "6px 14px", background: "#1A3DF5", color: "#fff",
                      border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}>
                      Listo
                    </button>
                    <button onClick={handleDiscardEdit} style={{
                      padding: "6px 14px", background: "#fff", color: "#dc2626",
                      border: "1.5px solid #dc2626", borderRadius: 7, fontSize: 12,
                      fontWeight: 600, cursor: "pointer", fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}>
                      Descartar
                    </button>
                  </>
                )}
              </div>
            </div>

            {editSnapshot && !editMode ? (
              <div id="cert-printable" ref={certRef} style={{
                background: "#fff", width: "100%", maxWidth: 794, minHeight: 1000,
                margin: "0 auto", padding: "36px 72px 80px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                fontFamily: "'Times New Roman', Times, serif", color: "#1f2937",
              }} dangerouslySetInnerHTML={{ __html: editSnapshot }} />
            ) : (

            <div id="cert-printable" ref={certRef}
              contentEditable={editMode}
              suppressContentEditableWarning={true}
              style={{
              background: "#fff",
              width: "100%",
              maxWidth: 794,
              minHeight: 1000,
              margin: "0 auto",
              padding: "36px 72px 80px",
              boxShadow: editMode ? "0 4px 24px rgba(26,61,245,0.3)" : "0 4px 24px rgba(0,0,0,0.18)",
              outline: editMode ? "2px dashed #1A3DF5" : "none",
              fontFamily: "'Times New Roman', Times, serif",
              color: "#1f2937",
              position: "relative",
              cursor: editMode ? "text" : "default",
            }}>

              {/* Logo — top right */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 34 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo_cert_badge.jpg"
                  alt="Global66"
                  style={{ height: 56, borderRadius: 8, display: "block" }}
                />
              </div>

              {/* Title */}
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 22, fontWeight: 700, textAlign: "center", color: "#1f2937", marginBottom: 40 }}>
                {certificateTitle}
              </div>

              {/* Body */}
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 14.5, lineHeight: 1.9, color: "#1f2937" }}>

                <div style={{ fontWeight: 700, marginBottom: 28 }}>
                  Con fecha {todayLong()} Certifico que:
                </div>

                <div style={{ textAlign: "justify", marginBottom: 36 } as React.CSSProperties}>
                  {hasEmployee ? (
                    <>
                      {selectedCert!.sexo === "F" ? "Doña" : "Don"}:{" "}
                      <span id="cNombre">{selectedCert!.nombre}</span>,{" "}
                      <span id="cTipoId">{tipoId(selectedCert!.pais)}</span> N°<span id="cId">{selectedCert!.dni}</span>,{" "}
                      {isActive ? (
                        <>
                          {isServiceCertificate ? "presta servicios de" : "desempeña el cargo de"}{" "}
                          &ldquo;<strong id="cCargo">{selectedCert!.cargo}</strong>&rdquo;{" "}
                          para la empresa{" "}
                          <strong>Global 81 SpA. Rut 76.827.283-2,</strong>{" "}
                          manteniendo un contrato vigente desde el{" "}
                          <span id="cIngreso">{formatDateLong(selectedCert!.fecha_ingreso)}</span>.{" "}
                          {sal !== null && (
                            <>Con una {isServiceCertificate ? "prestación" : "remuneración"} mensual de $<span id="cSalario">{fmtSalario(sal)}</span>.-&nbsp;<span id="cMoneda">{selectedCert!.moneda}</span></>
                          )}
                        </>
                      ) : (
                        <>
                          {isServiceCertificate ? "prestó servicios de" : "desempeñó el cargo de"}{" "}
                          &ldquo;<strong id="cCargo">{selectedCert!.cargo}</strong>&rdquo;{" "}
                          para la empresa{" "}
                          <strong>Global 81 SpA. Rut 76.827.283-2,</strong>{" "}
                          desde el{" "}
                          <span id="cIngreso">{formatDateLong(selectedCert!.fecha_ingreso)}</span>{" "}
                          hasta el{" "}
                          <strong>{formatDateLong(selectedCert!.fecha_termino)}</strong>.{" "}
                          {sal !== null && (
                            <>Con una {isServiceCertificate ? "prestación" : "remuneración"} mensual de $<span id="cSalario">{fmtSalario(sal)}</span>.-&nbsp;<span id="cMoneda">{selectedCert!.moneda}</span></>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span id="cTratamiento">Don/ña</span>:{" "}
                      <span id="cNombre">___________________________</span>,{" "}
                      <span id="cTipoId">CI/RUT/DNI</span> N°<span id="cId">_______________</span>,{" "}
                      {isServiceCertificate ? "presta servicios de" : "desempeña el cargo de"} &ldquo;<strong id="cCargo">_______________</strong>&rdquo;{" "}
                      para la empresa <strong>Global 81 SpA. Rut 76.827.283-2,</strong>{" "}
                      manteniendo un contrato vigente desde el <span id="cIngreso">__________</span>.{" "}
                      Con una {isServiceCertificate ? "prestación" : "remuneración"} mensual de $<span id="cSalario">_________</span>.-&nbsp;<span id="cMoneda">___</span>
                    </>
                  )}
                </div>

                <div style={{ marginBottom: 72 }}>
                  Se extiende el presente documento para los fines que estime convenientes.
                </div>
              </div>

              {/* Signature — full image with name/title/email baked in */}
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/firma_angela.png"
                  alt="Firma"
                  style={{ width: 270, display: "block" }}
                />
              </div>

            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Styles ── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  color: "#6b7280",
  margin: "10px 0 3px",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1.5px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "'Segoe UI', Arial, sans-serif",
  color: "#1f2937",
  outline: "none",
};

const inputStyle: React.CSSProperties = { ...inputBase, background: "#fff" };
const roInputStyle: React.CSSProperties = { ...inputBase, background: "#f9fafb", color: "#6b7280" };

const btnBase: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", marginTop: 16, padding: 11,
  border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "'Segoe UI', Arial, sans-serif",
};

const btnPrimaryStyle: React.CSSProperties = { ...btnBase, background: "#1A3DF5", color: "#fff" };
const btnDisabledStyle: React.CSSProperties = { ...btnBase, background: "#d1d5db", color: "#9ca3af", cursor: "not-allowed" };
const btnSecondaryStyle: React.CSSProperties = { ...btnBase, marginTop: 8, background: "#fff", color: "#1A3DF5", border: "1.5px solid #1A3DF5" };
const btnSecDisabledStyle: React.CSSProperties = { ...btnBase, marginTop: 8, background: "#fff", color: "#9ca3af", border: "1.5px solid #d1d5db", cursor: "not-allowed" };
