"use client";
import { useEffect, useState } from "react";

type Stats = {
  total: number;
  activos: number;
  inactivos: number;
  porPais: { pais: string; total: number; activos: number }[];
  porSexo: { sexo: string; total: number }[];
  porArea: { area: string; total: number; activos: number }[];
  inactivosPorPaisArea: { pais: string; total: number; areas: { area: string; total: number }[] }[];
  porContrato: { tipo_contrato: string; total: number }[];
  porCargo: { cargo: string; total: number }[];
  ingresosPorAno: { anio: string; total: number }[];
  sueldosPorPais: { pais: string; moneda: string; avg_local: number; min_local: number; max_local: number; n: number }[];
};

const FLAG: Record<string, string> = {
  Chile: "🇨🇱", Argentina: "🇦🇷", Colombia: "🇨🇴",
  "Perú": "🇵🇪", "España": "🇪🇸", "Panamá": "🇵🇦", Singapur: "🇸🇬",
};

function fmtNum(n: number) {
  return new Intl.NumberFormat("es-CL").format(Math.round(n));
}

function Bar({ value, max, color = "var(--g66-blue)" }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--g66-border)", overflow: "hidden" }}>
      <div style={{ width: `${(value / max) * 100}%`, height: "100%", borderRadius: 4, background: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="g66-card" style={{ padding: "20px 24px" }}>
      <div style={{ fontSize: 11, color: "var(--g66-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: color || "var(--g66-text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ hideSalaries = false }: { hideSalaries?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employees/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading || !stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--g66-muted)" }}>
        Cargando estadísticas…
      </div>
    );
  }

  const sexoMap: Record<string, { label: string; color: string }> = {
    M: { label: "Hombres", color: "#3b82f6" },
    F: { label: "Mujeres", color: "#ec4899" },
    NA: { label: "No especificado", color: "var(--g66-muted)" },
  };

  const totalActivos = stats.activos;
  const hombres = stats.porSexo.find(s => s.sexo === "M")?.total || 0;
  const mujeres = stats.porSexo.find(s => s.sexo === "F")?.total || 0;
  const noEsp = stats.porSexo.find(s => s.sexo === "NA" || !s.sexo)?.total || 0;
  const pctH = totalActivos > 0 ? Math.round((hombres / totalActivos) * 100) : 0;
  const pctF = totalActivos > 0 ? Math.round((mujeres / totalActivos) * 100) : 0;

  const maxPais = Math.max(...stats.porPais.map(p => p.activos), 1);
  const maxArea = Math.max(...stats.porArea.map(a => a.total), 1);
  const maxContrato = Math.max(...stats.porContrato.map(c => c.total), 1);
  const maxCargo = Math.max(...stats.porCargo.map(c => c.total), 1);
  const maxIngreso = Math.max(...stats.ingresosPorAno.map(i => i.total), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Gender breakdown */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Distribución por Género (activos)</div>
          {/* Donut visualization */}
          <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 16 }}>
            <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, transform: "rotate(-90deg)" }}>
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--g66-border)" strokeWidth="3" />
                {totalActivos > 0 && (
                  <>
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3b82f6" strokeWidth="3"
                      strokeDasharray={`${(hombres/totalActivos)*100} ${100-(hombres/totalActivos)*100}`}
                      strokeDashoffset="0" />
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ec4899" strokeWidth="3"
                      strokeDasharray={`${(mujeres/totalActivos)*100} ${100-(mujeres/totalActivos)*100}`}
                      strokeDashoffset={`${-(hombres/totalActivos)*100}`} />
                  </>
                )}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--g66-text)" }}>
                {totalActivos}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "M", label: "Hombres", value: hombres, color: "#3b82f6" },
                { key: "F", label: "Mujeres", value: mujeres, color: "#ec4899" },
                { key: "NA", label: "No especif.", value: noEsp, color: "var(--g66-muted)" },
              ].map(item => (
                <div key={item.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
                    <span style={{ color: "var(--g66-text2)" }}>{item.value} ({totalActivos > 0 ? Math.round((item.value/totalActivos)*100) : 0}%)</span>
                  </div>
                  <Bar value={item.value} max={Math.max(hombres, mujeres, noEsp, 1)} color={item.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Country breakdown */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Empleados Activos por País</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.porPais.filter(p => p.pais !== 'Singapur').map(p => (
              <div key={p.pais}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 500 }}>{FLAG[p.pais] || ""} {p.pais}</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Bar value={p.activos} max={maxPais} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-blue)", width: 28, textAlign: "right" }}>{p.activos}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="g66-card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g66-text2)" }}>Inactivos</div>
            <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 3 }}>Resumen por país y área</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--g66-red)" }}>{stats.inactivos}</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--g66-border)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>País</th>
                <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px", width: 90 }}>Total</th>
                <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Áreas</th>
              </tr>
            </thead>
            <tbody>
              {stats.inactivosPorPaisArea.map(item => (
                <tr key={item.pais} style={{ borderBottom: "1px solid var(--g66-border)" }}>
                  <td style={{ padding: "12px 8px", fontSize: 13, fontWeight: 700, color: "var(--g66-text)", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {FLAG[item.pais] || ""} {item.pais}
                  </td>
                  <td style={{ padding: "12px 8px", fontSize: 14, fontWeight: 800, color: "var(--g66-red)", textAlign: "right", verticalAlign: "top" }}>
                    {item.total}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.areas.map(area => (
                        <span
                          key={`${item.pais}-${area.area}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: "1px solid var(--g66-border)",
                            borderRadius: 8,
                            padding: "5px 8px",
                            background: "#fafafa",
                            fontSize: 12,
                            color: "var(--g66-text2)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>{area.area}</span>
                          <strong style={{ color: "var(--g66-text)" }}>{area.total}</strong>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {stats.inactivosPorPaisArea.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: "18px 8px", fontSize: 13, color: "var(--g66-muted)", textAlign: "center" }}>No hay empleados inactivos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Area breakdown */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Top Áreas (total)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.porArea.map(a => (
              <div key={a.area}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.area}</span>
                  <span style={{ color: "var(--g66-muted)" }}>{a.activos} act.</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Bar value={a.total} max={maxArea} color="#8b5cf6" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8b5cf6", width: 28, textAlign: "right" }}>{a.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contract types */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Tipos de Contrato (activos)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.porContrato.slice(0, 8).map(c => (
              <div key={c.tipo_contrato}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tipo_contrato}</span>
                  <span style={{ color: "var(--g66-muted)" }}>{Math.round((c.total/stats.activos)*100)}%</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Bar value={c.total} max={maxContrato} color="#f59e0b" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", width: 28, textAlign: "right" }}>{c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Ingresos por año */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Ingresos por Año</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.ingresosPorAno.filter(i => i.anio && i.anio.length === 4).map(i => (
              <div key={i.anio} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-muted)", width: 40, flexShrink: 0 }}>{i.anio}</span>
                <div style={{ flex: 1, height: 22, borderRadius: 4, background: "var(--g66-border)", overflow: "hidden" }}>
                  <div style={{
                    width: `${(i.total / maxIngreso) * 100}%`, height: "100%",
                    background: "linear-gradient(90deg, var(--g66-blue), var(--g66-blue-dark))",
                    borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6,
                    minWidth: i.total > 0 ? 30 : 0, transition: "width 0.4s ease",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{i.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Salary by country */}
        <div className="g66-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--g66-text2)" }}>Sueldo Promedio por País (moneda local)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {stats.sueldosPorPais.filter(s => s.pais !== 'Singapur' && s.pais !== 'España').map(s => (
              <div key={s.pais + '_' + s.moneda} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--g66-border)", paddingBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{FLAG[s.pais] || ""} {s.pais}</span>
                  <span style={{ fontSize: 11, color: "var(--g66-muted)", marginLeft: 8 }}>{s.n} empleados</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--g66-blue)" }}>{hideSalaries ? "••••••" : fmtNum(s.avg_local)}</div>
                  <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>{s.moneda}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
