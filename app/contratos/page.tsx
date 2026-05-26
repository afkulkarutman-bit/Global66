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
  email_personal: string | null;
  email_global: string | null;
  domicilio: string | null;
  tipo_contrato: string | null;
  jefatura: string | null;
  activo: number;
  sexo: string;
};

const SENIOR_KEYWORDS = ['head','lead','vp','director','chief','country manager','clevel','c-level','ceo','cto','coo','cfo','cpo'];

type TemplateKey = 'chile' | 'chile_senior' | 'colombia';

function detectTemplate(pais: string, cargo: string): TemplateKey {
  const p = (pais ?? '').toLowerCase();
  const c = (cargo ?? '').toLowerCase();
  if (p.includes('colombia')) return 'colombia';
  const isSenior = SENIOR_KEYWORDS.some(kw => c.includes(kw));
  return isSenior ? 'chile_senior' : 'chile';
}

const TEMPLATE_INFO: Record<TemplateKey, { label: string; color: string; bg: string; border: string; file: string }> = {
  chile: {
    label: 'Chile — Estándar',
    color: '#0f4c81',
    bg: '#eff6ff',
    border: '#bfdbfe',
    file: 'contrato_chile.docx',
  },
  chile_senior: {
    label: 'Chile — Senior',
    color: '#6d28d9',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    file: 'contrato_chile_senior.docx',
  },
  colombia: {
    label: 'Colombia — Servicios',
    color: '#065f46',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    file: 'contrato_colombia.docx',
  },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ContratosPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  // Extra fields
  const [fechaRedaccion, setFechaRedaccion] = useState(todayIso());
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [nacionalidad, setNacionalidad] = useState('');
  const [responsabilidades, setResponsabilidades] = useState('');
  const [movilizacion, setMovilizacion] = useState('');
  const [colacion, setColacion] = useState('');
  const [conexion, setConexion] = useState('');
  const [templateOverride, setTemplateOverride] = useState<string>('');

  const searchRef = useRef<HTMLInputElement>(null);

  const autoTemplate = selected ? detectTemplate(selected.pais ?? '', selected.cargo ?? '') : null;
  const effectiveTemplate: TemplateKey = (templateOverride as TemplateKey) || autoTemplate || 'chile';
  const tInfo = TEMPLATE_INFO[effectiveTemplate];

  // Search
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/contratos?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
      setShowSugg(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const selectEmp = useCallback((emp: Employee) => {
    setSelected(emp);
    setQuery(emp.nombre);
    setShowSugg(false);
    setActiveIdx(-1);
    setTemplateOverride('');
    // Pre-fill fecha_termino if employee has one
    setFechaTermino(emp.fecha_termino && emp.fecha_termino !== 'NA' ? emp.fecha_termino.slice(0, 10) : '');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSugg || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectEmp(suggestions[activeIdx]); }
    else if (e.key === 'Escape') { setShowSugg(false); }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        empleado: selected,
        fecha_redaccion: fechaRedaccion,
        nacionalidad: nacionalidad || undefined,
        responsabilidades: responsabilidades || undefined,
        monto_movilizacion: Number(movilizacion) || 0,
        monto_colacion: Number(colacion) || 0,
        monto_conexion: Number(conexion) || 0,
      };
      if (fechaNacimiento) body.fecha_nacimiento = fechaNacimiento;
      if (fechaTermino) body.fecha_termino = fechaTermino;
      if (templateOverride) body.template_override = TEMPLATE_INFO[templateOverride as TemplateKey]?.file;

      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + err.error);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contrato_${selected.nombre.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  const sal = selected?.sueldo_local ?? selected?.salario_bruto ?? null;

  return (
    <div style={{ minHeight: '100vh', background: '#e8ecf4', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
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
          </div>
          <HeaderNavArrows />
        </div>
      </header>

      {/* Layout */}
      <div style={{
        display: 'flex', gap: 24, maxWidth: 1100,
        margin: '28px auto', padding: '0 20px', alignItems: 'flex-start',
      }}>

        {/* Left panel — employee search */}
        <div style={{
          width: 290, flexShrink: 0, background: '#fff', borderRadius: 10,
          boxShadow: '0 1px 6px rgba(0,0,0,0.1)', padding: 20,
          position: 'sticky', top: 20,
        }}>
          <div style={sectionTitle}>Empleado</div>

          {/* Search */}
          <label style={labelStyle}>Buscar por nombre o DNI</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={searchRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              placeholder="Nombre o número de identidad…"
              style={inputStyle}
              autoComplete="off"
              autoFocus
            />
            {showSugg && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#fff', border: '1.5px solid #1A3DF5',
                borderRadius: 8, boxShadow: '0 8px 20px rgba(26,61,245,0.18)',
                zIndex: 9999, maxHeight: 220, overflowY: 'auto',
              }}>
                {suggestions.map((emp, i) => (
                  <div key={emp.id} onMouseDown={() => selectEmp(emp)}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', fontSize: 12,
                      borderBottom: '1px solid #f3f4f6',
                      background: i === activeIdx ? '#e8ecff' : '#fff',
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <strong style={{ color: '#1A3DF5' }}>{emp.dni}</strong> — {emp.nombre}
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                      {emp.cargo} · {emp.pais} ·{' '}
                      <span style={{ color: emp.activo ? '#059669' : '#dc2626', fontWeight: 600 }}>
                        {emp.activo ? 'Activo' : 'Ex-empleado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={labelStyle}>Nombre</label>
          <input value={selected?.nombre ?? ''} readOnly placeholder="Autocomplete" style={roInputStyle} />

          <label style={labelStyle}>DNI / RUT</label>
          <input value={selected?.dni ?? ''} readOnly placeholder="Autocomplete" style={roInputStyle} />

          <label style={labelStyle}>Cargo</label>
          <input value={selected?.cargo ?? ''} readOnly placeholder="Autocomplete" style={roInputStyle} />

          <label style={labelStyle}>País</label>
          <input value={selected?.pais ?? ''} readOnly placeholder="Autocomplete" style={roInputStyle} />

          <label style={labelStyle}>Fecha ingreso</label>
          <input value={selected?.fecha_ingreso?.slice(0,10) ?? ''} readOnly placeholder="—" style={roInputStyle} />

          <label style={labelStyle}>Sueldo base</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={sal !== null && sal !== undefined ? sal.toLocaleString('es-CL') : ''}
              readOnly placeholder="—"
              style={{ ...roInputStyle, flex: 1 }}
            />
            <input
              value={selected?.moneda ?? ''}
              readOnly placeholder="—"
              style={{ ...roInputStyle, width: 56, textAlign: 'center' }}
            />
          </div>

          <label style={labelStyle}>Jefatura</label>
          <input
            value={selected?.jefatura && selected.jefatura !== 'NA' ? selected.jefatura : ''}
            readOnly placeholder="—"
            style={roInputStyle}
          />

          <label style={labelStyle}>Domicilio</label>
          <input
            value={selected?.domicilio && selected.domicilio !== 'NA' ? selected.domicilio : ''}
            readOnly placeholder="—"
            style={roInputStyle}
          />
        </div>

        {/* Right panel — contract form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Template card */}
          <div style={{
            background: '#fff', borderRadius: 10,
            boxShadow: '0 1px 6px rgba(0,0,0,0.1)', padding: 20,
          }}>
            <div style={sectionTitle}>Plantilla de contrato</div>

            {!selected ? (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Seleccioná un empleado para ver la plantilla detectada automáticamente.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: tInfo.bg, border: `1.5px solid ${tInfo.border}`,
                    borderRadius: 8, padding: '8px 14px',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tInfo.color} strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tInfo.color }}>
                      {templateOverride ? TEMPLATE_INFO[templateOverride as TemplateKey]?.label : `${tInfo.label} (auto)`}
                    </span>
                  </div>
                  {templateOverride && (
                    <button onClick={() => setTemplateOverride('')} style={{
                      fontSize: 11, color: '#6b7280', background: 'none',
                      border: '1px solid #d1d5db', borderRadius: 5,
                      padding: '4px 8px', cursor: 'pointer',
                    }}>
                      ↺ Restablecer auto
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                  Forzar plantilla:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.keys(TEMPLATE_INFO) as TemplateKey[]).map(key => (
                    <button key={key}
                      onClick={() => setTemplateOverride(key === effectiveTemplate && templateOverride === key ? '' : key)}
                      style={{
                        fontSize: 12, fontWeight: 600,
                        padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                        background: effectiveTemplate === key ? TEMPLATE_INFO[key].bg : '#f9fafb',
                        color: effectiveTemplate === key ? TEMPLATE_INFO[key].color : '#6b7280',
                        border: `1.5px solid ${effectiveTemplate === key ? TEMPLATE_INFO[key].border : '#e5e7eb'}`,
                      }}
                    >
                      {TEMPLATE_INFO[key].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Extra fields */}
          <div style={{
            background: '#fff', borderRadius: 10,
            boxShadow: '0 1px 6px rgba(0,0,0,0.1)', padding: 20,
          }}>
            <div style={sectionTitle}>Datos del contrato</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label style={labelStyle}>Fecha de redacción *</label>
                <input type="date" value={fechaRedaccion} onChange={e => setFechaRedaccion(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha de nacimiento</label>
                <input type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha término relación laboral</label>
                <input
                  type="date" value={fechaTermino}
                  onChange={e => setFechaTermino(e.target.value)}
                  style={inputStyle}
                  placeholder="Dejar vacío = indefinido"
                />
                {!fechaTermino && (
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                    Sin fecha = indefinido
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Nacionalidad</label>
                <input
                  type="text" value={nacionalidad}
                  onChange={e => setNacionalidad(e.target.value)}
                  placeholder="ej. Chilena"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={sectionSubtitle}>Asignaciones</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label style={labelStyle}>Movilización</label>
                <div style={{ position: 'relative' }}>
                  <span style={prefixStyle}>$</span>
                  <input
                    type="number" min="0" value={movilizacion}
                    onChange={e => setMovilizacion(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, paddingLeft: 22 }}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Colación</label>
                <div style={{ position: 'relative' }}>
                  <span style={prefixStyle}>$</span>
                  <input
                    type="number" min="0" value={colacion}
                    onChange={e => setColacion(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, paddingLeft: 22 }}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Conexión</label>
                <div style={{ position: 'relative' }}>
                  <span style={prefixStyle}>$</span>
                  <input
                    type="number" min="0" value={conexion}
                    onChange={e => setConexion(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, paddingLeft: 22 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Responsabilidades y actividades básicas</label>
              <textarea
                value={responsabilidades}
                onChange={e => setResponsabilidades(e.target.value)}
                placeholder="Ingresá las responsabilidades del cargo, separadas por punto y coma o salto de línea…"
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.5,
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!selected || loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '14px 0',
              background: selected && !loading ? '#1A3DF5' : '#d1d5db',
              color: selected && !loading ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: selected && !loading ? 'pointer' : 'not-allowed',
              boxShadow: selected && !loading ? '0 4px 14px rgba(26,61,245,0.3)' : 'none',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Generando…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M12 18v-6M9 15l3 3 3-3"/>
                </svg>
                Generar Contrato .docx
              </>
            )}
          </button>

          {!selected && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>
              Buscá un empleado para habilitar la generación
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Styles ── */
const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.6px', color: '#1A3DF5',
  borderBottom: '2px solid #e8ecff', paddingBottom: 8, marginBottom: 14,
};

const sectionSubtitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: '#9ca3af',
  marginTop: 16, marginBottom: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.4px',
  color: '#6b7280', margin: '10px 0 3px',
};

const inputBase: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  border: '1.5px solid #d1d5db', borderRadius: 6,
  fontSize: 13, fontFamily: "'Segoe UI', Arial, sans-serif",
  color: '#1f2937', outline: 'none',
  boxSizing: 'border-box',
};

const inputStyle: React.CSSProperties = { ...inputBase, background: '#fff' };
const roInputStyle: React.CSSProperties = { ...inputBase, background: '#f9fafb', color: '#6b7280' };

const prefixStyle: React.CSSProperties = {
  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
  fontSize: 13, color: '#6b7280', pointerEvents: 'none',
};
