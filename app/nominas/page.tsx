"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---- Types ----

type PayrollParam = { id: string; moneda: string; tdc_usd: number; retencion: number };

type PayrollCommission = { id: string; tipo: "CX" | "B2B"; dni: string; nombre: string; monto_bruto: number; moneda: string; mes: string };
type PreviousReferenceRow = {
  dni: string;
  nombre: string;
  pais?: string;
  moneda?: string;
  sueldo_base: number;
  sueldo_imponible: number;
  sueldo_neto_local?: number;
  sueldo_neto_usd?: number;
  comision_cx?: number;
  comision_b2b?: number;
  comisiones: number;
  comisiones_t1?: number;
  var_comisiones_pct?: number | null;
  preferencia_pago?: string;
  pago_wallet?: number;
  pago_banco?: number;
  pago_wallet_usd?: number;
  pago_wallet_ars?: number;
  pago_banco_ars?: number;
  dias_neto?: number;
  otros_ingresos?: number;
  descuento_boutique?: number;
  otros_descuentos?: number;
};
type PayrollSalaryChange = {
  id: string;
  period_id: string;
  payroll_employee_id: string | null;
  dni: string;
  nombre: string;
  pais: string | null;
  cargo: string | null;
  moneda: string;
  old_base: number;
  new_base: number;
  diff_amount: number;
  diff_pct: number;
  comment: string | null;
  created_at: string;
};
type CommissionType = "CX" | "B2B";
type ManualCommissionDraft = { dni: string; nombre: string; monto_bruto: string; moneda: string; mes: string };
type BoletaResponseRow = Record<string, unknown> & { __rowNumber?: number };
type GeminiReportRow = {
  formEmail: string;
  fileUrl: string;
  rowNumber: number;
  monto: number | null;
  moneda: string | null;
  fecha: string | null;
  nombreEnBoleta: string | null;
  error?: string;
};
type CrossRow = {
  nombre: string;
  emailNomina: string;
  pais: string;
  moneda: string;
  montoNomina: number;
  montoGemini: number | null;
  fechaGemini: string | null;
  fileUrl: string;
  formEmail: string;
  status: "ok" | "monto_distinto" | "sin_respuesta" | "fecha_incorrecta" | "sin_monto";
  diferencia: number | null;
};
type BoletaExpectedRow = {
  key: string;
  dni: string;
  normalizedDni: string;
  normalizedName: string;
  normalizedEmail: string;
  nombre: string;
  pais: string;
  moneda: string;
  expectedAmount: number;
};
type PayrollExportScope = "sin_arg" | "argentina";
type PayrollEditableField = keyof Pick<PayrollEmployee,
  "dias_descuento" | "horas_extra" | "otros_ingresos" | "descuento_boutique" | "otros_descuentos" |
  "asegurado" |
  "variacion_salario_base" |
  "monto_ars_usd" | "revisar" | "preferencia_pago" | "correo_wallet" | "usuario_wallet" | "fecha_boleta" | "observaciones"
>;

type PayrollEmployee = {
  id: string; period_id: string; dni: string; nombre: string;
  email_global: string | null; cargo: string | null; area: string | null;
  centro_costo: string | null; pais: string | null; moneda: string;
  fecha_ingreso: string | null; fecha_termino: string | null;
  sueldo_base: number; variacion_salario_base: number; es_argentina: boolean; monto_ars_usd: number;
  dias_descuento: number; horas_extra: number;
  otros_ingresos: number; asegurado: number; descuento_boutique: number; otros_descuentos: number;
  revisar: boolean;
  preferencia_pago: string | null;
  correo_wallet: string | null;
  usuario_wallet: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  observaciones: string | null;
  fecha_boleta: string | null;
};

type PayrollPeriod = {
  id: string; mes: string; fecha_inicio: string; fecha_fin: string;
  status: "borrador" | "cerrado"; created_at: string;
  payroll_params: PayrollParam[];
};

type PreviousPayrollContext = {
  period: PayrollPeriod;
  employees: PayrollEmployee[];
  commissions: PayrollCommission[];
  params: PayrollParam[];
} | null;

const APRIL_2026_COMMISSION_REFERENCE: Record<string, number> = {
  "23178698": 168015,
  "32953405": 201,
  "35730419": 80,
  "40754894": 57,
  "70051780": 201,
  "72219745": 185,
  "72365381": 225,
  "76312383": 371,
  "1000222831": 183729,
  "1000240470": 952373.0666666665,
  "1000515140": 1660924,
  "1000937567": 8722662,
  "1001326721": 952373.0666666665,
  "1001328842": 3585391,
  "1010160239": 952373.0666666665,
  "1013587358": 952373.0666666665,
  "1014270861": 293029,
  "1017171954": 2197784,
  "1018462242": 4797541,
  "1018503302": 1179148,
  "1019144758": 5653515,
  "1020738650": 242262,
  "1020745736": 952373.0666666665,
  "1022387418": 266693,
  "1022414525": 189187,
  "1022441646": 406321,
  "1023014682": 952373,
  "1023876953": 952373.0666666665,
  "1023930591": 2375731,
  "1024580492": 60803,
  "1026292775": 555253,
  "1026598983": 2197784,
  "1030620643": 952373.0666666665,
  "1065842612": 1798391,
  "1070020685": 2197784,
  "1107053612": 2197784,
  "1192799474": 4780545,
  "1233892170": 585288,
};

type CalcRow = PayrollEmployee & {
  dias_mes: number; dias_base: number; dias_neto: number; pct_mes: number;
  sueldo_base_ajustado: number; sueldo_proporcional: number; comision_cx: number; comision_b2b: number;
  asegurado_proporcional: number;
  sueldo_imponible: number; retencion_amt: number;
  sueldo_neto_local: number; tdc_usd: number; sueldo_neto_usd: number;
  pago_usd: number; pago_ars_usd: number; pago_ars_local: number;
  // Payment split (Sin ARG)
  pago_wallet_local: number; pago_banco_local: number;
  // Payment split (Argentina)
  pago_wallet_usd: number; pago_wallet_ars: number; pago_banco_ars: number;
};

// ---- Helpers ----

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function formatMes(d: string) { const dt = new Date(d + "T12:00:00"); return `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`; }
function firstDay(y: number, m: number) { return `${y}-${String(m).padStart(2,"0")}-01`; }
function lastDay(y: number, m: number) { return new Date(y, m, 0).toISOString().slice(0, 10); }
function daysBetween(a: string, b: string) { return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000) + 1; }
function parseDecimalInput(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlain(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeDoc(value: unknown) {
  return String(value ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePersonName(value: unknown) {
  return normalizePlain(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function parseMoneyValue(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "n/a") return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized = commaCount > 0 && dotCount > 0
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : commaCount > 0
      ? (commaCount > 1 || cleaned.length - lastComma - 1 === 3 ? cleaned.replace(/,/g, "") : cleaned.replace(",", "."))
      : dotCount > 0
        ? (dotCount > 1 || cleaned.length - lastDot - 1 === 3 ? cleaned.replace(/\./g, "") : cleaned)
        : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFlexibleDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + value * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const latam = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (latam) {
    const [, d, m, year] = latam;
    const y = year.length === 2 ? `20${year}` : year;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function findFieldValue(row: BoletaResponseRow, candidates: string[]) {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizePlain(candidate);
    const exact = entries.find(([key]) => normalizePlain(key) === normalizedCandidate);
    if (exact) return exact[1];
  }
  for (const candidate of candidates) {
    const normalizedCandidate = normalizePlain(candidate);
    const partial = entries.find(([key]) => normalizePlain(key).includes(normalizedCandidate));
    if (partial) return partial[1];
  }
  return "";
}

function normalizeCurrency(value: unknown) {
  const raw = normalizePlain(value);
  if (!raw) return "";
  if (raw.includes("usd") || raw.includes("dolar")) return "USD";
  if (raw.includes("ars") || raw.includes("argent")) return "ARS";
  if (raw.includes("cop") || raw.includes("colomb")) return "COP";
  if (raw.includes("clp") || raw.includes("chile")) return "CLP";
  if (raw.includes("pen") || raw.includes("sol")) return "PEN";
  if (raw.includes("eur") || raw.includes("euro")) return "EUR";
  return raw.toUpperCase();
}

function sheetRowsToBoletaObjects(rows: unknown[][]): BoletaResponseRow[] {
  const nonEmpty = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some(cell => String(cell ?? "").trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const first = nonEmpty[0].row.map(cell => String(cell ?? "").trim());
  const firstLooksHeader = first.some(cell => {
    const normalized = normalizePlain(cell);
    return normalized.includes("correo") || normalized.includes("pdf") || normalized.includes("marca temporal") || normalized.includes("monto");
  });
  const headers = firstLooksHeader
    ? first
    : ["Marca temporal", "Dirección de correo electrónico", "PDF"];
  const dataRows = firstLooksHeader ? nonEmpty.slice(1) : nonEmpty;

  return dataRows.map(({ row, index }) => {
    const obj: BoletaResponseRow = { __rowNumber: index + 1 };
    headers.forEach((header, colIndex) => {
      obj[header || `Columna ${colIndex + 1}`] = row[colIndex] ?? "";
    });
    return obj;
  });
}

function selectBoletasSheetName(sheetNames: string[], mes: string | undefined) {
  const selectedDate = mes ? new Date(`${mes.slice(0, 10)}T12:00:00`) : null;
  const monthLabel = selectedDate && !Number.isNaN(selectedDate.getTime())
    ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : "";
  const normalizedMonth = normalizePlain(monthLabel);
  const monthMatch = sheetNames.find(name => normalizePlain(name).includes(normalizedMonth));
  if (monthMatch) return monthMatch;
  return sheetNames.find(name => normalizePlain(name).includes("respuestas de formulario")) ?? sheetNames[0] ?? "";
}

function monthNumberSinceIngreso(fechaIngreso: string | null, period: PayrollPeriod): number | null {
  if (!fechaIngreso) return null;
  const ingreso = new Date(fechaIngreso.slice(0, 10) + "T12:00:00");
  const finPeriodo = new Date(period.fecha_fin + "T12:00:00");
  if (isNaN(ingreso.getTime()) || ingreso > finPeriodo) return null;
  return (finPeriodo.getFullYear() - ingreso.getFullYear()) * 12 + (finPeriodo.getMonth() - ingreso.getMonth()) + 1;
}

function addDaysIso(dateIso: string, days: number): string | null {
  if (!dateIso) return null;
  const result = new Date(dateIso.slice(0, 10) + "T12:00:00");
  if (isNaN(result.getTime())) return null;
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

function dayBeforeIso(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const dt = new Date(dateIso + "T12:00:00");
  if (isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function calcAseguradoWindow(emp: PayrollEmployee, period: PayrollPeriod) {
  if (!emp.fecha_ingreso) return null;
  const inicioCobertura = emp.fecha_ingreso.slice(0, 10);
  const finTresMeses = addDaysIso(inicioCobertura, 90);
  if (!finTresMeses) return null;

  const desde = inicioCobertura > period.fecha_inicio ? inicioCobertura : period.fecha_inicio;
  const terminoContrato = emp.fecha_termino && emp.fecha_termino < period.fecha_fin ? emp.fecha_termino : period.fecha_fin;
  const hastaBase = finTresMeses < terminoContrato ? finTresMeses : terminoContrato;
  const dias = desde <= hastaBase ? daysBetween(desde, hastaBase) : 0;

  return {
    inicio: desde,
    fin: hastaBase,
    dias,
    finTresMeses,
    mes: monthNumberSinceIngreso(emp.fecha_ingreso, period),
  };
}

function isHunterB2BRole(emp: PayrollEmployee): boolean {
  const cargo = (emp.cargo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return cargo.includes("sales specialist hunter b2b");
}

function calcDiasBase(emp: PayrollEmployee, period: PayrollPeriod): number {
  const ingreso = (emp.fecha_ingreso && emp.fecha_ingreso > period.fecha_inicio) ? emp.fecha_ingreso : period.fecha_inicio;
  const termino = (emp.fecha_termino && emp.fecha_termino < period.fecha_fin) ? emp.fecha_termino : period.fecha_fin;
  return Math.max(0, daysBetween(ingreso, termino));
}

function calcRow(emp: PayrollEmployee, period: PayrollPeriod, params: PayrollParam[], commissions: PayrollCommission[]): CalcRow {
  const diasMes = daysBetween(period.fecha_inicio, period.fecha_fin);
  const diasBase = calcDiasBase(emp, period);
  const diasNeto = Math.max(0, diasBase - emp.dias_descuento + (emp.horas_extra / 9) * (diasMes / 30));
  const variacionPct = Number(emp.variacion_salario_base ?? 0);
  const sueldoBaseAjustado = emp.sueldo_base * (1 + variacionPct / 100);
  const sueldoProp = (sueldoBaseAjustado / diasMes) * diasNeto;

  const comCX = commissions.filter(c => c.tipo === "CX" && c.dni === emp.dni).reduce((s, c) => s + c.monto_bruto, 0);
  const comB2B = commissions.filter(c => c.tipo === "B2B" && c.dni === emp.dni).reduce((s, c) => s + c.monto_bruto, 0);
  const aseguradoWindow = isHunterB2BRole(emp) ? calcAseguradoWindow(emp, period) : null;
  const aseguradoDias = aseguradoWindow ? aseguradoWindow.dias : diasBase;
  const aseguradoProporcional = (Number(emp.asegurado ?? 0) / 30) * aseguradoDias;

  const sueldoImponible = sueldoProp + comCX + comB2B + aseguradoProporcional + emp.otros_ingresos - emp.descuento_boutique - emp.otros_descuentos;

  const param = params.find(p => p.moneda === emp.moneda);
  const tdcUsd = param?.tdc_usd ?? 1;
  const retencionPct = param?.retencion ?? 0;
  const retencionAmt = sueldoImponible * retencionPct;
  const sueldoNetoLocal = sueldoImponible - retencionAmt;
  const sueldoNetoUsd = tdcUsd > 0 ? sueldoNetoLocal / tdcUsd : 0;

  // Argentina ARS split
  const tdcArs = params.find(p => p.moneda === "ARS")?.tdc_usd ?? 1;
  const pagoArsUsd = emp.es_argentina ? Math.min(emp.monto_ars_usd, sueldoNetoUsd) : 0;
  const pagoArsLocal = pagoArsUsd * tdcArs;
  const pagoUsd = sueldoNetoUsd - pagoArsUsd;

  // Payment preference split
  const pref = emp.preferencia_pago ?? "Banco";
  const pagoWalletLocal = !emp.es_argentina ? (pref === "Wallet" ? sueldoNetoLocal : 0) : 0;
  const pagoBancoLocal  = !emp.es_argentina ? (pref === "Banco"  ? sueldoNetoLocal : 0) : 0;
  // Argentina: USD portion always to wallet; ARS based on pref
  const pagoWalletUsd = emp.es_argentina ? pagoUsd : 0;
  const pagoWalletArs = emp.es_argentina && pref === "Wallet" ? pagoArsLocal : 0;
  const pagoBancoArs  = emp.es_argentina && pref === "Banco"  ? pagoArsLocal : 0;

  return { ...emp, dias_mes: diasMes, dias_base: diasBase, dias_neto: diasNeto, pct_mes: diasBase / diasMes, sueldo_base_ajustado: sueldoBaseAjustado, sueldo_proporcional: sueldoProp, comision_cx: comCX, comision_b2b: comB2B, asegurado_proporcional: aseguradoProporcional, sueldo_imponible: sueldoImponible, retencion_amt: retencionAmt, sueldo_neto_local: sueldoNetoLocal, tdc_usd: tdcUsd, sueldo_neto_usd: sueldoNetoUsd, pago_usd: pagoUsd, pago_ars_usd: pagoArsUsd, pago_ars_local: pagoArsLocal, pago_wallet_local: pagoWalletLocal, pago_banco_local: pagoBancoLocal, pago_wallet_usd: pagoWalletUsd, pago_wallet_ars: pagoWalletArs, pago_banco_ars: pagoBancoArs };
}

function fmt(n: number, d = 0) { return n.toLocaleString("es-CL", { maximumFractionDigits: d }); }
function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}
function variationColor(value: number | null) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.005) return "var(--g66-muted)";
  return value > 0 ? "#15803d" : "#dc2626";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
}
function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitBeneficiaryName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: fullName.trim(), apellido: "" };
  if (parts.length === 2) return { nombre: parts[1], apellido: parts[0] };
  if (parts.length === 3) return { nombre: parts.slice(1).join(" "), apellido: parts[0] };

  const particles = new Set(["de", "del", "la", "las", "los"]);
  let surnameEnd = 2;
  if (particles.has(parts[0].toLowerCase())) {
    surnameEnd = Math.min(parts.length - 1, 4);
  }
  if (particles.has(parts[1]?.toLowerCase())) {
    surnameEnd = Math.min(parts.length - 1, 5);
  }

  return {
    nombre: parts.slice(surnameEnd).join(" "),
    apellido: parts.slice(0, surnameEnd).join(" "),
  };
}

function normalizeBankCountry(value: string | null | undefined) {
  const country = String(value ?? "").trim().toLowerCase();
  if (country.includes("argentina")) return "AR - Argentina";
  if (country.includes("chile")) return "CL - Chile";
  if (country.includes("colombia")) return "CO - Colombia";
  if (country.includes("méxico") || country.includes("mexico")) return "MX - México";
  if (country.includes("perú") || country.includes("peru")) return "PE - Perú";
  if (country.includes("bolivia")) return "BO - Bolivia";
  if (country.includes("ecuador")) return "EC - Ecuador";
  if (country.includes("guatemala")) return "GT - Guatemala";
  if (country.includes("paraguay")) return "PY - Paraguay";
  return value ?? "";
}

function normalizeBankDocumentType(value: string | null | undefined) {
  const country = String(value ?? "").trim().toLowerCase();
  if (country.includes("chile")) return "RUT";
  if (country.includes("colombia")) return "CC";
  if (country.includes("argentina")) return "CUIT";
  if (country.includes("perú") || country.includes("peru")) return "DNI";
  if (country.includes("méxico") || country.includes("mexico")) return "CURP";
  return "DNI";
}

function normalizeBankAccountType(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("corriente") || normalized === "cc") return "CC - Cuenta Corriente";
  return "CA - Cuenta de Ahorros";
}

function normalizeBankName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLowerCase();
  if (!raw) return "";
  if (/^\d+\s*-/.test(raw)) return raw;
  if (normalized.includes("interbank")) return "11 - INTERBANK";
  if (normalized.includes("bbva")) return "900 - BBVA PERU";
  if (normalized.includes("scotia")) return "5 - Banco Scotiabank";
  if (normalized.includes("pichincha")) return "7 - Banco Pichincha";
  if (normalized.includes("credito") || normalized.includes("crédito") || normalized.includes("bcp")) {
    return "3 - Banco de Crédito del Peru (BCP)";
  }
  if (normalized.includes("nacion") || normalized.includes("nación")) return "4 - Banco de la Nacion";
  if (normalized.includes("banbif")) return "994 - Banco Interamericano de Finanzas BanBif";
  if (normalized.includes("falabella")) return "998 - Banco Falabella";
  return raw;
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getCellStyle(cellXml: string) {
  return cellXml.match(/\ss="([^"]+)"/)?.[1] ?? "";
}

function buildTemplateCell(ref: string, style: string, value: string | number | null) {
  const styleAttr = style ? ` s="${style}"` : "";
  if (value === null || value === "") return `<c r="${ref}"${styleAttr}/>`;
  if (typeof value === "number") return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function replaceTemplateCell(sheetXml: string, ref: string, value: string | number | null) {
  const pattern = new RegExp(`<c\\s+[^>]*r="${ref}"[^>]*(?:/>|>[\\s\\S]*?<\\/c>)`);
  const current = sheetXml.match(pattern)?.[0] ?? `<c r="${ref}"/>`;
  return sheetXml.replace(pattern, buildTemplateCell(ref, getCellStyle(current), value));
}

function replaceBankSheetData(sheetXml: string, data: (string | number | null)[][]) {
  const columns = "ABCDEFGHIJKL".split("");
  const headerRows = [1, 2, 3, 4]
    .map(row => sheetXml.match(new RegExp(`<row[^>]*r="${row}"[^>]*>[\\s\\S]*?<\\/row>`))?.[0] ?? "")
    .join("");
  const styles = Object.fromEntries(columns.map(col => {
    const cell = sheetXml.match(new RegExp(`<c\\s+[^>]*r="${col}5"[^>]*(?:/>|>[\\s\\S]*?<\\/c>)`))?.[0] ?? `<c r="${col}5"/>`;
    return [col, getCellStyle(cell)];
  }));
  const dataRows = data.map((values, index) => {
    const rowNumber = index + 5;
    const cells = values.map((value, colIndex) => {
      const col = columns[colIndex];
      return buildTemplateCell(`${col}${rowNumber}`, styles[col], value);
    }).join("");
    return `<row r="${rowNumber}" spans="1:12">${cells}</row>`;
  }).join("");
  const sheetData = `<sheetData>${headerRows}${dataRows}</sheetData>`;
  const maxRow = Math.max(data.length + 4, 5);
  return sheetXml
    .replace(/<dimension[^>]*>/, `<dimension ref="A1:L${maxRow}"/>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, sheetData);
}

function setSheetAutoFilter(sheetXml: string, ref: string) {
  const autoFilter = `<autoFilter ref="${ref}"/>`;
  if (sheetXml.includes("<autoFilter")) {
    return sheetXml.replace(/<autoFilter[^>]*\/>/, autoFilter);
  }
  return sheetXml.replace("</sheetData>", `</sheetData>${autoFilter}`);
}

// ---- Component ----

export default function NominasPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<PayrollPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateInfo, setGenerateInfo] = useState<{ excluidos: number; excluidos_detalle: {dni:string;nombre:string;fecha_termino:string}[] } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [copyFrom, setCopyFrom] = useState(false);
  const [copyFromId, setCopyFromId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editParams, setEditParams] = useState<PayrollParam[]>([]);
  const [newMes, setNewMes] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [commissions, setCommissions] = useState<PayrollCommission[]>([]);
  const [previousPayroll, setPreviousPayroll] = useState<PreviousPayrollContext>(null);
  const [previousReference, setPreviousReference] = useState<PreviousReferenceRow[]>([]);
  const [previousReferenceError, setPreviousReferenceError] = useState("");
  const [manualCommissions, setManualCommissions] = useState<Record<CommissionType, ManualCommissionDraft>>({
    CX: { dni: "", nombre: "", monto_bruto: "", moneda: "USD", mes: "" },
    B2B: { dni: "", nombre: "", monto_bruto: "", moneda: "USD", mes: "" },
  });
  const [commissionSearchQ, setCommissionSearchQ] = useState<Record<CommissionType, string>>({ CX: "", B2B: "" });
  const [commissionSearchResults, setCommissionSearchResults] = useState<Record<CommissionType, Record<string, unknown>[]>>({ CX: [], B2B: [] });
  const [aseguradoSearchQ, setAseguradoSearchQ] = useState("");
  const [aseguradoSearchResults, setAseguradoSearchResults] = useState<Record<string, unknown>[]>([]);
  const [aseguradoDraft, setAseguradoDraft] = useState({ id: "", dni: "", nombre: "", monto: "" });
  const [aseguradoB2BDrafts, setAseguradoB2BDrafts] = useState<Record<string, string>>({});
  const [savingAsegurado, setSavingAsegurado] = useState(false);
  const [savingB2BAsegurado, setSavingB2BAsegurado] = useState(false);
  const [savingCommission, setSavingCommission] = useState<Record<CommissionType, boolean>>({ CX: false, B2B: false });
  const commissionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ CX?: string; B2B?: string }>({});
  const [uploadPreview, setUploadPreview] = useState<{ CX?: { sheet: string; usedHeaders: boolean; rows: Record<string, unknown>[] }; B2B?: { sheet: string; usedHeaders: boolean; rows: Record<string, unknown>[] } }>({});
  const [editingRow, setEditingRow] = useState<CalcRow | null>(null);
  const [editNovedades, setEditNovedades] = useState({ dias_descuento: 0, horas_extra: 0, otros_ingresos: 0, asegurado: 0, descuento_boutique: 0, otros_descuentos: 0, fecha_termino: "" });
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [addEmpTarget, setAddEmpTarget] = useState<"sin_arg" | "argentina">("sin_arg");
  const [addingEmp, setAddingEmp] = useState(false);
  const [newEmp, setNewEmp] = useState({ dni: "", nombre: "", email_global: "", cargo: "", area: "", centro_costo: "", pais: "", moneda: "COP", sueldo_base: 0, variacion_salario_base: 0, fecha_ingreso: "", fecha_termino: "", es_argentina: false, monto_ars_usd: 0, preferencia_pago: "Banco", correo_wallet: "", usuario_wallet: "", banco: "", tipo_cuenta: "", numero_cuenta: "", observaciones: "" });
  const [empSearchQ, setEmpSearchQ] = useState("");
  const [empSearchResults, setEmpSearchResults] = useState<Record<string,unknown>[]>([]);
  const [empSearchLoading, setEmpSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingEmp, setEditingEmp] = useState<PayrollEmployee | null>(null);
  const [editEmpData, setEditEmpData] = useState({ nombre: "", email_global: "", cargo: "", area: "", centro_costo: "", pais: "", moneda: "USD", sueldo_base: 0, variacion_salario_base: 0, fecha_ingreso: "", fecha_termino: "", es_argentina: false, monto_ars_usd: 0, preferencia_pago: "Banco", correo_wallet: "", usuario_wallet: "", banco: "", tipo_cuenta: "", numero_cuenta: "", observaciones: "" });
  const [commentEmp, setCommentEmp] = useState<PayrollEmployee | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"params" | "comisiones" | "nomina_sin_arg" | "argentina" | "subidas_sueldo" | "verificacion" | "checkeo_boleta">("params");
  const [expandedFinalCheck, setExpandedFinalCheck] = useState<string | null>(null);
  const [payrollSearch, setPayrollSearch] = useState("");
  const [salarySearch, setSalarySearch] = useState("");
  const [selectedSalaryEmpId, setSelectedSalaryEmpId] = useState("");
  const [salaryNewAmount, setSalaryNewAmount] = useState("");
  const [salaryChangeComment, setSalaryChangeComment] = useState("");
  const [salaryRaises, setSalaryRaises] = useState<Record<string, { oldBase: number; newBase: number }>>({});
  const [salaryHistory, setSalaryHistory] = useState<PayrollSalaryChange[]>([]);
  const [salaryHistoryError, setSalaryHistoryError] = useState("");
  const [salaryHistoryDrafts, setSalaryHistoryDrafts] = useState<Record<string, { newBase: string; comment: string }>>({});
  const [savingSalaryHistoryId, setSavingSalaryHistoryId] = useState("");
  const [savingSalaryRaise, setSavingSalaryRaise] = useState(false);
  const [boletaRows, setBoletaRows] = useState<BoletaResponseRow[]>([]);
  const [boletaHeaders, setBoletaHeaders] = useState<string[]>([]);
  const [boletaSheetName, setBoletaSheetName] = useState("");
  const [boletaLoading, setBoletaLoading] = useState(false);
  const [boletaError, setBoletaError] = useState("");
  const [geminiReport, setGeminiReport] = useState<GeminiReportRow[]>([]);
  const [geminiAnalyzing, setGeminiAnalyzing] = useState(false);
  const [geminiProgress, setGeminiProgress] = useState({ current: 0, total: 0 });
  const [showCross, setShowCross] = useState(false);
  const boletaFileRef = useRef<HTMLInputElement>(null);
  const cxRef = useRef<HTMLInputElement>(null);
  const b2bRef = useRef<HTMLInputElement>(null);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/nominas/periods");
    setPeriods((await res.json()) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const selectPeriod = useCallback(async (period: PayrollPeriod) => {
    const res = await fetch(`/api/nominas/periods/${period.id}`);
    const data = await res.json();
    setSelected(data);
    setEditParams(data.payroll_params ?? []);
    setUploadStatus({});
    setUploadPreview({});
    const [empRes, comRes, salaryRes, previousReferenceRes] = await Promise.all([
      fetch(`/api/nominas/base?period_id=${period.id}`),
      fetch(`/api/nominas/commissions?period_id=${period.id}`),
      fetch(`/api/nominas/salary-changes?period_id=${period.id}`),
      fetch("/api/nominas/previous-reference"),
    ]);
    setEmployees((await empRes.json()) ?? []);
    setCommissions((await comRes.json()) ?? []);
    try {
      const previousReferenceData = await previousReferenceRes.json();
      const rows = Array.isArray(previousReferenceData?.rows) ? previousReferenceData.rows : [];
      setPreviousReference(period.mes.startsWith("2026-05") ? rows : []);
      setPreviousReferenceError(rows.length > 0 ? "" : (previousReferenceData?.error || "La referencia de abril no trajo filas."));
    } catch {
      setPreviousReference([]);
      setPreviousReferenceError("No se pudo cargar la referencia de abril.");
    }
    const periodsRes = await fetch("/api/nominas/periods");
    const allPeriods = ((await periodsRes.json()) ?? []) as PayrollPeriod[];
    const previous = allPeriods
      .filter(p => p.id !== period.id && p.mes < period.mes)
      .sort((a, b) => b.mes.localeCompare(a.mes))[0];
    if (previous) {
      const [prevDetailRes, prevEmpRes, prevComRes] = await Promise.all([
        fetch(`/api/nominas/periods/${previous.id}`),
        fetch(`/api/nominas/base?period_id=${previous.id}`),
        fetch(`/api/nominas/commissions?period_id=${previous.id}`),
      ]);
      const prevDetail = await prevDetailRes.json();
      setPreviousPayroll({
        period: prevDetail,
        employees: (await prevEmpRes.json()) ?? [],
        commissions: (await prevComRes.json()) ?? [],
        params: prevDetail.payroll_params ?? [],
      });
    } else {
      setPreviousPayroll(null);
    }
    const salaryData = await salaryRes.json();
    if (salaryRes.ok) {
      setSalaryHistory(Array.isArray(salaryData) ? salaryData : []);
      setSalaryHistoryError("");
    } else {
      setSalaryHistory([]);
      setSalaryHistoryError(salaryData.error || "No se pudo cargar el histórico de subidas.");
    }
    setSalaryRaises({});
    setSelectedSalaryEmpId("");
    setSalarySearch("");
    setSalaryNewAmount("");
    setSalaryChangeComment("");
  }, []);

  useEffect(() => {
    if (!selected && periods.length > 0) {
      selectPeriod(periods[0]);
    }
  }, [periods, selected, selectPeriod]);

  useEffect(() => {
    if (!selected?.mes?.startsWith("2026-05") || previousReference.length > 0) return;
    let cancelled = false;
    fetch("/api/nominas/previous-reference", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setPreviousReference(rows);
        setPreviousReferenceError(rows.length > 0 ? "" : (data?.error || "La referencia de abril no trajo filas."));
      })
      .catch(() => {
        if (!cancelled) setPreviousReferenceError("No se pudo cargar la referencia de abril.");
      });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.mes, previousReference.length]);

  const loadBoletaResponses = async () => {
    setBoletaLoading(true);
    setBoletaError("");
    try {
      const res = await fetch(`/api/nominas/boletas/responses${selected?.mes ? `?mes=${encodeURIComponent(selected.mes)}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo leer el Google Sheet de boletas.");
      }
      setBoletaRows(Array.isArray(data?.rows) ? data.rows : []);
      setBoletaHeaders(Array.isArray(data?.headers) ? data.headers : []);
      setBoletaSheetName(String(data?.sheetName ?? ""));
    } catch (error) {
      setBoletaRows([]);
      setBoletaHeaders([]);
      setBoletaSheetName("");
      setBoletaError(error instanceof Error ? error.message : "No se pudo leer el Google Sheet de boletas.");
    } finally {
      setBoletaLoading(false);
    }
  };

  const runGeminiAnalysis = async () => {
    const FILE_CANDIDATES = ["PDF", "Boleta", "Factura", "Archivo", "Comprobante", "Upload", "Adjunto"];
    const EMAIL_CANDIDATES = ["Dirección de correo electrónico", "Correo electrónico", "Correo", "Email", "Mail"];

    const rowsToAnalyze = boletaRows
      .map(row => {
        const email = String(findFieldValue(row, EMAIL_CANDIDATES) ?? "").trim();
        const fileUrl = String(findFieldValue(row, FILE_CANDIDATES) ?? "").trim();
        const rowNumber = row.__rowNumber ?? 0;
        return { formEmail: email, fileUrl, rowNumber };
      })
      .filter(r => r.fileUrl !== "");

    if (rowsToAnalyze.length === 0) {
      setBoletaError("No hay boletas con PDF. Carga las respuestas del formulario primero.");
      return;
    }

    setGeminiAnalyzing(true);
    setGeminiProgress({ current: 0, total: rowsToAnalyze.length });
    setBoletaError("");
    setShowCross(false);
    const newReport: GeminiReportRow[] = [];
    const BATCH = 10;

    for (let i = 0; i < rowsToAnalyze.length; i += BATCH) {
      const batch = rowsToAnalyze.slice(i, i + BATCH);
      try {
        const res = await fetch("/api/nominas/boletas/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch.map(r => ({ email: r.formEmail, fileUrl: r.fileUrl })) }),
        });
        const data = await res.json();
        if (Array.isArray(data.results)) {
          for (let j = 0; j < data.results.length; j++) {
            const r = data.results[j];
            newReport.push({
              formEmail: batch[j].formEmail,
              fileUrl: batch[j].fileUrl,
              rowNumber: batch[j].rowNumber,
              monto: r.monto ?? null,
              moneda: r.moneda ?? null,
              fecha: r.fecha ?? null,
              nombreEnBoleta: r.nombre ?? null,
              error: r.error,
            });
          }
        }
      } catch {
        for (const item of batch) {
          newReport.push({ ...item, monto: null, moneda: null, fecha: null, nombreEnBoleta: null, error: "Error de red" });
        }
      }
      setGeminiProgress({ current: Math.min(i + BATCH, rowsToAnalyze.length), total: rowsToAnalyze.length });
    }

    setGeminiReport(newReport);
    setGeminiAnalyzing(false);
  };

  const uploadBoletaExcel = async (file: File | null) => {
    if (!file) return;
    setBoletaLoading(true);
    setBoletaError("");
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheetName = selectBoletasSheetName(workbook.SheetNames, selected?.mes);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error("No se encontró una hoja válida en el Excel.");
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
      const objects = sheetRowsToBoletaObjects(rows);
      setBoletaRows(objects);
      setBoletaHeaders(objects.length > 0 ? Object.keys(objects[0]).filter(key => key !== "__rowNumber") : []);
      setBoletaSheetName(sheetName);
    } catch (error) {
      setBoletaRows([]);
      setBoletaHeaders([]);
      setBoletaSheetName("");
      setBoletaError(error instanceof Error ? error.message : "No se pudo leer el Excel de boletas.");
    } finally {
      setBoletaLoading(false);
      if (boletaFileRef.current) boletaFileRef.current.value = "";
    }
  };

  const deletePeriod = async (period: PayrollPeriod) => {
    if (!confirm(`¿Eliminar el borrador de ${formatMes(period.mes)}? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/nominas/periods/${period.id}`, { method: "DELETE" });
    if (selected?.id === period.id) setSelected(null);
    await loadPeriods();
  };

  const openNewPeriod = () => {
    setCopyFrom(periods.length > 0);
    setCopyFromId(periods[0]?.id ?? "");
    setShowNew(true);
  };

  const createPeriod = async () => {
    setCreating(true);
    const mes = firstDay(newMes.year, newMes.month);
    const body: Record<string, unknown> = { mes, fecha_inicio: mes, fecha_fin: lastDay(newMes.year, newMes.month) };
    if (copyFrom && copyFromId) body.copy_from_period_id = copyFromId;
    const res = await fetch("/api/nominas/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCreating(false);
    if (res.ok) {
      const created = await res.json();
      const skipped = created.copy_summary?.skipped_ended_before_period ?? [];
      const withTermination = created.copy_summary?.copied_with_termination_in_period ?? [];
      setShowNew(false);
      await loadPeriods();
      if (skipped.length > 0 || withTermination.length > 0) {
        const lines = [];
        if (skipped.length > 0) {
          lines.push(`No se copiaron ${skipped.length} persona(s) porque terminaron antes del período.`);
          lines.push(...skipped.slice(0, 8).map((e: { nombre: string; fecha_termino: string }) => `- ${e.nombre}: terminó ${e.fecha_termino}`));
          if (skipped.length > 8) lines.push(`...y ${skipped.length - 8} más.`);
        }
        if (withTermination.length > 0) {
          lines.push(`Se copiaron ${withTermination.length} persona(s) con fecha de término dentro del mes para cálculo proporcional.`);
        }
        alert(lines.join("\n"));
      }
    }
  };

  const generateBase = async () => {
    if (!selected) return;
    setGenerating(true);
    const res = await fetch("/api/nominas/base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_id: selected.id }),
    });
    const data = await res.json();
    if (res.ok) {
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      setEmployees((await empRes.json()) ?? []);
      if (data.excluidos > 0) {
        setGenerateInfo({ excluidos: data.excluidos, excluidos_detalle: data.excluidos_detalle ?? [] });
      } else {
        setGenerateInfo(null);
      }
    } else {
      alert(data.error);
    }
    setGenerating(false);
  };

  const saveParams = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/nominas/periods/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: editParams }),
    });
    setSaving(false);
    await selectPeriod(selected);
  };

  const uploadCommission = async (tipo: "CX" | "B2B", file: File) => {
    if (!selected) return;
    setUploadStatus(s => ({ ...s, [tipo]: "Leyendo..." }));
    const fd = new FormData();
    fd.append("period_id", selected.id);
    fd.append("tipo", tipo);
    fd.append("file", file);
    const res = await fetch("/api/nominas/commissions", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setUploadStatus(s => ({ ...s, [tipo]: `✓ ${data.inserted} registros · hoja "${data.sheet}"${data.usedHeaders ? " · columnas detectadas" : " · columnas por defecto"}` }));
      setUploadPreview(p => ({ ...p, [tipo]: { sheet: data.sheet, usedHeaders: data.usedHeaders, rows: data.preview ?? [] } }));
      const comRes = await fetch(`/api/nominas/commissions?period_id=${selected.id}`);
      setCommissions((await comRes.json()) ?? []);
    } else {
      setUploadStatus(s => ({ ...s, [tipo]: `Error: ${data.error}` }));
    }
  };

  const reloadCommissions = async () => {
    if (!selected) return;
    const comRes = await fetch(`/api/nominas/commissions?period_id=${selected.id}`);
    setCommissions((await comRes.json()) ?? []);
  };

  const searchCommissionEmployees = useCallback((tipo: CommissionType, q: string) => {
    setCommissionSearchQ(s => ({ ...s, [tipo]: q }));
    if (commissionSearchTimerRef.current) clearTimeout(commissionSearchTimerRef.current);
    if (q.trim().length < 2) {
      setCommissionSearchResults(s => ({ ...s, [tipo]: [] }));
      return;
    }
    commissionSearchTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/nominas/employees?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCommissionSearchResults(s => ({ ...s, [tipo]: Array.isArray(data) ? data : [] }));
    }, 250);
  }, []);

  const selectCommissionEmployee = (tipo: CommissionType, emp: Record<string, unknown>) => {
    const mes = selected?.mes ? formatMes(selected.mes) : "";
    setManualCommissions(s => ({
      ...s,
      [tipo]: {
        dni: String(emp.dni ?? "").trim(),
        nombre: String(emp.nombre ?? ""),
        monto_bruto: s[tipo].monto_bruto,
        moneda: String(emp.moneda ?? s[tipo].moneda ?? "USD"),
        mes: s[tipo].mes || mes,
      },
    }));
    setCommissionSearchQ(s => ({ ...s, [tipo]: String(emp.nombre ?? "") }));
    setCommissionSearchResults(s => ({ ...s, [tipo]: [] }));
  };

  const searchAseguradoEmployees = useCallback((q: string) => {
    setAseguradoSearchQ(q);
    if (commissionSearchTimerRef.current) clearTimeout(commissionSearchTimerRef.current);
    if (q.trim().length < 2) {
      setAseguradoSearchResults([]);
      return;
    }
    commissionSearchTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/nominas/employees?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setAseguradoSearchResults(Array.isArray(data) ? data : []);
    }, 250);
  }, []);

  const selectAseguradoEmployee = (emp: Record<string, unknown>) => {
    const dni = String(emp.dni ?? "").trim();
    const existing = employees.find(e => e.dni.trim() === dni);
    setAseguradoDraft({
      id: existing?.id ?? "",
      dni,
      nombre: String(emp.nombre ?? existing?.nombre ?? ""),
      monto: existing?.asegurado ? String(existing.asegurado) : "",
    });
    setAseguradoSearchQ(String(emp.nombre ?? ""));
    setAseguradoSearchResults([]);
  };

  const saveAsegurado = async () => {
    if (!aseguradoDraft.id || !aseguradoDraft.monto) return;
    setSavingAsegurado(true);
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: aseguradoDraft.id, asegurado: Number(aseguradoDraft.monto) || 0 }),
    });
    if (selected) {
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      setEmployees((await empRes.json()) ?? []);
    }
    setAseguradoDraft({ id: "", dni: "", nombre: "", monto: "" });
    setAseguradoSearchQ("");
    setSavingAsegurado(false);
  };

  const addManualCommission = async (tipo: CommissionType) => {
    if (!selected) return;
    const draft = manualCommissions[tipo];
    if (!draft.dni || !draft.nombre || !draft.monto_bruto) return;
    setSavingCommission(s => ({ ...s, [tipo]: true }));
    const res = await fetch("/api/nominas/commissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: selected.id,
        tipo,
        ...draft,
        monto_bruto: Number(draft.monto_bruto),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setManualCommissions(s => ({
        ...s,
        [tipo]: { dni: "", nombre: "", monto_bruto: "", moneda: "USD", mes: selected?.mes ? formatMes(selected.mes) : "" },
      }));
      setCommissionSearchQ(s => ({ ...s, [tipo]: "" }));
      await reloadCommissions();
    } else {
      alert(data.error || "Error al agregar comisión");
    }
    setSavingCommission(s => ({ ...s, [tipo]: false }));
  };

  const deleteCommission = async (commission: PayrollCommission) => {
    if (!confirm(`¿Eliminar comisión ${commission.tipo} de ${commission.nombre}?`)) return;
    const res = await fetch("/api/nominas/commissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commission.id }),
    });
    if (res.ok) await reloadCommissions();
  };

  const saveNovedades = async () => {
    if (!editingRow) return;
    const body: Record<string, unknown> = { id: editingRow.id, ...editNovedades };
    if (!editNovedades.fecha_termino) body.fecha_termino = null;
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingRow(null);
    if (selected) {
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      setEmployees((await empRes.json()) ?? []);
    }
  };

  const searchEmployees = useCallback((q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) { setEmpSearchResults([]); return; }
    setEmpSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q, target: addEmpTarget });
      if (selected?.id) params.set("period_id", selected.id);
      const res = await fetch(`/api/nominas/employees?${params.toString()}`);
      const data = await res.json();
      setEmpSearchResults(Array.isArray(data) ? data : []);
      setEmpSearchLoading(false);
    }, 280);
  }, [addEmpTarget, selected?.id]);

  const selectEmpFromSearch = (emp: Record<string, unknown>) => {
    setNewEmp({
      dni: String(emp.dni ?? "").trim(),
      nombre: String(emp.nombre ?? ""),
      email_global: String(emp.email_global ?? ""),
      cargo: String(emp.cargo ?? ""),
      area: String(emp.area ?? ""),
      centro_costo: String(emp.centro_costo ?? ""),
      pais: String(emp.pais ?? ""),
      moneda: String(emp.moneda ?? "USD"),
      sueldo_base: Number(emp.sueldo_local) || 0,
      variacion_salario_base: 0,
      fecha_ingreso: String(emp.fecha_ingreso ?? ""),
      fecha_termino: emp.fecha_termino && emp.fecha_termino !== "NA" ? String(emp.fecha_termino) : "",
      es_argentina: String(emp.pais ?? "") === "Argentina",
      monto_ars_usd: 0,
      preferencia_pago: "Banco",
      correo_wallet: "",
      usuario_wallet: "",
      banco: String(emp.banco ?? ""),
      tipo_cuenta: String(emp.tipo_cuenta ?? ""),
      numero_cuenta: String(emp.numero_cuenta ?? ""),
      observaciones: "",
    });
    setEmpSearchResults([]);
    setEmpSearchQ("");
  };

  const openAddEmp = (target: "sin_arg" | "argentina") => {
    setAddEmpTarget(target);
    setNewEmp({ dni: "", nombre: "", email_global: "", cargo: "", area: "", centro_costo: "", pais: target === "argentina" ? "Argentina" : "", moneda: target === "argentina" ? "USD" : "COP", sueldo_base: 0, variacion_salario_base: 0, fecha_ingreso: "", fecha_termino: "", es_argentina: target === "argentina", monto_ars_usd: 0, preferencia_pago: "Banco", correo_wallet: "", usuario_wallet: "", banco: "", tipo_cuenta: "", numero_cuenta: "", observaciones: "" });
    setEmpSearchQ("");
    setEmpSearchResults([]);
    setShowAddEmp(true);
  };

  const addEmployee = async () => {
    if (!selected || !newEmp.dni.trim() || !newEmp.nombre.trim()) return;
    setAddingEmp(true);
    const res = await fetch("/api/nominas/base", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: selected.id,
        ...newEmp,
        email_global: newEmp.email_global || null,
        centro_costo: newEmp.centro_costo || null,
        fecha_ingreso: newEmp.fecha_ingreso || null,
        fecha_termino: newEmp.fecha_termino || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowAddEmp(false);
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      setEmployees((await empRes.json()) ?? []);
    } else {
      alert(data.error);
    }
    setAddingEmp(false);
  };

  const deleteEmployee = async (emp: PayrollEmployee) => {
    if (!confirm(`¿Eliminar a ${emp.nombre} de esta nómina?\n\nEsta acción solo la quita de este período.`)) return;
    const delRes = await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emp.id, _delete: true }),
    });
    if (!delRes.ok) { alert("Error al eliminar. Recargá la página."); return; }
    if (selected) {
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      const empData = await empRes.json();
      if (Array.isArray(empData)) setEmployees(empData);
    }
  };

  const openEditEmp = (emp: PayrollEmployee) => {
    setEditingEmp(emp);
    setEditEmpData({
      nombre: emp.nombre,
      email_global: emp.email_global ?? "",
      cargo: emp.cargo ?? "",
      area: emp.area ?? "",
      centro_costo: emp.centro_costo ?? "",
      pais: emp.pais ?? "",
      moneda: emp.moneda ?? "USD",
      sueldo_base: emp.sueldo_base,
      variacion_salario_base: emp.variacion_salario_base ?? 0,
      fecha_ingreso: emp.fecha_ingreso ?? "",
      fecha_termino: emp.fecha_termino ?? "",
      es_argentina: emp.es_argentina,
      monto_ars_usd: emp.monto_ars_usd,
      preferencia_pago: emp.preferencia_pago ?? "Banco",
      correo_wallet: emp.correo_wallet ?? "",
      usuario_wallet: emp.usuario_wallet ?? "",
      banco: emp.banco ?? "",
      tipo_cuenta: emp.tipo_cuenta ?? "",
      numero_cuenta: emp.numero_cuenta ?? "",
      observaciones: emp.observaciones ?? "",
    });
  };

  const saveEditEmp = async () => {
    if (!editingEmp) return;
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingEmp.id,
        ...editEmpData,
        fecha_ingreso: editEmpData.fecha_ingreso || null,
        fecha_termino: editEmpData.fecha_termino || null,
      }),
    });
    setEditingEmp(null);
    if (selected) {
      const empRes = await fetch(`/api/nominas/base?period_id=${selected.id}`);
      setEmployees((await empRes.json()) ?? []);
    }
  };

  const saveArs = async (emp: PayrollEmployee, monto: number) => {
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emp.id, monto_ars_usd: monto }),
    });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, monto_ars_usd: monto } : e));
  };

  const updateLocalField = (empId: string, field: PayrollEditableField, value: unknown) => {
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, [field]: value } : e));
  };

  const saveField = async (empId: string, field: PayrollEditableField, value: unknown) => {
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: empId, [field]: value }),
    });
    updateLocalField(empId, field, value);
  };

  const applySalaryRaise = async () => {
    const newAmount = Number(salaryNewAmount);
    const current = employees.find(e => e.id === selectedSalaryEmpId);
    if (!selectedSalaryEmpId || !current || !Number.isFinite(newAmount) || newAmount <= 0) return;
    const oldBase = salaryRaises[selectedSalaryEmpId]?.oldBase ?? current.sueldo_base;
    setSavingSalaryRaise(true);
    await fetch("/api/nominas/base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedSalaryEmpId, sueldo_base: newAmount }),
    });
    const historyRes = await fetch("/api/nominas/salary-changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: current.period_id,
        payroll_employee_id: current.id,
        dni: current.dni,
        nombre: current.nombre,
        pais: current.pais,
        cargo: current.cargo,
        moneda: current.moneda,
        old_base: oldBase,
        new_base: newAmount,
        comment: salaryChangeComment.trim() || null,
      }),
    });
    const historyData = await historyRes.json();
    if (historyRes.ok) {
      setSalaryHistory(prev => [historyData, ...prev]);
      setSalaryHistoryError("");
    } else {
      setSalaryHistoryError(historyData.error || "Se aplicó la subida, pero no se pudo guardar el histórico.");
    }
    setEmployees(prev => prev.map(e => e.id === selectedSalaryEmpId ? { ...e, sueldo_base: newAmount } : e));
    setSalaryRaises(prev => ({ ...prev, [selectedSalaryEmpId]: { oldBase, newBase: newAmount } }));
    setSalaryChangeComment("");
    setSavingSalaryRaise(false);
  };

  const editSalaryHistory = async (change: PayrollSalaryChange) => {
    const draft = salaryHistoryDrafts[change.id] ?? { newBase: String(change.new_base), comment: change.comment ?? "" };
    const newBase = Number(draft.newBase);
    if (!Number.isFinite(newBase) || newBase <= 0) return;
    setSavingSalaryHistoryId(change.id);
    const res = await fetch("/api/nominas/salary-changes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: change.id, new_base: newBase, comment: draft.comment.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setSalaryHistory(prev => prev.map(item => item.id === change.id ? data : item));
      if (change.payroll_employee_id) {
        setEmployees(prev => prev.map(emp => emp.id === change.payroll_employee_id ? { ...emp, sueldo_base: newBase } : emp));
      }
      setSalaryHistoryError("");
    } else {
      setSalaryHistoryError(data.error || "No se pudo editar la subida.");
    }
    setSavingSalaryHistoryId("");
  };

  const deleteSalaryHistory = async (change: PayrollSalaryChange) => {
    if (!confirm(`¿Eliminar la subida de ${change.nombre}? Se revertirá el sueldo base al valor anterior (${fmt(change.old_base)} ${change.moneda}).`)) return;
    setSavingSalaryHistoryId(change.id);
    const res = await fetch("/api/nominas/salary-changes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: change.id, revert: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setSalaryHistory(prev => prev.filter(item => item.id !== change.id));
      if (change.payroll_employee_id) {
        setEmployees(prev => prev.map(emp => emp.id === change.payroll_employee_id ? { ...emp, sueldo_base: Number(change.old_base) || 0 } : emp));
      }
      setSalaryHistoryError("");
    } else {
      setSalaryHistoryError(data.error || "No se pudo eliminar la subida.");
    }
    setSavingSalaryHistoryId("");
  };

  const openComment = (emp: PayrollEmployee) => {
    setCommentEmp(emp);
    setCommentDraft(emp.observaciones ?? "");
  };

  const saveComment = async () => {
    if (!commentEmp) return;
    const value = commentDraft.trim() || null;
    await saveField(commentEmp.id, "observaciones", value);
    setCommentEmp(null);
    setCommentDraft("");
  };

  const CommentButton = ({ emp }: { emp: PayrollEmployee }) => {
    const hasComment = Boolean(emp.observaciones?.trim());
    return (
      <button
        onClick={() => openComment(emp)}
        title={hasComment ? emp.observaciones ?? "Comentario" : "Agregar comentario"}
        style={{
          flexShrink: 0,
          position: "relative",
          width: 24,
          height: 18,
          borderRadius: 9,
          background: hasComment ? "#dbeafe" : "#fff",
          border: `1px solid ${hasComment ? "#60a5fa" : "var(--g66-border)"}`,
          color: hasComment ? "#1d4ed8" : "var(--g66-muted)",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 800,
          lineHeight: "16px",
          textAlign: "center",
          padding: 0,
        }}
      >
        {hasComment ? "1" : ""}
        <span style={{
          position: "absolute",
          left: 5,
          bottom: -4,
          width: 7,
          height: 7,
          background: hasComment ? "#dbeafe" : "#fff",
          borderLeft: `1px solid ${hasComment ? "#60a5fa" : "var(--g66-border)"}`,
          borderBottom: `1px solid ${hasComment ? "#60a5fa" : "var(--g66-border)"}`,
          transform: "rotate(-22deg)",
        }} />
      </button>
    );
  };

  const payrollComparisonForRow = (r: CalcRow) => {
    const salaryChange = salaryHistory.find(change =>
      change.payroll_employee_id === r.id || String(change.dni ?? "").trim() === r.dni.trim()
    );
    const previous = previousByDni.get(r.dni.trim());
    if (!previous) {
      const reference = previousReferenceByDni.get(r.dni.trim());
      const baseAnterior = Number(salaryChange?.old_base ?? 0) > 0
        ? Number(salaryChange?.old_base)
        : Number(reference?.sueldo_base ?? 0) > 0
          ? Number(reference?.sueldo_base)
          : r.sueldo_base;
      const netoAnterior = Number(reference?.sueldo_imponible ?? 0) > 0
        ? Number(reference?.sueldo_imponible)
        : r.dias_mes > 0
          ? (baseAnterior / r.dias_mes) * r.dias_neto
          : 0;
      const currentCommissions = r.comision_cx + r.comision_b2b;
      const previousCommissions = Number(reference?.comisiones ?? 0) || APRIL_2026_COMMISSION_REFERENCE[r.dni.trim()] || 0;
      const commissionVariation = previousCommissions !== 0
        ? ((currentCommissions / previousCommissions) - 1) * 100
        : null;
      const historicalCommissionVariation = reference?.var_comisiones_pct ?? null;
      const hasCurrentMovements =
        Boolean(salaryChange) ||
        currentCommissions !== 0 ||
        Number(r.asegurado_proporcional ?? 0) !== 0 ||
        Number(r.otros_ingresos ?? 0) !== 0 ||
        Number(r.descuento_boutique ?? 0) !== 0 ||
        Number(r.otros_descuentos ?? 0) !== 0 ||
        Number(r.dias_descuento ?? 0) !== 0 ||
        Number(r.horas_extra ?? 0) !== 0;

      return {
        base: baseAnterior !== 0 ? ((r.sueldo_base / baseAnterior) - 1) * 100 : null,
        neto: netoAnterior !== 0 ? ((r.sueldo_imponible / netoAnterior) - 1) * 100 : null,
        comisiones: commissionVariation ?? historicalCommissionVariation,
        check: hasCurrentMovements || Math.abs(commissionVariation ?? historicalCommissionVariation ?? 0) >= 0.005 ? "Revisar" : "Ok",
      };
    }
    const currentCommissions = r.comision_cx + r.comision_b2b;
    const previousCommissions = previous.comision_cx + previous.comision_b2b;
    const commissionVariation = previousCommissions !== 0 ? ((currentCommissions / previousCommissions) - 1) * 100 : null;
    return {
      base: previous.sueldo_base !== 0 ? ((r.sueldo_base / previous.sueldo_base) - 1) * 100 : null,
      neto: previous.sueldo_imponible !== 0 ? ((r.sueldo_imponible / previous.sueldo_imponible) - 1) * 100 : null,
      comisiones: commissionVariation,
      check: Math.abs(commissionVariation ?? 0) >= 0.005 ? "Revisar" : "Ok",
    };
  };

  const payrollMovementDetailsForRow = (r: CalcRow) => {
    const salaryChange = salaryHistory.find(change =>
      change.payroll_employee_id === r.id || String(change.dni ?? "").trim() === r.dni.trim()
    );
    const previous = previousByDni.get(r.dni.trim());
    const reference = previousReferenceByDni.get(r.dni.trim());
    const comparison = payrollComparisonForRow(r);
    const previousBase = previous?.sueldo_base
      ?? (Number(salaryChange?.old_base ?? 0) > 0 ? Number(salaryChange?.old_base) : undefined)
      ?? reference?.sueldo_base
      ?? r.sueldo_base;
    const previousNet = previous?.sueldo_imponible ?? reference?.sueldo_imponible ?? 0;
    const previousCommissions = previous
      ? previous.comision_cx + previous.comision_b2b
      : Number(reference?.comisiones ?? 0) || APRIL_2026_COMMISSION_REFERENCE[r.dni.trim()] || 0;
    const historicalCommissionText = !previous && reference?.var_comisiones_pct !== null && reference?.var_comisiones_pct !== undefined
      ? ` | variacion historica abril ${formatPct(reference.var_comisiones_pct)}`
      : "";

    const movements: string[] = [];
    if (Math.abs(comparison.base ?? 0) >= 0.005) {
      movements.push(`Salario base: ${fmt(previousBase)} -> ${fmt(r.sueldo_base)} (${formatPct(comparison.base)})`);
    }
    if (Number(r.variacion_salario_base ?? 0) !== 0) {
      movements.push(`Variacion manual sueldo base: ${formatPct(Number(r.variacion_salario_base))}`);
    }
    if (r.comision_cx !== 0) movements.push(`Comision CX: +${fmt(r.comision_cx)}`);
    if (r.comision_b2b !== 0) movements.push(`Comision B2B: +${fmt(r.comision_b2b)}`);
    if (r.asegurado_proporcional !== 0) movements.push(`Asegurado proporcional: +${fmt(r.asegurado_proporcional)}`);
    if (r.otros_ingresos !== 0) movements.push(`Otros ingresos: +${fmt(r.otros_ingresos)}`);
    if (r.horas_extra !== 0) movements.push(`Horas extra: ${fmt(r.horas_extra, 2)} hrs`);
    if (r.dias_descuento !== 0) movements.push(`Dias descuento: -${fmt(r.dias_descuento, 2)}`);
    if (r.descuento_boutique !== 0) movements.push(`Desc. Boutique: -${fmt(r.descuento_boutique)}`);
    if (r.otros_descuentos !== 0) movements.push(`Otros descuentos: -${fmt(r.otros_descuentos)}`);
    if (r.dias_base !== r.dias_mes) movements.push(`Dias base proporcional: ${fmt(r.dias_base, 2)}/${fmt(r.dias_mes, 2)}`);

    return [
      `${r.nombre} (${r.dni})`,
      `Var salario base: ${formatPct(comparison.base)} | anterior ${fmt(previousBase)} | actual ${fmt(r.sueldo_base)}`,
      `Var salario neto: ${formatPct(comparison.neto)} | anterior ${previousNet ? fmt(previousNet) : "N/A"} | actual ${fmt(r.sueldo_imponible)}`,
      `Var comisiones: ${formatPct(comparison.comisiones)} | anterior ${previousCommissions ? fmt(previousCommissions) : "N/A"} | actual ${fmt(r.comision_cx + r.comision_b2b)}${historicalCommissionText}`,
      movements.length ? `Movimientos: ${movements.join(" · ")}` : "Movimientos: sin ingresos, descuentos ni cambios detectados",
    ].join("\n");
  };

  const getPayrollExportData = (scope: PayrollExportScope) => {
    const rows = scope === "sin_arg" ? sinArgRows : argCalcRows;
    const title = scope === "sin_arg" ? "Base sin Argentina" : "Base con Argentina";
    const columns = scope === "sin_arg"
      ? [
          "DNI", "Nombre", "País", "Email", "Cargo", "Área", "Centro costo", "Moneda", "Fecha ingreso", "Fecha término",
          "Sueldo base", "Base ajustada", "Días mes", "Días base", "Días descuento", "Horas extra",
          "Otros ingresos", "Desc. Boutique", "Otros descuentos", "Días neto", "Sueldo proporcional", "Comisión CX",
          "Comisión B2B", "Asegurado", "Asegurado proporcional", "Sueldo imponible", "Retención", "Neto local", "Var salario base", "Var salario neto", "Var comisiones", "Check", "Neto USD", "Preferencia pago",
          "Correo Wallet", "Usuario Wallet", "Pago Wallet", "Pago Banco", "Fecha boleta", "Comentario", "Revisar",
        ]
      : [
          "DNI", "Nombre", "Email", "Cargo", "Área", "Centro costo", "Moneda", "Fecha ingreso", "Fecha término",
          "Sueldo base", "Base ajustada", "Días mes", "Días base", "Días descuento", "Horas extra",
          "Otros ingresos", "Desc. Boutique", "Otros descuentos", "Días neto", "Sueldo proporcional", "Comisión CX",
          "Comisión B2B", "Asegurado", "Asegurado proporcional", "Sueldo imponible", "Retención", "Neto local", "Var salario base", "Var salario neto", "Var comisiones", "Check", "Neto USD", "Monto ARS USD",
          "Monto ARS local", "Pago USD", "Preferencia pago", "Correo Wallet", "Usuario Wallet", "Wallet USD", "Wallet ARS",
          "Banco ARS", "Fecha boleta", "Comentario", "Revisar",
        ];

    const data = rows.map(r => scope === "sin_arg"
      ? [
          r.dni, r.nombre, r.pais ?? "", r.email_global ?? "", r.cargo ?? "", r.area ?? "", r.centro_costo ?? "", r.moneda,
          fmtDate(r.fecha_ingreso), fmtDate(r.fecha_termino), r.sueldo_base, r.sueldo_base_ajustado,
          r.dias_mes, r.dias_base, r.dias_descuento, r.horas_extra, r.otros_ingresos, r.descuento_boutique,
          r.otros_descuentos, r.dias_neto, r.sueldo_proporcional, r.comision_cx, r.comision_b2b, r.asegurado ?? 0,
          r.asegurado_proporcional, r.sueldo_imponible, r.retencion_amt, r.sueldo_neto_local,
          formatPct(payrollComparisonForRow(r).base), formatPct(payrollComparisonForRow(r).neto), formatPct(payrollComparisonForRow(r).comisiones), payrollComparisonForRow(r).check,
          r.sueldo_neto_usd, r.preferencia_pago ?? "Banco", r.correo_wallet ?? "", r.usuario_wallet ?? "",
          r.pago_wallet_local, r.pago_banco_local, fmtDate(r.fecha_boleta), r.observaciones ?? "", r.revisar ? "Revisar" : "",
        ]
      : [
          r.dni, r.nombre, r.email_global ?? "", r.cargo ?? "", r.area ?? "", r.centro_costo ?? "", r.moneda,
          fmtDate(r.fecha_ingreso), fmtDate(r.fecha_termino), r.sueldo_base, r.sueldo_base_ajustado,
          r.dias_mes, r.dias_base, r.dias_descuento, r.horas_extra, r.otros_ingresos, r.descuento_boutique,
          r.otros_descuentos, r.dias_neto, r.sueldo_proporcional, r.comision_cx, r.comision_b2b, r.asegurado ?? 0,
          r.asegurado_proporcional, r.sueldo_imponible, r.retencion_amt, r.sueldo_neto_local,
          formatPct(payrollComparisonForRow(r).base), formatPct(payrollComparisonForRow(r).neto), formatPct(payrollComparisonForRow(r).comisiones), payrollComparisonForRow(r).check,
          r.sueldo_neto_usd, r.monto_ars_usd, r.pago_ars_local, r.pago_usd,
          r.preferencia_pago ?? "Banco", r.correo_wallet ?? "", r.usuario_wallet ?? "", r.pago_wallet_usd, r.pago_wallet_ars, r.pago_banco_ars,
          fmtDate(r.fecha_boleta), r.observaciones ?? "", r.revisar ? "Revisar" : "",
        ]);

    return { rows, title, columns, data };
  };

  const exportPayrollExcel = async (scope: PayrollExportScope) => {
    if (!selected) return;
    const { rows, title, columns, data } = getPayrollExportData(scope);
    if (rows.length === 0) return;

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const generatedAt = new Date().toLocaleString("es-CL");
    const fileScope = scope === "sin_arg" ? "base-sin-argentina" : "base-con-argentina";
    const fileName = `nomina-${fileScope}-${selected.mes.slice(0, 7)}.xlsx`;

    const totalLocal = rows.reduce((sum, r) => sum + r.sueldo_neto_local, 0);
    const totalNetoUsd = rows.reduce((sum, r) => sum + r.sueldo_neto_usd, 0);
    const totalWallet = scope === "sin_arg"
      ? rows.reduce((sum, r) => sum + r.pago_wallet_local, 0)
      : rows.reduce((sum, r) => sum + r.pago_wallet_usd, 0);
    const totalBanco = scope === "sin_arg"
      ? rows.reduce((sum, r) => sum + r.pago_banco_local, 0)
      : rows.reduce((sum, r) => sum + r.pago_banco_ars, 0);

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Global66 People", title],
      ["Período", formatMes(selected.mes)],
      ["Rango", `${selected.fecha_inicio} al ${selected.fecha_fin}`],
      ["Generado", generatedAt],
      [],
      ["Indicador", "Valor"],
      ["Personas", rows.length],
      ["Neto USD", totalNetoUsd],
      ["Neto local", totalLocal],
      [scope === "sin_arg" ? "Pago Wallet local" : "Pago Wallet USD", totalWallet],
      [scope === "sin_arg" ? "Pago Banco local" : "Pago Banco ARS", totalBanco],
      ["Filas marcadas revisar", rows.filter(r => r.revisar).length],
    ]);
    summarySheet["!cols"] = [{ wch: 26 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

    const payrollSheet = XLSX.utils.aoa_to_sheet([
      [`Global66 People - ${title}`],
      [`${formatMes(selected.mes)} · ${selected.fecha_inicio} al ${selected.fecha_fin}`],
      [],
      columns,
      ...data,
    ]);
    payrollSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columns.length - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(columns.length - 1, 0) } },
    ];
    payrollSheet["!freeze"] = { xSplit: 0, ySplit: 4 };
    payrollSheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: data.length + 3, c: columns.length - 1 } }) };
    payrollSheet["!cols"] = columns.map((col, index) => {
      if (["Nombre", "Email", "Cargo", "Comentario"].includes(col)) return { wch: index === 1 ? 34 : 28 };
      if (["Área", "Centro costo", "Correo Wallet", "Usuario Wallet"].includes(col)) return { wch: 22 };
      if (col.includes("Fecha")) return { wch: 14 };
      if (col.includes("Sueldo") || col.includes("Pago") || col.includes("Neto") || col.includes("Comisión") || col.includes("Retención") || col.includes("ARS")) return { wch: 15 };
      return { wch: 12 };
    });
    XLSX.utils.book_append_sheet(workbook, payrollSheet, "Nómina");

    const paramsSheet = XLSX.utils.json_to_sheet(editParams.map(p => ({
      Moneda: p.moneda,
      TDC_USD: p.tdc_usd,
      Retencion: p.retencion,
      "Retencion %": p.retencion * 100,
    })));
    paramsSheet["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, paramsSheet, "Parámetros");

    const scopeDnis = new Set(rows.map(r => r.dni.trim()));
    const commissionSheet = XLSX.utils.json_to_sheet(
      commissions
        .filter(c => scopeDnis.has(c.dni.trim()))
        .map(c => ({ Tipo: c.tipo, DNI: c.dni, Nombre: c.nombre, Moneda: c.moneda, Monto: c.monto_bruto, Mes: c.mes }))
    );
    commissionSheet["!cols"] = [{ wch: 10 }, { wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, commissionSheet, "Comisiones");

    XLSX.writeFile(workbook, fileName, { compression: true });
  };

  const exportSalaryHistoryExcel = async () => {
    if (salaryHistory.length === 0) return;
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const rows = salaryHistory.map(change => ({
      Fecha: new Date(change.created_at).toLocaleString("es-CL"),
      Periodo: selected ? formatMes(selected.mes) : change.period_id,
      DNI: change.dni,
      Nombre: change.nombre,
      Pais: change.pais ?? "",
      Cargo: change.cargo ?? "",
      Moneda: change.moneda,
      "Sueldo anterior": change.old_base,
      "Sueldo nuevo": change.new_base,
      Diferencia: change.diff_amount,
      "Variacion %": change.diff_pct * 100,
      Comentario: change.comment ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 28 },
      { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Histórico");
    XLSX.writeFile(workbook, `historico-subidas-sueldo-${selected?.mes.slice(0, 7) ?? "global"}.xlsx`, { compression: true });
  };

  const exportBankTemplate = async (scope: PayrollExportScope) => {
    if (!selected) return;

    const baseRows = scope === "sin_arg" ? sinArgRows : argCalcRows;
    const rows = baseRows.filter(r => {
      const bankAmount = scope === "sin_arg" ? r.pago_banco_local : r.pago_banco_ars;
      const pref = r.preferencia_pago ?? "Banco";
      return pref !== "Wallet" && bankAmount > 0;
    });
    if (rows.length === 0) {
      alert("No hay personas con pago Banco en esta nómina.");
      return;
    }

    const incomplete = rows.filter(r => !String(r.banco ?? "").trim() || !String(r.numero_cuenta ?? "").trim());
    if (incomplete.length > 0) {
      const sample = incomplete.slice(0, 8).map(r => `- ${r.nombre}`).join("\n");
      const proceed = window.confirm(
        `Hay ${incomplete.length} persona(s) sin banco o número de cuenta. Igual voy a descargar la plantilla con esos campos en blanco.\n\n${sample}${incomplete.length > 8 ? "\n..." : ""}`
      );
      if (!proceed) return;
    }

    const templateRes = await fetch("/templates/PlantillaBeneficiarios_Peru.xlsm");
    if (!templateRes.ok) {
      alert("No pude cargar la plantilla bancaria.");
      return;
    }

    const PizZip = (await import("pizzip")).default;
    const zip = new PizZip(await templateRes.arrayBuffer());
    const sheetPath = "xl/worksheets/sheet1.xml";
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) {
      alert("La plantilla bancaria no tiene la hoja Cuenta Bancaria esperada.");
      return;
    }

    const data = rows.map(r => {
      const name = splitBeneficiaryName(r.nombre);
      const bankAmount = scope === "sin_arg" ? r.pago_banco_local : r.pago_banco_ars;
      return [
        normalizeBankCountry(r.pais),
        "Persona",
        name.nombre,
        name.apellido,
        normalizeBankDocumentType(r.pais),
        String(r.dni ?? "").replace(/[^\dA-Za-z]/g, ""),
        normalizeBankAccountType(r.tipo_cuenta),
        String(r.numero_cuenta ?? "").trim(),
        normalizeBankName(r.banco),
        "Destino",
        Math.round(bankAmount),
        "",
      ];
    });

    let sheetXml = replaceBankSheetData(sheetFile.asText(), data);
    sheetXml = setSheetAutoFilter(sheetXml, `A4:L${Math.max(data.length + 4, 5)}`);
    zip.file(sheetPath, sheetXml);

    const fileScope = scope === "sin_arg" ? "base-sin-argentina" : "base-con-argentina";
    const fileName = `plantilla-banco-${fileScope}-${selected.mes.slice(0, 7)}.xlsm`;
    const output = zip.generate({
      type: "blob",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      compression: "DEFLATE",
    });
    const url = URL.createObjectURL(output);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportWalletExcel = async (scope: PayrollExportScope) => {
    if (!selected) return;

    const baseRows = scope === "sin_arg" ? sinArgRows : argCalcRows;
    const rows = baseRows.filter(r => {
      const walletAmount = scope === "sin_arg"
        ? r.pago_wallet_local
        : r.pago_wallet_usd + r.pago_wallet_ars;
      return walletAmount > 0 || String(r.correo_wallet ?? "").trim() || String(r.usuario_wallet ?? "").trim();
    });

    if (rows.length === 0) {
      alert("No hay personas con datos o pago Wallet en esta nómina.");
      return;
    }

    const incomplete = rows.filter(r => !String(r.correo_wallet ?? "").trim() || !String(r.usuario_wallet ?? "").trim());
    if (incomplete.length > 0) {
      const sample = incomplete.slice(0, 8).map(r => `- ${r.nombre}`).join("\n");
      const proceed = window.confirm(
        `Hay ${incomplete.length} persona(s) sin correo o usuario Wallet. Igual voy a descargar el Excel con esos campos en blanco.\n\n${sample}${incomplete.length > 8 ? "\n..." : ""}`
      );
      if (!proceed) return;
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const walletExportRows = rows.flatMap(row => {
      if (scope === "sin_arg") {
        return [{
          moneda: String(row.moneda || "SIN_MONEDA").trim() || "SIN_MONEDA",
          row,
          monto: row.pago_wallet_local,
        }];
      }
      const out: { moneda: string; row: CalcRow; monto: number }[] = [];
      if (row.pago_wallet_usd > 0) out.push({ moneda: "USD", row, monto: row.pago_wallet_usd });
      if (row.pago_wallet_ars > 0) out.push({ moneda: "ARS", row, monto: row.pago_wallet_ars });
      if (out.length === 0) out.push({ moneda: "USD", row, monto: 0 });
      return out;
    });
    const byCurrency = walletExportRows.reduce((acc, item) => {
      if (!acc[item.moneda]) acc[item.moneda] = [];
      acc[item.moneda].push(item);
      return acc;
    }, {} as Record<string, { moneda: string; row: CalcRow; monto: number }[]>);

    Object.entries(byCurrency)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([moneda, currencyRows]) => {
        const data = currencyRows
          .slice()
          .sort((a, b) => a.row.nombre.localeCompare(b.row.nombre))
          .map(({ row, monto }) => ({
            Nombre: row.nombre,
            DNI: row.dni,
            "Correo Wallet": row.correo_wallet ?? "",
            "Usuario Wallet": row.usuario_wallet ?? "",
            "Monto Wallet": Math.round(monto),
            Moneda: moneda,
          }));
        const sheet = XLSX.utils.json_to_sheet(data);
        sheet["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 34 }, { wch: 22 }, { wch: 16 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(workbook, sheet, moneda.slice(0, 31));
      });

    const fileScope = scope === "sin_arg" ? "base-sin-argentina" : "base-con-argentina";
    XLSX.writeFile(workbook, `wallet-${fileScope}-${selected.mes.slice(0, 7)}.xlsx`, { compression: true });
  };

  const exportPayrollPdf = (scope: "sin_arg" | "argentina") => {
    if (!selected) return;
    const rows = scope === "sin_arg" ? sinArgRows : argCalcRows;
    if (rows.length === 0) return;

    const title = scope === "sin_arg" ? "Base sin Argentina" : "Base con Argentina";
    const logoUrl = `${window.location.origin}/logo.jpg`;
    const paramsHtml = editParams
      .map(p => `<span><strong>${escapeHtml(p.moneda)}</strong> TDC ${escapeHtml(fmt(p.tdc_usd, 4))} · Ret. ${escapeHtml((p.retencion * 100).toFixed(2))}%</span>`)
      .join("");
    const totalLocal = rows.reduce((sum, r) => sum + r.sueldo_neto_local, 0);
    const totalNetoUsd = rows.reduce((sum, r) => sum + r.sueldo_neto_usd, 0);
    const totalWallet = scope === "sin_arg"
      ? rows.reduce((sum, r) => sum + r.pago_wallet_local, 0)
      : rows.reduce((sum, r) => sum + r.pago_wallet_usd, 0);
    const totalBanco = scope === "sin_arg"
      ? rows.reduce((sum, r) => sum + r.pago_banco_local, 0)
      : rows.reduce((sum, r) => sum + r.pago_banco_ars, 0);

    const columns = scope === "sin_arg"
      ? [
        "DNI", "Nombre", "Pais", "Area", "Mon.", "F. ingreso", "F. termino", "Sueldo base", "Base ajustada",
        "Dias base", "Dias desc.", "H. extra", "Otros ing.", "Desc. Boutique", "Otros desc.", "Dias neto",
          "S. prop.", "Com. CX", "Com. B2B", "Asegurado", "Aseg. prop.", "S. imponible", "Retencion", "Neto local", "Var salario base", "Var salario neto", "Var comisiones", "Check", "Neto USD",
          "Pref.", "Correo Wallet", "Usuario Wallet", "Pago Wallet", "Pago Banco", "Boleta", "Comentario", "Rev.",
        ]
      : [
        "DNI", "Nombre", "Area", "Mon.", "F. ingreso", "F. termino", "Sueldo base", "Base ajustada",
        "Dias base", "Dias desc.", "H. extra", "Otros ing.", "Desc. Boutique", "Otros desc.", "Dias neto",
          "S. prop.", "Com. CX", "Com. B2B", "Asegurado", "Aseg. prop.", "S. imponible", "Retencion", "Neto local", "Var salario base", "Var salario neto", "Var comisiones", "Check", "Neto USD",
          "ARS USD", "ARS local", "Pago USD", "Pref.", "Correo Wallet", "Usuario Wallet", "Wallet USD", "Wallet ARS", "Banco ARS", "Boleta", "Comentario", "Rev.",
        ];

    const rowCells = (r: CalcRow) => scope === "sin_arg"
      ? [
          r.dni, r.nombre, r.pais, r.area, r.moneda, fmtDate(r.fecha_ingreso), fmtDate(r.fecha_termino), fmt(r.sueldo_base), fmt(r.sueldo_base_ajustado),
          `${r.dias_base}/${r.dias_mes}`, r.dias_descuento, r.horas_extra, fmt(r.otros_ingresos), fmt(r.descuento_boutique), fmt(r.otros_descuentos), r.dias_neto.toFixed(1),
          fmt(r.sueldo_proporcional), fmt(r.comision_cx), fmt(r.comision_b2b), fmt(r.asegurado ?? 0), fmt(r.asegurado_proporcional), fmt(r.sueldo_imponible), fmt(r.retencion_amt), fmt(r.sueldo_neto_local),
          formatPct(payrollComparisonForRow(r).base), formatPct(payrollComparisonForRow(r).neto), formatPct(payrollComparisonForRow(r).comisiones), payrollComparisonForRow(r).check, fmt(r.sueldo_neto_usd),
          r.preferencia_pago ?? "Banco", r.correo_wallet ?? "", r.usuario_wallet ?? "", fmt(r.pago_wallet_local), fmt(r.pago_banco_local), fmtDate(r.fecha_boleta), r.observaciones ?? "", r.revisar ? "Revisar" : "",
        ]
      : [
          r.dni, r.nombre, r.area, r.moneda, fmtDate(r.fecha_ingreso), fmtDate(r.fecha_termino), fmt(r.sueldo_base), fmt(r.sueldo_base_ajustado),
          `${r.dias_base}/${r.dias_mes}`, r.dias_descuento, r.horas_extra, fmt(r.otros_ingresos), fmt(r.descuento_boutique), fmt(r.otros_descuentos), r.dias_neto.toFixed(1),
          fmt(r.sueldo_proporcional), fmt(r.comision_cx), fmt(r.comision_b2b), fmt(r.asegurado ?? 0), fmt(r.asegurado_proporcional), fmt(r.sueldo_imponible), fmt(r.retencion_amt), fmt(r.sueldo_neto_local),
          formatPct(payrollComparisonForRow(r).base), formatPct(payrollComparisonForRow(r).neto), formatPct(payrollComparisonForRow(r).comisiones), payrollComparisonForRow(r).check, fmt(r.sueldo_neto_usd),
          fmt(r.pago_ars_usd), fmt(r.pago_ars_local), fmt(r.pago_usd), r.preferencia_pago ?? "Banco", r.correo_wallet ?? "", r.usuario_wallet ?? "", fmt(r.pago_wallet_usd), fmt(r.pago_wallet_ars), fmt(r.pago_banco_ars), fmtDate(r.fecha_boleta), r.observaciones ?? "", r.revisar ? "Revisar" : "",
        ];

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(formatMes(selected.mes))}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3b3edb; padding-bottom: 12px; margin-bottom: 12px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { width: 112px; height: auto; border-radius: 6px; }
    .brand-line { width: 1px; height: 36px; background: #d1d5db; }
    .people { color: #3b3edb; font-weight: 800; font-size: 18px; letter-spacing: 0; }
    h1 { margin: 0; font-size: 22px; line-height: 1.1; }
    .period { margin-top: 5px; color: #6b7280; font-size: 11px; }
    .meta { text-align: right; font-size: 11px; color: #4b5563; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; background: #f9fafb; }
    .label { color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
    .value { margin-top: 2px; font-size: 15px; font-weight: 800; color: #111827; }
    .params { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; color: #4b5563; font-size: 9px; }
    .params span { border: 1px solid #e5e7eb; border-radius: 999px; padding: 4px 7px; background: #fff; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${scope === "sin_arg" ? "6.2px" : "5.6px"}; }
    th { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 4px 3px; text-align: right; font-weight: 800; }
    td { border: 1px solid #e5e7eb; padding: 3px 3px; text-align: right; vertical-align: top; overflow-wrap: anywhere; }
    th:first-child, td:first-child { text-align: left; width: 76px; }
    th:nth-child(2), td:nth-child(2) { text-align: left; width: 120px; }
    tr:nth-child(even) td { background: #fafafa; }
    .name { font-weight: 700; color: #111827; }
    .muted { color: #6b7280; }
    .review td { background: #fef9c3 !important; }
    .footer { margin-top: 8px; color: #6b7280; font-size: 9px; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">
        <img src="${logoUrl}" alt="Global66" />
        <div class="brand-line"></div>
        <div class="people">People</div>
      </div>
    </div>
    <div class="meta">
      <h1>${escapeHtml(title)}</h1>
      <div class="period">${escapeHtml(formatMes(selected.mes))} · ${escapeHtml(selected.fecha_inicio)} al ${escapeHtml(selected.fecha_fin)}</div>
      <div>Generado: ${escapeHtml(new Date().toLocaleString("es-CL"))}</div>
    </div>
  </div>
  <div class="summary">
    <div class="card"><div class="label">Personas</div><div class="value">${rows.length}</div></div>
    <div class="card"><div class="label">Neto USD</div><div class="value">${escapeHtml(fmt(totalNetoUsd))}</div></div>
    <div class="card"><div class="label">Neto local</div><div class="value">${escapeHtml(fmt(totalLocal))}</div></div>
    <div class="card"><div class="label">${scope === "sin_arg" ? "Pago Wallet local" : "Pago Wallet USD"}</div><div class="value">${escapeHtml(fmt(totalWallet))}</div></div>
    <div class="card"><div class="label">${scope === "sin_arg" ? "Pago Banco local" : "Pago Banco ARS"}</div><div class="value">${escapeHtml(fmt(totalBanco))}</div></div>
  </div>
  <div class="params">${paramsHtml}</div>
  <table>
    <thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map(r => `<tr class="${r.revisar ? "review" : ""}">${rowCells(r).map((cell, index) => `<td class="${index === 1 ? "name" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <div class="footer">
    <span>Global66 People · Nómina de servicios</span>
    <span>${escapeHtml(title)} · ${escapeHtml(formatMes(selected.mes))}</span>
  </div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert("El navegador bloqueó la ventana de PDF. Habilitá pop-ups para esta página.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const calcRows = selected ? employees.map(e => calcRow(e, selected, editParams, commissions)) : [];
  const previousCalcRows = previousPayroll
    ? previousPayroll.employees.map(e => calcRow(e, previousPayroll.period, previousPayroll.params, previousPayroll.commissions))
    : [];
  const previousByDni = new Map(previousCalcRows.map(r => [r.dni.trim(), r]));
  const previousReferenceByDni = new Map(previousReference.map(r => [r.dni.trim(), r]));
  const sinArgRows = calcRows.filter(r => !r.es_argentina);
  const argCalcRows = calcRows.filter(r => r.es_argentina);
  const argEmployees = employees.filter(e => e.es_argentina);
  const boletaExpectedRows: BoletaExpectedRow[] = calcRows.flatMap(r => {
    if (r.sueldo_neto_local <= 0) return [];
    const base = {
      dni: r.dni,
      normalizedDni: normalizeDoc(r.dni),
      normalizedName: normalizePersonName(r.nombre),
      normalizedEmail: normalizeEmail(r.email_global),
      nombre: r.nombre,
      pais: r.pais ?? "",
    };
    if (r.es_argentina) {
      return [
        { key: `${r.id}:USD`, ...base, moneda: "USD", expectedAmount: r.pago_usd },
        { key: `${r.id}:ARS`, ...base, moneda: "ARS", expectedAmount: r.pago_ars_local },
      ].filter(item => item.expectedAmount > 0.5);
    }
    return [{
      key: `${r.id}:${r.moneda}`,
      ...base,
      moneda: r.moneda,
      expectedAmount: r.sueldo_neto_local,
    }];
  });
  const boletaCurrentMonth = selected?.mes.slice(0, 7) ?? "";

  // Group gemini rows by form email and by extracted name for matching
  const geminiByEmail = new Map<string, GeminiReportRow[]>();
  const geminiByName = new Map<string, GeminiReportRow[]>();
  for (const g of geminiReport) {
    const eKey = g.formEmail.toLowerCase().trim();
    if (eKey) geminiByEmail.set(eKey, [...(geminiByEmail.get(eKey) ?? []), g]);
    const nKey = normalizePersonName(g.nombreEnBoleta);
    if (nKey) geminiByName.set(nKey, [...(geminiByName.get(nKey) ?? []), g]);
  }
  const usedGeminiIdx = new Set<number>();

  const crossRows: CrossRow[] = boletaExpectedRows.map(expected => {
    let candidates: GeminiReportRow[] = [];
    if (expected.normalizedEmail) {
      candidates = geminiByEmail.get(expected.normalizedEmail) ?? [];
    }
    if (candidates.length === 0 && expected.normalizedName) {
      candidates = geminiByName.get(expected.normalizedName) ?? [];
    }
    const available = candidates.filter(g => !usedGeminiIdx.has(geminiReport.indexOf(g)));

    let geminiRow: GeminiReportRow | null = null;
    if (expected.pais === "Argentina" && available.length > 1) {
      const sorted = [...available].sort((a, b) => (a.monto ?? 0) - (b.monto ?? 0));
      geminiRow = expected.moneda === "USD" ? sorted[0] : sorted[sorted.length - 1];
    } else {
      geminiRow = available[0] ?? null;
    }
    if (geminiRow) usedGeminiIdx.add(geminiReport.indexOf(geminiRow));

    let status: CrossRow["status"] = "sin_respuesta";
    let diferencia: number | null = null;
    if (geminiRow) {
      if (geminiRow.monto === null) {
        status = "sin_monto";
      } else {
        diferencia = geminiRow.monto - expected.expectedAmount;
        const tolerance = Math.max(1, Math.abs(expected.expectedAmount) * 0.005);
        const dateOk = !geminiRow.fecha || !boletaCurrentMonth || geminiRow.fecha.startsWith(boletaCurrentMonth);
        if (!dateOk) {
          status = "fecha_incorrecta";
        } else if (Math.abs(diferencia) > tolerance) {
          status = "monto_distinto";
        } else {
          status = "ok";
        }
      }
    }

    return {
      nombre: expected.nombre,
      emailNomina: expected.normalizedEmail,
      pais: expected.pais,
      moneda: expected.moneda,
      montoNomina: expected.expectedAmount,
      montoGemini: geminiRow?.monto ?? null,
      fechaGemini: geminiRow?.fecha ?? null,
      fileUrl: geminiRow?.fileUrl ?? "",
      formEmail: geminiRow?.formEmail ?? "",
      status,
      diferencia,
    };
  });

  const boletaSummary = {
    total: boletaExpectedRows.length,
    ok: crossRows.filter(r => r.status === "ok").length,
    missing: crossRows.filter(r => r.status === "sin_respuesta").length,
    monto_distinto: crossRows.filter(r => r.status === "monto_distinto").length,
    fecha_incorrecta: crossRows.filter(r => r.status === "fecha_incorrecta").length,
    sin_monto: crossRows.filter(r => r.status === "sin_monto").length,
  };
  const normalizeSearch = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const filterPayrollRows = (rows: CalcRow[]) => {
    const q = normalizeSearch(payrollSearch);
    if (!q) return rows;
    return rows.filter(r => normalizeSearch([
      r.nombre, r.dni, r.email_global, r.cargo, r.area, r.centro_costo, r.pais, r.moneda, r.correo_wallet, r.usuario_wallet,
    ].filter(Boolean).join(" ")).includes(q));
  };
  const filteredSinArgRows = filterPayrollRows(sinArgRows);
  const filteredArgRows = filterPayrollRows(argCalcRows);
  const selectedSalaryRow = calcRows.find(r => r.id === selectedSalaryEmpId) ?? null;
  const salarySearchResults = (() => {
    const q = normalizeSearch(salarySearch);
    if (!q) return [];
    return calcRows
      .filter(r => normalizeSearch([r.nombre, r.dni, r.cargo, r.area, r.pais].filter(Boolean).join(" ")).includes(q))
      .sort((a, b) => String(b.fecha_ingreso ?? "").localeCompare(String(a.fecha_ingreso ?? "")) || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 12);
  })();
  const salaryNew = Number(salaryNewAmount) || 0;
  const salaryOld = selectedSalaryRow?.sueldo_base ?? 0;
  const salaryDiff = selectedSalaryRow ? salaryNew - salaryOld : 0;
  const salaryPct = selectedSalaryRow && salaryOld > 0 ? (salaryDiff / salaryOld) * 100 : 0;
  const salaryRaiseRows = Object.entries(salaryRaises)
    .map(([id, change]) => {
      const row = calcRows.find(r => r.id === id);
      return row ? { row, change } : null;
    })
    .filter((item): item is { row: CalcRow; change: { oldBase: number; newBase: number } } => Boolean(item));
  const salaryHistoryPeople = new Set(salaryHistory.map(change => change.dni.trim())).size;
  const salaryHistoryCountries = new Set(salaryHistory.map(change => change.pais ?? "").filter(Boolean)).size;
  const salaryHistoryAvgPct = salaryHistory.length > 0
    ? (salaryHistory.reduce((sum, change) => sum + Number(change.diff_pct ?? 0), 0) / salaryHistory.length) * 100
    : 0;
  const salaryHistoryTotalDiff = salaryHistory.reduce((sum, change) => sum + Number(change.diff_amount ?? 0), 0);
  const aseguradoRows = calcRows
    .filter(r => Number(r.asegurado ?? 0) > 0)
    .sort((a, b) => String(b.fecha_ingreso ?? "").localeCompare(String(a.fecha_ingreso ?? "")) || a.nombre.localeCompare(b.nombre, "es"));
  const suggestedB2BAseguradoRows = selected
    ? calcRows
        .map(r => ({ ...r, asegurado_window: calcAseguradoWindow(r, selected) }))
        .filter(r => isHunterB2BRole(r) && (r.asegurado_window?.dias ?? 0) > 0)
        .sort((a, b) => {
          const fechaDiff = String(b.fecha_ingreso ?? "").localeCompare(String(a.fecha_ingreso ?? ""));
          return fechaDiff || a.nombre.localeCompare(b.nombre, "es");
        })
    : [];
  const totalUSD = calcRows.reduce((s, r) => s + r.sueldo_neto_usd, 0);

  useEffect(() => {
    setAseguradoB2BDrafts(prev => {
      const next: Record<string, string> = {};
      for (const row of suggestedB2BAseguradoRows) {
        next[row.id] = prev[row.id] ?? (Number(row.asegurado ?? 0) > 0 ? String(row.asegurado) : "");
      }
      return next;
    });
  }, [suggestedB2BAseguradoRows.map(r => `${r.id}:${r.asegurado}`).join("|")]);

  const applyB2BAsegurados = async () => {
    const rowsToSave = suggestedB2BAseguradoRows
      .map(r => ({ id: r.id, monto: Number(aseguradoB2BDrafts[r.id]) || 0 }))
      .filter(r => r.monto > 0);
    if (rowsToSave.length === 0) return;

    setSavingB2BAsegurado(true);
    await Promise.all(rowsToSave.map(r =>
      fetch("/api/nominas/base", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, asegurado: r.monto }),
      })
    ));
    setEmployees(prev => prev.map(emp => {
      const found = rowsToSave.find(r => r.id === emp.id);
      return found ? { ...emp, asegurado: found.monto } : emp;
    }));
    setSavingB2BAsegurado(false);
  };

  // ── Verification data ──────────────────────────────────────────────────
  const dniSet = new Set(employees.map(e => e.dni.trim()));
  const unmatchedCommissions = commissions.filter(c => !dniSet.has(c.dni.trim()));
  const mismatchMoneda = commissions.filter(c => {
    const emp = employees.find(e => e.dni.trim() === c.dni.trim());
    if (!emp) return false;
    return emp.moneda.trim() !== c.moneda.trim();
  });
  const argSinArs = argEmployees.filter(e => e.monto_ars_usd === 0);
  const negativoNeto = calcRows.filter(r => r.sueldo_neto_usd < 0);
  // Terminó ANTES del período (no deberían estar, probablemente agregados manualmente por error)
  const fueraDePeriodo = selected
    ? calcRows.filter(r => r.fecha_termino && r.fecha_termino < selected.fecha_inicio)
    : [];
  // 0 días sin justificación (no tienen fecha_termino que lo explique)
  const cerosDias = calcRows.filter(r => r.dias_neto <= 0 && !r.fecha_termino);
  // Proporcional: trabajaron parte del mes (tienen justificación válida)
  const parciales = calcRows.filter(r => r.pct_mes < 0.999 && r.pct_mes > 0);
  const paymentChecks = (() => {
    const checks: { grupo: string; moneda: string; base: number; wallet: number; banco: number; totalPago: number; diff: number; ok: boolean }[] = [];
    const tolerance = 0.5;
    const pushCheck = (grupo: string, moneda: string, base: number, wallet: number, banco: number) => {
      const totalPago = wallet + banco;
      const diff = totalPago - base;
      checks.push({ grupo, moneda, base, wallet, banco, totalPago, diff, ok: Math.abs(diff) <= tolerance });
    };

    const sinArgByCurrency = sinArgRows.reduce((acc, r) => {
      const key = r.moneda || "?";
      if (!acc[key]) acc[key] = { base: 0, wallet: 0, banco: 0 };
      acc[key].base += r.sueldo_neto_local;
      acc[key].wallet += r.pago_wallet_local;
      acc[key].banco += r.pago_banco_local;
      return acc;
    }, {} as Record<string, { base: number; wallet: number; banco: number }>);
    Object.entries(sinArgByCurrency).forEach(([moneda, v]) => pushCheck("Sin ARG local", moneda, v.base, v.wallet, v.banco));

    const argUsd = argCalcRows.reduce((acc, r) => {
      acc.base += r.sueldo_neto_usd;
      acc.wallet += r.pago_wallet_usd;
      acc.banco += r.pago_ars_usd;
      return acc;
    }, { base: 0, wallet: 0, banco: 0 });
    pushCheck("Argentina USD total", "USD", argUsd.base, argUsd.wallet, argUsd.banco);

    const argArs = argCalcRows.reduce((acc, r) => {
      acc.base += r.pago_ars_local;
      acc.wallet += r.pago_wallet_ars;
      acc.banco += r.pago_banco_ars;
      return acc;
    }, { base: 0, wallet: 0, banco: 0 });
    pushCheck("Argentina ARS", "ARS", argArs.base, argArs.wallet, argArs.banco);

    return checks;
  })();
  const paymentTotalsByCurrency = (() => {
    const totals: Record<string, { wallet: number; banco: number; total: number }> = {};
    const ensure = (moneda: string) => {
      if (!totals[moneda]) totals[moneda] = { wallet: 0, banco: 0, total: 0 };
      return totals[moneda];
    };
    sinArgRows.forEach(r => {
      const item = ensure(r.moneda || "?");
      item.wallet += r.pago_wallet_local;
      item.banco += r.pago_banco_local;
    });
    argCalcRows.forEach(r => {
      const usd = ensure("USD");
      usd.wallet += r.pago_wallet_usd;
      const ars = ensure("ARS");
      ars.wallet += r.pago_wallet_ars;
      ars.banco += r.pago_banco_ars;
    });
    Object.values(totals).forEach(v => { v.total = v.wallet + v.banco; });
    return totals;
  })();
  const paymentCurrencyOrder = ["CLP", "COP", "PEN", "ARS", "USD", "EUR"];
  const failedPaymentChecks = paymentChecks.filter(c => !c.ok);
  const walletDataIssues = calcRows.filter(r => {
    const requiresWallet = r.es_argentina
      ? (r.pago_wallet_usd > 0 || r.pago_wallet_ars > 0)
      : r.pago_wallet_local > 0;
    return requiresWallet && (!String(r.correo_wallet ?? "").trim() || !String(r.usuario_wallet ?? "").trim());
  });
  const bankDataIssues = calcRows.filter(r => {
    const requiresBank = r.es_argentina ? r.pago_banco_ars > 0 : r.pago_banco_local > 0;
    return requiresBank && (!String(r.banco ?? "").trim() || !String(r.numero_cuenta ?? "").trim());
  });
  const novedadesRows = calcRows
    .filter(r =>
      Number(r.horas_extra ?? 0) !== 0 ||
      Number(r.otros_ingresos ?? 0) !== 0 ||
      Number(r.asegurado_proporcional ?? 0) !== 0 ||
      Number(r.descuento_boutique ?? 0) !== 0 ||
      Number(r.otros_descuentos ?? 0) !== 0 ||
      Number(r.dias_descuento ?? 0) !== 0
    )
    .sort((a, b) => String(a.pais ?? "").localeCompare(String(b.pais ?? ""), "es") || a.nombre.localeCompare(b.nombre, "es"));
  const novedadesTotales = novedadesRows.reduce((acc, r) => {
    const key = r.moneda || "?";
    if (!acc[key]) acc[key] = { personas: 0, horasExtra: 0, otrosIngresos: 0, asegurado: 0, descuentoBoutique: 0, otrosDescuentos: 0, diasDescuento: 0, efectoNeto: 0 };
    acc[key].personas++;
    acc[key].horasExtra += Number(r.horas_extra ?? 0);
    acc[key].otrosIngresos += Number(r.otros_ingresos ?? 0);
    acc[key].asegurado += Number(r.asegurado_proporcional ?? 0);
    acc[key].descuentoBoutique += Number(r.descuento_boutique ?? 0);
    acc[key].otrosDescuentos += Number(r.otros_descuentos ?? 0);
    acc[key].diasDescuento += Number(r.dias_descuento ?? 0);
    acc[key].efectoNeto += Number(r.otros_ingresos ?? 0) + Number(r.asegurado_proporcional ?? 0) - Number(r.descuento_boutique ?? 0) - Number(r.otros_descuentos ?? 0);
    return acc;
  }, {} as Record<string, { personas: number; horasExtra: number; otrosIngresos: number; asegurado: number; descuentoBoutique: number; otrosDescuentos: number; diasDescuento: number; efectoNeto: number }>);
  const totalIssues = unmatchedCommissions.length + mismatchMoneda.length + argSinArs.length + negativoNeto.length + cerosDias.length + fueraDePeriodo.length + failedPaymentChecks.length + walletDataIssues.length + bankDataIssues.length;
  const totalesPais = calcRows.reduce((acc, r) => {
    const key = `${r.pais ?? "?"} (${r.moneda})`;
    if (!acc[key]) acc[key] = { usd: 0, local: 0, count: 0 };
    acc[key].usd += r.sueldo_neto_usd;
    acc[key].local += r.sueldo_neto_local;
    acc[key].count++;
    return acc;
  }, {} as Record<string, { usd: number; local: number; count: number }>);
  const totalesMoneda = calcRows.reduce((acc, r) => {
    const key = r.moneda || "?";
    if (!acc[key]) acc[key] = { count: 0, sueldoBase: 0, netoLocal: 0, netoUsd: 0, comCX: 0, comB2B: 0, asegurado: 0 };
    acc[key].count++;
    acc[key].sueldoBase += r.sueldo_base_ajustado;
    acc[key].netoLocal += r.sueldo_neto_local;
    acc[key].netoUsd += r.sueldo_neto_usd;
    acc[key].comCX += r.comision_cx;
    acc[key].comB2B += r.comision_b2b;
    acc[key].asegurado += r.asegurado_proporcional;
    return acc;
  }, {} as Record<string, { count: number; sueldoBase: number; netoLocal: number; netoUsd: number; comCX: number; comB2B: number; asegurado: number }>);
  const verificationReviewRows = calcRows.filter(r => {
    const area = String(r.area ?? "").toLowerCase();
    const hasSalaryVariation = Math.abs(Number(r.variacion_salario_base ?? 0)) > 0;
    return r.revisar
      || (area.includes("b2b") && hasSalaryVariation)
      || (!area.includes("b2b") && hasSalaryVariation)
      || r.sueldo_neto_usd < 0
      || r.dias_neto <= 0
      || r.pct_mes < 0.999;
  });
  const previousMonthComparisonRows = calcRows
    .map(r => {
      const previous = previousReferenceByDni.get(r.dni.trim());
      if (!previous) return null;
      const currentComisiones = r.comision_cx + r.comision_b2b;
      const currentWalletUsd = r.es_argentina ? r.pago_wallet_usd : 0;
      const currentWalletLocal = r.es_argentina ? r.pago_wallet_ars : r.pago_wallet_local;
      const currentBanco = r.es_argentina ? r.pago_banco_ars : r.pago_banco_local;
      const previousWalletUsd = r.es_argentina ? Number(previous.pago_wallet_usd ?? 0) : 0;
      const previousWalletLocal = r.es_argentina ? Number(previous.pago_wallet_ars ?? 0) : Number(previous.pago_wallet ?? 0);
      const previousBanco = r.es_argentina
        ? Number(previous.pago_banco_ars ?? 0)
        : Number(previous.pago_banco ?? 0);
      const currentNovedades = r.otros_ingresos + r.asegurado_proporcional - r.descuento_boutique - r.otros_descuentos;
      const previousNovedades = Number(previous.otros_ingresos ?? 0) - Number(previous.descuento_boutique ?? 0) - Number(previous.otros_descuentos ?? 0);
      return {
        row: r,
        previous,
        sueldoBaseDiff: r.sueldo_base - Number(previous.sueldo_base ?? 0),
        netoDiff: r.sueldo_neto_local - Number(previous.sueldo_neto_local ?? 0),
        comisionCxDiff: r.comision_cx - Number(previous.comision_cx ?? 0),
        comisionB2BDiff: r.comision_b2b - Number(previous.comision_b2b ?? 0),
        comisionesDiff: currentComisiones - Number(previous.comisiones ?? 0),
        walletUsdDiff: currentWalletUsd - previousWalletUsd,
        walletLocalDiff: currentWalletLocal - previousWalletLocal,
        bancoDiff: currentBanco - previousBanco,
        novedadesDiff: currentNovedades - previousNovedades,
        currentComisiones,
        currentWalletUsd,
        currentWalletLocal,
        currentBanco,
        currentNovedades,
        previousWalletUsd,
        previousWalletLocal,
        previousBanco,
        previousNovedades,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => String(a.row.pais ?? "").localeCompare(String(b.row.pais ?? ""), "es") || a.row.nombre.localeCompare(b.row.nombre, "es"));
  const previousMonthTotals = (() => {
    type Total = { personas: number; neto: number; comisiones: number; comCX: number; comB2B: number; walletUsd: number; walletLocal: number; banco: number; novedades: number };
    const current: Record<string, Total> = {};
    const previous: Record<string, Total> = {};
    const empty = (): Total => ({ personas: 0, neto: 0, comisiones: 0, comCX: 0, comB2B: 0, walletUsd: 0, walletLocal: 0, banco: 0, novedades: 0 });
    for (const r of calcRows) {
      const key = r.moneda || "?";
      if (!current[key]) current[key] = empty();
      current[key].personas++;
      current[key].neto += r.sueldo_neto_local;
      current[key].comCX += r.comision_cx;
      current[key].comB2B += r.comision_b2b;
      current[key].comisiones += r.comision_cx + r.comision_b2b;
      current[key].walletUsd += r.es_argentina ? r.pago_wallet_usd : 0;
      current[key].walletLocal += r.es_argentina ? r.pago_wallet_ars : r.pago_wallet_local;
      current[key].banco += r.es_argentina ? r.pago_banco_ars : r.pago_banco_local;
      current[key].novedades += r.otros_ingresos + r.asegurado_proporcional - r.descuento_boutique - r.otros_descuentos;
    }
    for (const r of previousReference) {
      const key = r.moneda || "?";
      if (!previous[key]) previous[key] = empty();
      previous[key].personas++;
      previous[key].neto += Number(r.sueldo_neto_local ?? 0);
      previous[key].comCX += Number(r.comision_cx ?? 0);
      previous[key].comB2B += Number(r.comision_b2b ?? 0);
      previous[key].comisiones += Number(r.comisiones ?? 0);
      previous[key].walletUsd += Number(r.pago_wallet_usd ?? 0);
      previous[key].walletLocal += Number(r.pago_wallet_ars ?? 0) || Number(r.pago_wallet ?? 0);
      previous[key].banco += Number(r.pago_banco_ars ?? 0) || Number(r.pago_banco ?? 0);
      previous[key].novedades += Number(r.otros_ingresos ?? 0) - Number(r.descuento_boutique ?? 0) - Number(r.otros_descuentos ?? 0);
    }
    return Array.from(new Set([...Object.keys(current), ...Object.keys(previous)]))
      .sort((a, b) => a.localeCompare(b))
      .map(moneda => ({ moneda, current: current[moneda] ?? empty(), previous: previous[moneda] ?? empty() }));
  })();
  const previousComparisonDashboard = (() => {
    const pct = (current: number, previous: number) => previous === 0 ? null : ((current / previous) - 1) * 100;
    const usdRate = (moneda: string) => editParams.find(p => p.moneda === moneda)?.tdc_usd ?? 1;
    const toUsd = (amount: number, moneda: string) => {
      const rate = usdRate(moneda);
      return rate > 0 ? amount / rate : 0;
    };
    type LocalRow = { key: string; pais: string; moneda: string; current: number; previous: number; variation: number | null; comment: string };
    type CountryRow = { key: string; pais: string; current: number; previous: number; variation: number | null; comment: string };
    type CommissionRow = { area: string; current: number; previous: number; variation: number | null };

    const localMap = () => new Map<string, LocalRow>();
    const ensureLocal = (map: Map<string, LocalRow>, pais: string, moneda: string) => {
      const key = `${pais || "Sin país"}|${moneda || "?"}`;
      if (!map.has(key)) map.set(key, { key, pais: pais || "Sin país", moneda: moneda || "?", current: 0, previous: 0, variation: null, comment: "" });
      return map.get(key)!;
    };
    const countryMap = () => new Map<string, CountryRow>();
    const ensureCountry = (map: Map<string, CountryRow>, pais: string) => {
      const key = pais || "Sin país";
      if (!map.has(key)) map.set(key, { key, pais: key, current: 0, previous: 0, variation: null, comment: "" });
      return map.get(key)!;
    };

    const base = localMap();
    calcRows.forEach(r => { ensureLocal(base, r.pais ?? "", r.moneda).current += r.sueldo_base_ajustado; });
    previousReference.forEach(r => { ensureLocal(base, r.pais ?? "", r.moneda ?? "?").previous += Number(r.sueldo_base ?? 0); });

    const netLocal = localMap();
    calcRows.forEach(r => {
      if (r.es_argentina) {
        ensureLocal(netLocal, "Argentina", "USD").current += r.pago_usd;
        ensureLocal(netLocal, "Argentina", "ARS").current += r.pago_ars_local;
      } else {
        ensureLocal(netLocal, r.pais ?? "", r.moneda).current += r.sueldo_neto_local;
      }
    });
    previousReference.forEach(r => {
      if ((r.pais ?? "") === "Argentina") {
        ensureLocal(netLocal, "Argentina", "USD").previous += Number(r.pago_wallet_usd ?? 0);
        ensureLocal(netLocal, "Argentina", "ARS").previous += Number(r.pago_wallet_ars ?? 0) + Number(r.pago_banco_ars ?? 0);
      } else {
        ensureLocal(netLocal, r.pais ?? "", r.moneda ?? "?").previous += Number(r.sueldo_neto_local ?? 0);
      }
    });

    const netUsd = countryMap();
    calcRows.forEach(r => { ensureCountry(netUsd, r.pais ?? "").current += r.sueldo_neto_usd; });
    previousReference.forEach(r => { ensureCountry(netUsd, r.pais ?? "").previous += Number(r.sueldo_neto_usd ?? 0); });

    const headcount = countryMap();
    calcRows.forEach(r => { ensureCountry(headcount, r.pais ?? "").current += 1; });
    previousReference.forEach(r => { ensureCountry(headcount, r.pais ?? "").previous += 1; });

    const avgUsd = countryMap();
    Array.from(new Set([...Array.from(netUsd.keys()), ...Array.from(headcount.keys())])).forEach(key => {
      const net = netUsd.get(key);
      const hc = headcount.get(key);
      const row = ensureCountry(avgUsd, key);
      row.current = hc?.current ? (net?.current ?? 0) / hc.current : 0;
      row.previous = hc?.previous ? (net?.previous ?? 0) / hc.previous : 0;
    });

    const commissions: CommissionRow[] = [
      {
        area: "CX",
        current: calcRows.reduce((sum, r) => sum + toUsd(r.comision_cx, r.moneda), 0),
        previous: previousReference.reduce((sum, r) => sum + toUsd(Number(r.comision_cx ?? 0), r.moneda ?? "USD"), 0),
        variation: null,
      },
      {
        area: "B2B",
        current: calcRows.reduce((sum, r) => sum + toUsd(r.comision_b2b, r.moneda), 0),
        previous: previousReference.reduce((sum, r) => sum + toUsd(Number(r.comision_b2b ?? 0), r.moneda ?? "USD"), 0),
        variation: null,
      },
    ];
    commissions.forEach(r => { r.variation = pct(r.current, r.previous); });
    commissions.push({
      area: "Total",
      current: commissions.reduce((sum, r) => sum + r.current, 0),
      previous: commissions.reduce((sum, r) => sum + r.previous, 0),
      variation: pct(commissions.reduce((sum, r) => sum + r.current, 0), commissions.reduce((sum, r) => sum + r.previous, 0)),
    });

    const finalizeLocal = (map: Map<string, LocalRow>) => Array.from(map.values())
      .map(r => ({ ...r, variation: pct(r.current, r.previous) }))
      .sort((a, b) => a.pais.localeCompare(b.pais, "es") || a.moneda.localeCompare(b.moneda, "es"));
    const finalizeCountry = (map: Map<string, CountryRow>) => {
      const rows = Array.from(map.values())
        .map(r => ({ ...r, variation: pct(r.current, r.previous) }))
        .sort((a, b) => a.pais.localeCompare(b.pais, "es"));
      const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
      const totalPrevious = rows.reduce((sum, r) => sum + r.previous, 0);
      rows.push({ key: "Total", pais: "Total", current: totalCurrent, previous: totalPrevious, variation: pct(totalCurrent, totalPrevious), comment: "" });
      return rows;
    };

    const baseRows = finalizeLocal(base);
    const netLocalRows = finalizeLocal(netLocal);
    const netUsdRows = finalizeCountry(netUsd);
    const headcountRows = finalizeCountry(headcount);
    const avgUsdRows = Array.from(avgUsd.values())
      .map(r => ({ ...r, variation: pct(r.current, r.previous) }))
      .sort((a, b) => a.pais.localeCompare(b.pais, "es"));
    const totalAvgCurrent = headcountRows.find(r => r.pais === "Total")?.current
      ? (netUsdRows.find(r => r.pais === "Total")?.current ?? 0) / (headcountRows.find(r => r.pais === "Total")?.current ?? 1)
      : 0;
    const totalAvgPrevious = headcountRows.find(r => r.pais === "Total")?.previous
      ? (netUsdRows.find(r => r.pais === "Total")?.previous ?? 0) / (headcountRows.find(r => r.pais === "Total")?.previous ?? 1)
      : 0;
    avgUsdRows.push({ key: "Total", pais: "Total", current: totalAvgCurrent, previous: totalAvgPrevious, variation: pct(totalAvgCurrent, totalAvgPrevious), comment: "" });

    const paymentRows = paymentChecks.map(c => ({
      grupo: c.grupo,
      moneda: c.moneda,
      base: c.base,
      wallet: c.wallet,
      banco: c.banco,
      totalPago: c.totalPago,
      diff: c.diff,
      ok: c.ok,
    }));

    return { baseRows, netLocalRows, netUsdRows, headcountRows, avgUsdRows, commissions, paymentRows };
  })();
  const finalChecks = [
    {
      label: "Pagos Wallet/Banco",
      detail: failedPaymentChecks.length === 0
        ? "Los pagos calzan contra el neto total."
        : `${failedPaymentChecks.length} grupo(s) no calzan contra el neto.`,
      count: failedPaymentChecks.length,
      status: failedPaymentChecks.length === 0 ? "OK" : "Revisar",
      severity: failedPaymentChecks.length === 0 ? "ok" : "error",
    },
    {
      label: "Datos Wallet",
      detail: walletDataIssues.length === 0
        ? "Quienes reciben por Wallet tienen correo y usuario."
        : `${walletDataIssues.length} persona(s) con pago Wallet sin correo o usuario.`,
      count: walletDataIssues.length,
      status: walletDataIssues.length === 0 ? "OK" : "Revisar",
      severity: walletDataIssues.length === 0 ? "ok" : "error",
    },
    {
      label: "Datos Banco",
      detail: bankDataIssues.length === 0
        ? "Quienes reciben por Banco tienen banco y número de cuenta."
        : `${bankDataIssues.length} persona(s) con pago Banco sin datos completos.`,
      count: bankDataIssues.length,
      status: bankDataIssues.length === 0 ? "OK" : "Revisar",
      severity: bankDataIssues.length === 0 ? "ok" : "error",
    },
    {
      label: "Comisiones",
      detail: unmatchedCommissions.length === 0 && mismatchMoneda.length === 0
        ? "Todas las comisiones tienen empleado y moneda correcta."
        : `${unmatchedCommissions.length} sin empleado · ${mismatchMoneda.length} con moneda distinta.`,
      count: unmatchedCommissions.length + mismatchMoneda.length,
      status: unmatchedCommissions.length === 0 && mismatchMoneda.length === 0 ? "OK" : "Revisar",
      severity: unmatchedCommissions.length === 0 && mismatchMoneda.length === 0 ? "ok" : "error",
    },
    {
      label: "Contratos terminados",
      detail: fueraDePeriodo.length === 0
        ? "No hay personas terminadas antes del mes en esta nómina."
        : `${fueraDePeriodo.length} persona(s) terminaron antes del período.`,
      count: fueraDePeriodo.length,
      status: fueraDePeriodo.length === 0 ? "OK" : "Revisar",
      severity: fueraDePeriodo.length === 0 ? "ok" : "error",
    },
    {
      label: "Neto y días",
      detail: negativoNeto.length === 0 && cerosDias.length === 0
        ? "No hay netos negativos ni días neto en cero sin término."
        : `${negativoNeto.length} neto negativo · ${cerosDias.length} días cero.`,
      count: negativoNeto.length + cerosDias.length,
      status: negativoNeto.length === 0 && cerosDias.length === 0 ? "OK" : "Revisar",
      severity: negativoNeto.length === 0 && cerosDias.length === 0 ? "ok" : "error",
    },
    {
      label: "Argentina ARS",
      detail: argSinArs.length === 0
        ? "Los argentinos tienen monto ARS definido."
        : `${argSinArs.length} argentino(s) sin monto ARS.`,
      count: argSinArs.length,
      status: argSinArs.length === 0 ? "OK" : "Revisar",
      severity: argSinArs.length === 0 ? "ok" : "warn",
    },
    {
      label: "Novedades manuales",
      detail: novedadesRows.length === 0
        ? "No hay ingresos extra, asegurados ni descuentos manuales."
        : `${novedadesRows.length} persona(s) con novedades para validar.`,
      count: novedadesRows.length,
      status: novedadesRows.length === 0 ? "OK" : "Validar",
      severity: novedadesRows.length === 0 ? "ok" : "warn",
    },
    {
      label: "Mes parcial",
      detail: parciales.length === 0
        ? "No hay sueldos proporcionales en el mes."
        : `${parciales.length} persona(s) con cálculo proporcional.`,
      count: parciales.length,
      status: parciales.length === 0 ? "OK" : "Validar",
      severity: parciales.length === 0 ? "ok" : "info",
    },
    {
      label: "Subidas de sueldo",
      detail: salaryHistory.length === 0
        ? "No hay subidas registradas para este período."
        : `${salaryHistory.length} cambio(s) guardados en el histórico.`,
      count: salaryHistory.length,
      status: salaryHistory.length === 0 ? "OK" : "Validar",
      severity: salaryHistory.length === 0 ? "ok" : "info",
    },
  ] as const;
  const finalCheckDetails: Record<string, string[]> = {
    "Pagos Wallet/Banco": failedPaymentChecks.map(c =>
      `${c.grupo} ${c.moneda}: base ${fmt(c.base)}, Wallet ${fmt(c.wallet)}, Banco ${fmt(c.banco)}, diferencia ${fmt(c.diff, 2)}`
    ),
    "Datos Wallet": walletDataIssues.map(r =>
      `${r.nombre} (${r.pais}) - ${r.moneda}: pago Wallet ${
        r.es_argentina ? `USD ${fmt(r.pago_wallet_usd, 2)} / ARS ${fmt(r.pago_wallet_ars)}` : fmt(r.pago_wallet_local)
      } sin ${!String(r.correo_wallet ?? "").trim() && !String(r.usuario_wallet ?? "").trim() ? "correo y usuario" : !String(r.correo_wallet ?? "").trim() ? "correo" : "usuario"}`
    ),
    "Datos Banco": bankDataIssues.map(r =>
      `${r.nombre} (${r.pais}) - ${r.moneda}: pago Banco ${
        r.es_argentina ? `ARS ${fmt(r.pago_banco_ars)}` : fmt(r.pago_banco_local)
      } sin ${!String(r.banco ?? "").trim() && !String(r.numero_cuenta ?? "").trim() ? "banco y número de cuenta" : !String(r.banco ?? "").trim() ? "banco" : "número de cuenta"}`
    ),
    "Comisiones": [
      ...unmatchedCommissions.map(c =>
        `Sin empleado: ${c.tipo} - DNI ${c.dni} - ${c.nombre} - ${c.moneda.trim()} ${fmt(c.monto_bruto)}`
      ),
      ...mismatchMoneda.map(c => {
        const emp = employees.find(e => e.dni.trim() === c.dni.trim());
        return `Moneda distinta: ${c.tipo} - DNI ${c.dni} - ${c.nombre} - nómina ${emp?.moneda ?? "?"} / comisión ${c.moneda.trim()} - ${fmt(c.monto_bruto)}`;
      }),
    ],
    "Contratos terminados": fueraDePeriodo.map(r =>
      `${r.nombre} (${r.pais}) - terminó ${r.fecha_termino}, antes de ${selected?.fecha_inicio ?? "inicio del período"}`
    ),
    "Neto y días": [
      ...negativoNeto.map(r => `${r.nombre} (${r.pais}) - neto negativo ${fmt(r.sueldo_neto_local)} ${r.moneda}`),
      ...cerosDias.map(r => `${r.nombre} (${r.pais}) - días neto ${fmt(r.dias_neto, 2)} sin fecha de término`),
    ],
    "Argentina ARS": argSinArs.map(r =>
      `${r.nombre} - monto ARS/USD en 0`
    ),
    "Novedades manuales": novedadesRows.map(r => {
      const parts = [
        Number(r.horas_extra ?? 0) !== 0 ? `horas extra ${fmt(Number(r.horas_extra), 2)}` : "",
        Number(r.dias_descuento ?? 0) !== 0 ? `días desc. ${fmt(Number(r.dias_descuento), 2)}` : "",
        Number(r.otros_ingresos ?? 0) !== 0 ? `otros ingresos ${fmt(Number(r.otros_ingresos))}` : "",
        Number(r.asegurado_proporcional ?? 0) !== 0 ? `asegurado ${fmt(Number(r.asegurado_proporcional))}` : "",
        Number(r.descuento_boutique ?? 0) !== 0 ? `desc. boutique ${fmt(Number(r.descuento_boutique))}` : "",
        Number(r.otros_descuentos ?? 0) !== 0 ? `otros desc. ${fmt(Number(r.otros_descuentos))}` : "",
      ].filter(Boolean).join(" · ");
      return `${r.nombre} (${r.pais}) - ${parts}`;
    }),
    "Mes parcial": parciales.map(r =>
      `${r.nombre} (${r.pais}) - ${r.dias_base}/${r.dias_mes} días (${(r.pct_mes * 100).toFixed(1)}%)`
    ),
    "Subidas de sueldo": salaryHistory.map(r =>
      `${r.nombre} (${r.pais ?? "?"}) - ${r.moneda} ${fmt(r.old_base)} -> ${fmt(r.new_base)} (${fmt(r.diff_pct, 2)}%)`
    ),
  };
  // ───────────────────────────────────────────────────────────────────────

  const tabs = [
    { key: "params" as const, label: "Parámetros" },
    { key: "comisiones" as const, label: `Comisiones${commissions.length > 0 ? ` (${commissions.length})` : ""}` },
    { key: "nomina_sin_arg" as const, label: `Nómina Sin ARG${sinArgRows.length > 0 ? ` (${sinArgRows.length})` : ""}` },
    { key: "argentina" as const, label: `Argentina${argEmployees.length > 0 ? ` (${argEmployees.length})` : ""}` },
    { key: "subidas_sueldo" as const, label: "Subidas de sueldo" },
    { key: "verificacion" as const, label: employees.length > 0 ? `Verificación${totalIssues > 0 ? ` ⚠ ${totalIssues}` : " ✓"}` : "Verificación" },
    { key: "checkeo_boleta" as const, label: "Check boletas" },
  ];
  const editablePayrollHeaders = new Set([
    "Días descuento", "Horas extra", "Otros ingresos", "Desc. Boutique", "Otros descuentos",
    "Monto ARS (USD)", "Pref. pago", "Correo Wallet", "Usuario Wallet", "Fecha boleta",
  ]);
  const headerStyle = (h: string, leftHeaders: string[]) => ({
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
    background: "#fff",
    padding: "8px 8px",
    textAlign: leftHeaders.includes(h) ? "left" as const : "right" as const,
    fontWeight: 700,
    color: editablePayrollHeaders.has(h) ? "var(--g66-blue)" : "var(--g66-muted)",
    fontSize: 11,
    whiteSpace: "nowrap" as const,
    borderBottom: `1px solid ${editablePayrollHeaders.has(h) ? "var(--g66-blue-mid)" : "var(--g66-border)"}`,
    boxShadow: "0 2px 4px rgba(17,24,39,0.05)",
  });
  const editableCellStyle: React.CSSProperties = {
    padding: "4px 6px",
  };
  const editableInputStyle = (width: number): React.CSSProperties => ({
    width,
    textAlign: "right",
    border: "1px solid var(--g66-border)",
    borderRadius: 5,
    padding: "3px 5px",
    fontSize: 12,
    background: "#fff",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--g66-bg)" }}>
      <header style={{ background: "var(--g66-blue)", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(59,62,219,0.25)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="/"><img src="/logo.jpg" alt="Global66" style={{ height: 36, borderRadius: 6, cursor: "pointer", display: "block" }} /></a>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.3)" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>People</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>← Empleados</a>
            <div style={{ background: "#fff", color: "var(--g66-blue)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13 }}>Nóminas</div>
          </div>
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: "none", margin: "0", padding: "14px 18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, minHeight: 34 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: "var(--g66-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Período</span>
          {loading ? (
            <span style={{ color: "var(--g66-muted)", fontSize: 13 }}>Cargando...</span>
          ) : periods.length === 0 ? (
            <span style={{ color: "var(--g66-muted)", fontSize: 13 }}>No hay períodos</span>
          ) : (
            <>
              <select
                value={selected?.id ?? ""}
                onChange={e => {
                  const period = periods.find(p => p.id === e.target.value);
                  if (period) selectPeriod(period);
                }}
                style={{ border: "1px solid var(--g66-border)", borderRadius: 7, padding: "6px 10px", fontSize: 13, fontWeight: 700, color: "var(--g66-text)", background: "#fff", minWidth: 180 }}
              >
                {periods.map(p => <option key={p.id} value={p.id}>{formatMes(p.mes)} · {p.status === "cerrado" ? "Cerrado" : "Borrador"}</option>)}
              </select>
              {selected?.status === "borrador" && (
                <button
                  onClick={() => selected && deletePeriod(selected)}
                  title="Eliminar borrador"
                  style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 7, padding: "6px 9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Eliminar
                </button>
              )}
            </>
          )}
          <button onClick={openNewPeriod} style={{ marginLeft: "auto", background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Nuevo período</button>
        </div>

        {!selected ? (
          <div style={{ color: "var(--g66-muted)", fontSize: 14, padding: 20 }}>Seleccioná o crea un período.</div>
        ) : (
          <div style={{ width: "100%", minWidth: 0 }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--g66-text)" }}>Nómina {formatMes(selected.mes)}</h2>
                <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                  {selected.fecha_inicio} → {selected.fecha_fin}
                  {employees.length > 0 && ` · ${employees.length} empleados`}
                  {calcRows.length > 0 && ` · Total USD ${fmt(totalUSD)}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {employees.length === 0 ? (
                  <button onClick={generateBase} disabled={generating} style={{ background: generating ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: generating ? "default" : "pointer" }}>
                    {generating ? "Cargando..." : "Generar nómina"}
                  </button>
                ) : (
                  <button onClick={generateBase} disabled={generating} style={{ background: "none", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: generating ? "default" : "pointer", color: "var(--g66-muted)" }}>
                    {generating ? "Actualizando..." : "↺ Regenerar"}
                  </button>
                )}
              </div>
            </div>

            {/* Excluidos al generar */}
            {generateInfo && generateInfo.excluidos > 0 && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#c2410c", marginBottom: 6 }}>
                  {generateInfo.excluidos} persona{generateInfo.excluidos > 1 ? "s" : ""} excluida{generateInfo.excluidos > 1 ? "s" : ""} — contrato terminado antes del {selected.fecha_inicio}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                  {generateInfo.excluidos_detalle.map(e => (
                    <span key={e.dni} style={{ fontSize: 12, color: "#9a3412" }}>
                      {e.nombre} <span style={{ color: "#c2410c", fontWeight: 600 }}>({e.fecha_termino})</span>
                    </span>
                  ))}
                </div>
                <button onClick={() => setGenerateInfo(null)} style={{ marginTop: 6, background: "none", border: "none", fontSize: 11, color: "#c2410c", cursor: "pointer", padding: 0 }}>Cerrar</button>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--g66-border)" }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: "none", border: "none", borderBottom: activeTab === tab.key ? "2px solid var(--g66-blue)" : "2px solid transparent", padding: "8px 16px", fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? "var(--g66-blue)" : "var(--g66-muted)", fontSize: 14, cursor: "pointer", marginBottom: -1 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: Params */}
            {activeTab === "params" && (
              <div className="g66-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Tipos de cambio y retenciones</span>
                  <button onClick={saveParams} disabled={saving} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontWeight: 600, fontSize: 13, cursor: saving ? "default" : "pointer" }}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "var(--g66-bg)" }}>
                      {["MONEDA","TDC a USD","RETENCIÓN %"].map(h => <th key={h} style={{ padding: "7px 12px", textAlign: h === "MONEDA" ? "left" : "right", fontWeight: 600, color: "var(--g66-muted)", fontSize: 12 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {editParams.map((p, i) => (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--g66-border)" }}>
                        <td style={{ padding: "7px 12px", fontWeight: 700 }}>{p.moneda}</td>
                        <td style={{ padding: "7px 12px", textAlign: "right" }}>
                          <input type="text" inputMode="decimal" value={p.tdc_usd}
                            onChange={e => { const u = [...editParams]; u[i] = { ...u[i], tdc_usd: parseDecimalInput(e.target.value) }; setEditParams(u); }}
                            style={{ width: 110, textAlign: "right", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "5px 8px", fontSize: 14 }} />
                        </td>
                        <td style={{ padding: "7px 12px", textAlign: "right" }}>
                          <input type="text" inputMode="decimal" value={(p.retencion * 100).toFixed(2)}
                            onChange={e => { const u = [...editParams]; u[i] = { ...u[i], retencion: parseDecimalInput(e.target.value) / 100 }; setEditParams(u); }}
                            style={{ width: 90, textAlign: "right", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "5px 8px", fontSize: 14 }} />
                          <span style={{ marginLeft: 5, color: "var(--g66-muted)" }}>%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: Comisiones */}
            {activeTab === "comisiones" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 16 }}>
                {(["CX","B2B"] as const).map(tipo => {
                  const list = commissions.filter(c => c.tipo === tipo);
                  const draft = manualCommissions[tipo];
                  const totalsByCurrency = list.reduce<Record<string, number>>((acc, c) => {
                    const moneda = c.moneda.trim() || "Sin moneda";
                    acc[moneda] = (acc[moneda] ?? 0) + Number(c.monto_bruto ?? 0);
                    return acc;
                  }, {});
                  return (
                    <div key={tipo} className="g66-card" style={{ flex: 1, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>Comisiones {tipo}</div>
                          <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>{list.length > 0 ? `${list.length} personas` : "Sin datos"}</div>
                          {uploadStatus[tipo] && <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: uploadStatus[tipo]?.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{uploadStatus[tipo]}</div>}
                        </div>
                        <button onClick={() => (tipo === "CX" ? cxRef : b2bRef).current?.click()} style={{ background: "var(--g66-blue-light)", color: "var(--g66-blue)", border: "1px solid var(--g66-blue-mid)", borderRadius: 7, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Subir Excel</button>
                      </div>
                      <input type="file" accept=".xlsx,.xls" ref={tipo === "CX" ? cxRef : b2bRef} style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadCommission(tipo, f); e.target.value = ""; }} />
                      <div style={{ border: "1px solid var(--g66-border)", borderRadius: 8, padding: 10, marginBottom: 10, background: "#f9fafb" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-text)", marginBottom: 8 }}>Agregar manual</div>
                        <div style={{ position: "relative", marginBottom: 8 }}>
                          <input
                            className="g66-input"
                            value={commissionSearchQ[tipo]}
                            onChange={e => searchCommissionEmployees(tipo, e.target.value)}
                            placeholder="Buscar empleado por nombre o DNI"
                            style={{ fontSize: 12, padding: "7px 9px" }}
                          />
                          {commissionSearchResults[tipo].length > 0 && (
                            <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto" }}>
                              {commissionSearchResults[tipo].map(emp => (
                                <button
                                  key={String(emp.dni)}
                                  onClick={() => selectCommissionEmployee(tipo, emp)}
                                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--g66-border)", padding: "8px 10px", cursor: "pointer" }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-text)" }}>{String(emp.nombre ?? "")}</div>
                                  <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>{String(emp.dni ?? "")} · {String(emp.pais ?? "")} · {String(emp.moneda ?? "")}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 82px 74px", gap: 8, marginBottom: 8 }}>
                          <input
                            className="g66-input"
                            value={draft.nombre}
                            readOnly
                            placeholder="Empleado seleccionado"
                            style={{ fontSize: 12, padding: "7px 9px", background: "#fff" }}
                          />
                          <input
                            className="g66-input"
                            type="number"
                            step="any"
                            min={0}
                            value={draft.monto_bruto}
                            onChange={e => setManualCommissions(s => ({ ...s, [tipo]: { ...s[tipo], monto_bruto: e.target.value } }))}
                            placeholder="Monto"
                            style={{ fontSize: 12, padding: "7px 9px", textAlign: "right" }}
                          />
                          <select
                            className="g66-input"
                            value={draft.moneda}
                            onChange={e => setManualCommissions(s => ({ ...s, [tipo]: { ...s[tipo], moneda: e.target.value } }))}
                            style={{ fontSize: 12, padding: "7px 9px" }}
                          >
                            {["CLP","COP","PEN","USD","ARS","EUR"].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                          <input
                            className="g66-input"
                            value={draft.mes}
                            onChange={e => setManualCommissions(s => ({ ...s, [tipo]: { ...s[tipo], mes: e.target.value } }))}
                            placeholder={selected?.mes ? formatMes(selected.mes) : "Mes"}
                            style={{ fontSize: 12, padding: "7px 9px" }}
                          />
                          <button
                            onClick={() => addManualCommission(tipo)}
                            disabled={savingCommission[tipo] || !draft.dni || !draft.monto_bruto}
                            style={{ background: savingCommission[tipo] || !draft.dni || !draft.monto_bruto ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: savingCommission[tipo] || !draft.dni || !draft.monto_bruto ? "default" : "pointer" }}
                          >
                            {savingCommission[tipo] ? "Guardando..." : "Agregar"}
                          </button>
                        </div>
                      </div>
                      {uploadPreview[tipo] && (
                        <div style={{ background: uploadPreview[tipo]!.usedHeaders ? "#f0fdf4" : "#fffbeb", border: `1px solid ${uploadPreview[tipo]!.usedHeaders ? "#bbf7d0" : "#fde68a"}`, borderRadius: 7, padding: "8px 10px", marginBottom: 10, fontSize: 11 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4, color: uploadPreview[tipo]!.usedHeaders ? "#166534" : "#92400e" }}>
                            {uploadPreview[tipo]!.usedHeaders ? "✓ Columnas detectadas por encabezado" : "⚠ Columnas leídas por posición (sin encabezados reconocidos)"}
                          </div>
                          <div style={{ color: "var(--g66-muted)", marginBottom: 6 }}>Vista previa (primeros {uploadPreview[tipo]!.rows.length}):</div>
                          {uploadPreview[tipo]!.rows.map((r, i) => (
                            <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>
                              {String(r.dni)} · {String(r.nombre).slice(0, 25)} · {String(r.moneda)} {fmt(r.monto_bruto as number)}
                            </div>
                          ))}
                        </div>
                      )}
                      {list.length > 0 && (
                        <div style={{ maxHeight: 300, overflowY: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead><tr style={{ background: "var(--g66-bg)" }}>
                              {["Nombre","Monto","Mon.",""].map(h => <th key={h} style={{ padding: "5px 8px", textAlign: h === "Nombre" ? "left" : "right", color: "var(--g66-muted)", fontWeight: 600 }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {list.map(c => (
                                <tr key={c.id} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                  <td style={{ padding: "5px 8px" }}>{c.nombre}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(c.monto_bruto)}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--g66-muted)" }}>{c.moneda.trim()}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                    <button onClick={() => deleteCommission(c)} title="Eliminar comisión"
                                      style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 5, padding: "2px 6px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              {Object.entries(totalsByCurrency).map(([moneda, total]) => (
                                <tr key={moneda} style={{ borderTop: "2px solid var(--g66-border)", background: "#f8fafc" }}>
                                  <td style={{ padding: "7px 8px", fontWeight: 800 }}>Total</td>
                                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 900 }}>{fmt(total)}</td>
                                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--g66-muted)", fontWeight: 800 }}>{moneda}</td>
                                  <td />
                                </tr>
                              ))}
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
                <div className="g66-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Asegurado</div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                        Monto mensual garantizado. La nómina calcula automáticamente el proporcional por fecha de ingreso y término.
                      </div>
                    </div>
                  </div>
                  <div style={{ border: "1px solid var(--g66-border)", borderRadius: 8, padding: 10, marginBottom: 10, background: "#f9fafb" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-text)" }}>Sugeridos Hunter B2B primeros 90 días</div>
                        <div style={{ fontSize: 11, color: "var(--g66-muted)", marginTop: 2 }}>
                          Incluye Sin ARG y Argentina. Solo cargos Sales Specialist Hunter B2B. El proporcional se calcula sobre meses de 30 días.
                        </div>
                      </div>
                      <button
                        onClick={applyB2BAsegurados}
                        disabled={savingB2BAsegurado || suggestedB2BAseguradoRows.length === 0 || !suggestedB2BAseguradoRows.some(r => Number(aseguradoB2BDrafts[r.id]) > 0)}
                        style={{ background: savingB2BAsegurado || suggestedB2BAseguradoRows.length === 0 || !suggestedB2BAseguradoRows.some(r => Number(aseguradoB2BDrafts[r.id]) > 0) ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: savingB2BAsegurado ? "default" : "pointer", whiteSpace: "nowrap" }}
                      >
                        {savingB2BAsegurado ? "Aplicando..." : "Aplicar"}
                      </button>
                    </div>
                    {suggestedB2BAseguradoRows.length === 0 ? (
                      <div style={{ padding: 10, color: "var(--g66-muted)", fontSize: 12, background: "#fff", border: "1px dashed var(--g66-border)", borderRadius: 7, marginBottom: 12 }}>
                        No hay Hunter B2B dentro de sus primeros 90 días para esta nómina.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--g66-border)", borderRadius: 8, background: "#fff", marginBottom: 12 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "var(--g66-bg)" }}>
                              {["Nombre", "DNI", "País", "Cargo", "Ingreso", "Cubre hasta", "Días", "Mon.", "Monto asegurado"].map(h => (
                                <th key={h} style={{ position: "sticky", top: 0, background: "var(--g66-bg)", padding: "7px 9px", textAlign: h === "Monto asegurado" ? "right" : "left", color: "var(--g66-muted)", fontWeight: 700, borderBottom: "1px solid var(--g66-border)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {suggestedB2BAseguradoRows.map(r => (
                              <tr key={r.id} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                <td style={{ padding: "7px 9px", fontWeight: 700 }}>{r.nombre}</td>
                                <td style={{ padding: "7px 9px", fontFamily: "monospace", color: "var(--g66-muted)" }}>{r.dni}</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{r.pais}</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-text2)" }}>{r.cargo}</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{fmtDate(r.fecha_ingreso)}</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{fmtDate(r.asegurado_window?.fin ?? null)}</td>
                                <td style={{ padding: "7px 9px", fontWeight: 800, color: "var(--g66-blue)" }}>{r.asegurado_window?.dias ?? 0}</td>
                                <td style={{ padding: "7px 9px", fontWeight: 700 }}>{r.moneda}</td>
                                <td style={{ padding: "7px 9px", textAlign: "right" }}>
                                  <input
                                    type="number"
                                    step="any"
                                    min={0}
                                    value={aseguradoB2BDrafts[r.id] ?? ""}
                                    onChange={e => setAseguradoB2BDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    placeholder="0"
                                    style={editableInputStyle(110)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-text)", marginBottom: 8 }}>Agregar manual</div>
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <input
                        className="g66-input"
                        value={aseguradoSearchQ}
                        onChange={e => searchAseguradoEmployees(e.target.value)}
                        placeholder="Buscar empleado por nombre o DNI"
                        style={{ fontSize: 12, padding: "7px 9px" }}
                      />
                      {aseguradoSearchResults.length > 0 && (
                        <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto" }}>
                          {aseguradoSearchResults.map(emp => (
                            <button
                              key={String(emp.dni)}
                              onClick={() => selectAseguradoEmployee(emp)}
                              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--g66-border)", padding: "8px 10px", cursor: "pointer" }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g66-text)" }}>{String(emp.nombre ?? "")}</div>
                              <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>{String(emp.dni ?? "")} · {String(emp.pais ?? "")} · {String(emp.moneda ?? "")}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8 }}>
                      <input
                        className="g66-input"
                        value={aseguradoDraft.nombre}
                        readOnly
                        placeholder="Empleado seleccionado"
                        style={{ fontSize: 12, padding: "7px 9px", background: "#fff" }}
                      />
                      <input
                        className="g66-input"
                        type="number"
                        step="any"
                        min={0}
                        value={aseguradoDraft.monto}
                        onChange={e => setAseguradoDraft(d => ({ ...d, monto: e.target.value }))}
                        placeholder="Monto"
                        style={{ fontSize: 12, padding: "7px 9px", textAlign: "right" }}
                      />
                      <button
                        onClick={saveAsegurado}
                        disabled={savingAsegurado || !aseguradoDraft.id || !aseguradoDraft.monto}
                        style={{ background: savingAsegurado || !aseguradoDraft.id || !aseguradoDraft.monto ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: savingAsegurado || !aseguradoDraft.id || !aseguradoDraft.monto ? "default" : "pointer" }}
                      >
                        {savingAsegurado ? "Guardando..." : "Agregar"}
                      </button>
                    </div>
                  </div>
                  {aseguradoRows.length === 0 ? (
                    <div style={{ padding: 18, color: "var(--g66-muted)", fontSize: 13, background: "#f9fafb", borderRadius: 8 }}>
                      Sin asegurados cargados.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--g66-border)", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "var(--g66-bg)" }}>
                            {["Nombre", "DNI", "Cargo", "País", "Mon.", "Días base", "Asegurado mensual", "Asegurado prop.", ""].map(h => (
                              <th key={h} style={{ position: "sticky", top: 0, background: "var(--g66-bg)", padding: "7px 9px", textAlign: ["Días base","Asegurado mensual","Asegurado prop."].includes(h) ? "right" : "left", color: "var(--g66-muted)", fontWeight: 700, borderBottom: "1px solid var(--g66-border)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {aseguradoRows.map(r => (
                            <tr key={r.id} style={{ borderTop: "1px solid var(--g66-border)" }}>
                              <td style={{ padding: "7px 9px", fontWeight: 700 }}>{r.nombre}</td>
                              <td style={{ padding: "7px 9px", fontFamily: "monospace", color: "var(--g66-muted)" }}>{r.dni}</td>
                              <td style={{ padding: "7px 9px", color: "var(--g66-text2)" }}>{r.cargo}</td>
                              <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{r.pais}</td>
                              <td style={{ padding: "7px 9px", fontWeight: 700 }}>{r.moneda}</td>
                              <td style={{ padding: "7px 9px", textAlign: "right" }}>
                                {r.dias_base}/{r.dias_mes}
                              </td>
                              <td style={{ padding: "7px 9px", textAlign: "right" }}>
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  key={r.id + "_asegurado_section"}
                                  defaultValue={r.asegurado ?? 0}
                                  onChange={e => updateLocalField(r.id, "asegurado", parseFloat(e.target.value) || 0)}
                                  onBlur={e => saveField(r.id, "asegurado", parseFloat(e.target.value) || 0)}
                                  style={editableInputStyle(95)}
                                />
                              </td>
                              <td style={{ padding: "7px 9px", textAlign: "right", color: r.asegurado_proporcional > 0 ? "#15803d" : "var(--g66-muted)", fontWeight: r.asegurado_proporcional > 0 ? 800 : 500 }}>
                                {fmt(r.asegurado_proporcional)}
                              </td>
                              <td style={{ padding: "7px 9px", textAlign: "right" }}>
                                <button onClick={() => saveField(r.id, "asegurado", 0)} title="Eliminar asegurado"
                                  style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 5, padding: "2px 6px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Nómina Sin ARG */}
            {activeTab === "nomina_sin_arg" && (
              sinArgRows.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
                  <div style={{ color: "var(--g66-muted)", fontSize: 14 }}>Presioná "Generar nómina" primero.</div>
                  <button onClick={() => openAddEmp("sin_arg")} style={{ alignSelf: "flex-start", background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar persona</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <input
                        value={payrollSearch}
                        onChange={e => setPayrollSearch(e.target.value)}
                        placeholder="Buscar por nombre, DNI, cargo, país, wallet..."
                        style={{ width: "min(460px, 100%)", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }}
                      />
                      {payrollSearch && (
                        <button onClick={() => setPayrollSearch("")} style={{ background: "#fff", color: "var(--g66-muted)", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "7px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Limpiar</button>
                      )}
                      <span style={{ fontSize: 12, color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{filteredSinArgRows.length}/{sinArgRows.length}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => exportPayrollExcel("sin_arg")} style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Descargar Excel</button>
                      <button onClick={() => exportBankTemplate("sin_arg")} style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Banco</button>
                      <button onClick={() => exportWalletExcel("sin_arg")} style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Wallet</button>
                      <button onClick={() => openAddEmp("sin_arg")} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar persona</button>
                    </div>
                  </div>
                  <div style={{ overflow: "auto", width: "100%", maxHeight: "calc(100vh - 230px)", border: "1px solid var(--g66-border)", borderRadius: 8, background: "#fff" }}>
                  <table style={{ width: "100%", minWidth: 2240, borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--g66-bg)" }}>
                        {["DNI","Nombre","País","Mon.","F. ingreso","F. término","Sueldo base","Base ajustada","Días base","Días descuento","Horas extra","Otros ingresos","Aseg. prop.","Desc. Boutique","Otros descuentos","Días neto","S. prop.","Com. CX","Com. B2B","S. imponible","Retención","S. neto local","Var salario base","Var salario neto","Var comisiones","Check","Neto USD","Pref. pago","Correo Wallet","Usuario Wallet","Pago Wallet","Pago Banco","Fecha boleta",""].map(h => (
                          <th key={h} style={headerStyle(h, ["DNI","Nombre","País","Mon.","F. ingreso","F. término","Pref. pago","Correo Wallet","Usuario Wallet","Fecha boleta",""])}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSinArgRows.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--g66-border)", background: r.revisar ? "#fffde7" : "transparent" }}>
                          <td style={{ padding: "5px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap", fontFamily: "monospace" }}>{r.dni}</td>
                          <td style={{ padding: "5px 8px", minWidth: 220 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <button onClick={() => openEditEmp(r)} title="Editar datos"
                                style={{ flexShrink: 0, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: "#1d4ed8", lineHeight: 1 }}>✎</button>
                              <button onClick={() => saveField(r.id, 'revisar', !r.revisar)} title={r.revisar ? "Quitar revisión" : "Marcar para revisar"}
                                style={{ flexShrink: 0, background: r.revisar ? "#facc15" : "#fff", border: `1px solid ${r.revisar ? "#facc15" : "var(--g66-border)"}`, borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: r.revisar ? "#854d0e" : "var(--g66-muted)", lineHeight: 1, fontWeight: 700 }}>
                                {r.revisar ? "!" : "Rev"}
                              </button>
                              <CommentButton emp={r} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                                <div style={{ fontSize: 10, color: "var(--g66-muted)" }}>{r.cargo}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "5px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{r.pais}</td>
                          <td style={{ padding: "5px 8px" }}>
                            <span style={{ background: "var(--g66-bg)", borderRadius: 4, padding: "1px 5px", fontSize: 11, fontWeight: 700 }}>{r.moneda}</span>
                            {r.es_argentina && <span style={{ marginLeft: 3, background: "#dbeafe", color: "#1d4ed8", borderRadius: 3, padding: "1px 4px", fontSize: 10, fontWeight: 700 }}>ARG</span>}
                          </td>
                          <td style={{ padding: "5px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{fmtDate(r.fecha_ingreso)}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                            {r.fecha_termino ? (
                              <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 700 }}>{fmtDate(r.fecha_termino)}</span>
                            ) : <span style={{ color: "var(--g66-muted)" }}>—</span>}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_base)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: (r.variacion_salario_base ?? 0) !== 0 ? "var(--g66-blue)" : "var(--g66-muted)", fontWeight: (r.variacion_salario_base ?? 0) !== 0 ? 700 : 400 }}>{fmt(r.sueldo_base_ajustado)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {r.pct_mes < 0.99 ? (
                              <span>
                                <span style={{ fontWeight: 700 }}>{r.dias_base}</span>
                                <span style={{ color: "var(--g66-muted)" }}>/{r.dias_mes}</span>
                                <span style={{ marginLeft: 4, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>{(r.pct_mes * 100).toFixed(1)}%</span>
                              </span>
                            ) : r.dias_base}
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_dd'} defaultValue={r.dias_descuento}
                              onChange={e => updateLocalField(r.id, 'dias_descuento', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'dias_descuento', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(52)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_he'} defaultValue={r.horas_extra}
                              onChange={e => updateLocalField(r.id, 'horas_extra', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'horas_extra', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(52)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_oi'} defaultValue={r.otros_ingresos}
                              onChange={e => updateLocalField(r.id, 'otros_ingresos', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'otros_ingresos', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.asegurado_proporcional > 0 ? "#15803d" : "var(--g66-muted)", fontWeight: r.asegurado_proporcional > 0 ? 700 : 400 }}>{fmt(r.asegurado_proporcional)}</td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_db'} defaultValue={r.descuento_boutique}
                              onChange={e => updateLocalField(r.id, 'descuento_boutique', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'descuento_boutique', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_od'} defaultValue={r.otros_descuentos}
                              onChange={e => updateLocalField(r.id, 'otros_descuentos', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'otros_descuentos', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{r.dias_neto.toFixed(1)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_proporcional)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.comision_cx > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.comision_cx)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.comision_b2b > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.comision_b2b)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(r.sueldo_imponible)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>{fmt(r.retencion_amt)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_neto_local)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).base), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).base)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).neto), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).neto)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).comisiones), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).comisiones)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800 }}>{payrollComparisonForRow(r).check}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "var(--g66-blue)" }}>{fmt(r.sueldo_neto_usd)}</td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <select value={r.preferencia_pago ?? "Banco"}
                              onChange={e => {
                                updateLocalField(r.id, 'preferencia_pago', e.target.value);
                                saveField(r.id, 'preferencia_pago', e.target.value);
                              }}
                              style={{ border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }}>
                              <option value="Banco">Banco</option>
                              <option value="Wallet">Wallet</option>
                            </select>
                          </td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="email" key={r.id + '_cw'} defaultValue={r.correo_wallet ?? ""}
                              onChange={e => updateLocalField(r.id, 'correo_wallet', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'correo_wallet', e.target.value || null)}
                              style={{ width: 170, border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="text" key={r.id + '_uw'} defaultValue={r.usuario_wallet ?? ""}
                              onChange={e => updateLocalField(r.id, 'usuario_wallet', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'usuario_wallet', e.target.value || null)}
                              style={{ width: 130, border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.pago_wallet_local > 0 ? "#7c3aed" : "var(--g66-muted)" }}>{fmt(r.pago_wallet_local)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.pago_banco_local > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.pago_banco_local)}</td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="date" key={r.id + '_fb'} defaultValue={r.fecha_boleta ?? ""}
                              onChange={e => updateLocalField(r.id, 'fecha_boleta', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'fecha_boleta', e.target.value || null)}
                              style={{ border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ padding: "5px 6px" }}>
                            <button onClick={() => deleteEmployee(r)} title="Eliminar de nómina"
                              style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "3px 7px", fontSize: 12, cursor: "pointer", color: "#dc2626", lineHeight: 1 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--g66-bg)", fontWeight: 700 }}>
                        <td colSpan={26} style={{ padding: "7px 8px", textAlign: "right", fontSize: 13 }}>Total Sin ARG (USD):</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 14, color: "var(--g66-blue)" }}>{fmt(sinArgRows.reduce((s,r) => s + r.sueldo_neto_usd, 0))}</td>
                        <td colSpan={7} />
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )
            )}

            {/* TAB: Argentina */}
            {activeTab === "argentina" && (
              argEmployees.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
                  <div style={{ color: "var(--g66-muted)", fontSize: 14 }}>Generá la nómina primero.</div>
                  <button onClick={() => openAddEmp("argentina")} style={{ alignSelf: "flex-start", background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar persona</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <input
                        value={payrollSearch}
                        onChange={e => setPayrollSearch(e.target.value)}
                        placeholder="Buscar por nombre, DNI, cargo, wallet..."
                        style={{ width: "min(420px, 100%)", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }}
                      />
                      {payrollSearch && (
                        <button onClick={() => setPayrollSearch("")} style={{ background: "#fff", color: "var(--g66-muted)", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "7px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Limpiar</button>
                      )}
                      <span style={{ fontSize: 12, color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{filteredArgRows.length}/{argCalcRows.length}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => exportPayrollExcel("argentina")} style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Descargar Excel</button>
                      <button onClick={() => exportBankTemplate("argentina")} style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Banco</button>
                      <button onClick={() => exportWalletExcel("argentina")} style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Wallet</button>
                      <button onClick={() => openAddEmp("argentina")} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar persona</button>
                    </div>
                  </div>
                  <div style={{ overflow: "auto", width: "100%", maxHeight: "calc(100vh - 230px)", border: "1px solid var(--g66-border)", borderRadius: 8, background: "#fff" }}>
                  <table style={{ width: "100%", minWidth: 2760, borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--g66-bg)" }}>
                        {["DNI","Nombre","Mon.","F. ingreso","F. término","Sueldo base","Base ajustada","Días base","Días descuento","Horas extra","Otros ingresos","Aseg. prop.","Desc. Boutique","Otros descuentos","Días neto","S. prop.","Com. CX","Com. B2B","S. imponible","Retención","S. neto local","Var salario base","Var salario neto","Var comisiones","Check","Neto USD","Monto ARS (USD)","Monto ARS (local)","Pago USD","Pref. pago","Correo Wallet","Usuario Wallet","Pago Wallet USD","Pago Wallet ARS","Pago Banco ARS","Estado","Fecha boleta",""].map(h => (
                          <th key={h} style={headerStyle(h, ["DNI","Nombre","Mon.","F. ingreso","F. término","Pref. pago","Correo Wallet","Usuario Wallet","Fecha boleta",""])}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArgRows.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--g66-border)", background: r.revisar ? "#fffde7" : "transparent" }}>
                          <td style={{ padding: "5px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap", fontFamily: "monospace" }}>{r.dni}</td>
                          <td style={{ padding: "5px 8px", minWidth: 220 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <button onClick={() => openEditEmp(r)} title="Editar datos"
                                style={{ flexShrink: 0, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: "#1d4ed8", lineHeight: 1 }}>✎</button>
                              <button onClick={() => saveField(r.id, 'revisar', !r.revisar)} title={r.revisar ? "Quitar revisión" : "Marcar para revisar"}
                                style={{ flexShrink: 0, background: r.revisar ? "#facc15" : "#fff", border: `1px solid ${r.revisar ? "#facc15" : "var(--g66-border)"}`, borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: r.revisar ? "#854d0e" : "var(--g66-muted)", lineHeight: 1, fontWeight: 700 }}>
                                {r.revisar ? "!" : "Rev"}
                              </button>
                              <CommentButton emp={r} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                                <div style={{ fontSize: 10, color: "var(--g66-muted)" }}>{r.cargo}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "5px 8px" }}>
                            <span style={{ background: "var(--g66-bg)", borderRadius: 4, padding: "1px 5px", fontSize: 11, fontWeight: 700 }}>{r.moneda}</span>
                          </td>
                          <td style={{ padding: "5px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{fmtDate(r.fecha_ingreso)}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                            {r.fecha_termino ? (
                              <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 700 }}>{fmtDate(r.fecha_termino)}</span>
                            ) : <span style={{ color: "var(--g66-muted)" }}>—</span>}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_base)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: (r.variacion_salario_base ?? 0) !== 0 ? "var(--g66-blue)" : "var(--g66-muted)", fontWeight: (r.variacion_salario_base ?? 0) !== 0 ? 700 : 400 }}>{fmt(r.sueldo_base_ajustado)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {r.pct_mes < 0.99 ? (
                              <span>
                                <span style={{ fontWeight: 700 }}>{r.dias_base}</span>
                                <span style={{ color: "var(--g66-muted)" }}>/{r.dias_mes}</span>
                                <span style={{ marginLeft: 4, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>{(r.pct_mes * 100).toFixed(1)}%</span>
                              </span>
                            ) : r.dias_base}
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_dd'} defaultValue={r.dias_descuento}
                              onChange={e => updateLocalField(r.id, 'dias_descuento', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'dias_descuento', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(52)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_he'} defaultValue={r.horas_extra}
                              onChange={e => updateLocalField(r.id, 'horas_extra', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'horas_extra', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(52)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_oi'} defaultValue={r.otros_ingresos}
                              onChange={e => updateLocalField(r.id, 'otros_ingresos', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'otros_ingresos', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.asegurado_proporcional > 0 ? "#15803d" : "var(--g66-muted)", fontWeight: r.asegurado_proporcional > 0 ? 700 : 400 }}>{fmt(r.asegurado_proporcional)}</td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_db'} defaultValue={r.descuento_boutique}
                              onChange={e => updateLocalField(r.id, 'descuento_boutique', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'descuento_boutique', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_od'} defaultValue={r.otros_descuentos}
                              onChange={e => updateLocalField(r.id, 'otros_descuentos', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveField(r.id, 'otros_descuentos', parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(75)} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{r.dias_neto.toFixed(1)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_proporcional)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.comision_cx > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.comision_cx)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.comision_b2b > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.comision_b2b)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(r.sueldo_imponible)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>{fmt(r.retencion_amt)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_neto_local)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).base), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).base)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).neto), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).neto)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", color: variationColor(payrollComparisonForRow(r).comisiones), fontWeight: 800 }}>{formatPct(payrollComparisonForRow(r).comisiones)}</td>
                          <td title={payrollMovementDetailsForRow(r)} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800 }}>{payrollComparisonForRow(r).check}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "var(--g66-blue)" }}>{fmt(r.sueldo_neto_usd)}</td>
                          <td style={editableCellStyle}>
                            <input type="number" step="any" min={0} key={r.id + '_ars'} defaultValue={r.monto_ars_usd}
                              onChange={e => updateLocalField(r.id, 'monto_ars_usd', parseFloat(e.target.value) || 0)}
                              onBlur={e => saveArs(r, parseFloat(e.target.value) || 0)}
                              style={editableInputStyle(85)} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#854d0e" }}>{fmt(r.pago_ars_local)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--g66-blue)", fontWeight: 700 }}>{fmt(r.pago_usd)}</td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <select value={r.preferencia_pago ?? "Banco"}
                              onChange={e => {
                                updateLocalField(r.id, 'preferencia_pago', e.target.value);
                                saveField(r.id, 'preferencia_pago', e.target.value);
                              }}
                              style={{ border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }}>
                              <option value="Banco">Banco</option>
                              <option value="Wallet">Wallet</option>
                            </select>
                          </td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="email" key={r.id + '_cw'} defaultValue={r.correo_wallet ?? ""}
                              onChange={e => updateLocalField(r.id, 'correo_wallet', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'correo_wallet', e.target.value || null)}
                              style={{ width: 170, border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="text" key={r.id + '_uw'} defaultValue={r.usuario_wallet ?? ""}
                              onChange={e => updateLocalField(r.id, 'usuario_wallet', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'usuario_wallet', e.target.value || null)}
                              style={{ width: 130, border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.pago_wallet_usd > 0 ? "#7c3aed" : "var(--g66-muted)" }}>{fmt(r.pago_wallet_usd)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.pago_wallet_ars > 0 ? "#7c3aed" : "var(--g66-muted)" }}>{fmt(r.pago_wallet_ars)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.pago_banco_ars > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(r.pago_banco_ars)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>
                            {r.monto_ars_usd > 0
                              ? <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>✓ Config.</span>
                              : <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Sin ARS</span>}
                          </td>
                          <td style={{ ...editableCellStyle, textAlign: "left" }}>
                            <input type="date" key={r.id + '_fb'} defaultValue={r.fecha_boleta ?? ""}
                              onChange={e => updateLocalField(r.id, 'fecha_boleta', e.target.value || null)}
                              onBlur={e => saveField(r.id, 'fecha_boleta', e.target.value || null)}
                              style={{ border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 5px", fontSize: 11, background: "#fff" }} />
                          </td>
                          <td style={{ padding: "5px 6px" }}>
                            <button onClick={() => deleteEmployee(r)} title="Eliminar de nómina"
                              style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "3px 7px", fontSize: 12, cursor: "pointer", color: "#dc2626", lineHeight: 1 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--g66-bg)", fontWeight: 700 }}>
                        <td colSpan={25} style={{ padding: "7px 8px", textAlign: "right", fontSize: 13 }}>Total ARG (USD):</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 14, color: "var(--g66-blue)" }}>{fmt(argCalcRows.reduce((s,r) => s + r.sueldo_neto_usd, 0))}</td>
                        <td colSpan={12} />
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )
            )}

            {/* TAB: Subidas de sueldo */}
            {activeTab === "subidas_sueldo" && (
              employees.length === 0 ? (
                <div style={{ color: "var(--g66-muted)", fontSize: 14, padding: 20 }}>Generá la nómina primero.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16, alignItems: "start" }}>
                  <div className="g66-card" style={{ padding: 18 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Subida de sueldo</div>
                    <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 14 }}>
                      Busca una persona de esta nómina, escribe el nuevo sueldo base y aplica el cambio. Se guarda en Supabase para este período.
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>BUSCAR PERSONA</label>
                    <div style={{ position: "relative", marginBottom: 14 }}>
                      <input
                        className="g66-input"
                        value={salarySearch}
                        onChange={e => {
                          setSalarySearch(e.target.value);
                          setSelectedSalaryEmpId("");
                          setSalaryNewAmount("");
                        }}
                        placeholder="Nombre, DNI, cargo, país..."
                        style={{ fontSize: 13 }}
                      />
                      {salarySearchResults.length > 0 && !selectedSalaryEmpId && (
                        <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto" }}>
                          {salarySearchResults.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => {
                                setSelectedSalaryEmpId(emp.id);
                                setSalarySearch(emp.nombre);
                                setSalaryNewAmount(String(emp.sueldo_base ?? 0));
                              }}
                              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--g66-border)", padding: "9px 11px", cursor: "pointer" }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--g66-text)" }}>{emp.nombre}</div>
                              <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>
                                {emp.dni} · {emp.pais} · {emp.moneda} · sueldo {fmt(emp.sueldo_base)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedSalaryRow ? (
                      <>
                        <div style={{ border: "1px solid var(--g66-border)", borderRadius: 10, padding: 12, background: "#f9fafb", marginBottom: 14 }}>
                          <div style={{ fontWeight: 800, color: "var(--g66-text)", marginBottom: 3 }}>{selectedSalaryRow.nombre}</div>
                          <div style={{ fontSize: 12, color: "var(--g66-muted)" }}>
                            {selectedSalaryRow.dni} · {selectedSalaryRow.cargo} · {selectedSalaryRow.pais}
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>SUELDO ACTUAL</label>
                            <input className="g66-input" value={`${fmt(selectedSalaryRow.sueldo_base)} ${selectedSalaryRow.moneda}`} readOnly style={{ background: "#f9fafb", color: "var(--g66-muted)" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>NUEVO SUELDO</label>
                            <input
                              className="g66-input"
                              type="number"
                              step="any"
                              min={0}
                              value={salaryNewAmount}
                              onChange={e => setSalaryNewAmount(e.target.value)}
                              style={{ textAlign: "right", fontWeight: 700 }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                          <div style={{ background: salaryDiff >= 0 ? "#dcfce7" : "#fee2e2", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, color: salaryDiff >= 0 ? "#166534" : "#991b1b", fontWeight: 700 }}>DIFERENCIA</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: salaryDiff >= 0 ? "#166534" : "#991b1b" }}>
                              {salaryDiff >= 0 ? "+" : ""}{fmt(salaryDiff)} {selectedSalaryRow.moneda}
                            </div>
                          </div>
                          <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>VARIACIÓN</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#1d4ed8" }}>
                              {salaryPct >= 0 ? "+" : ""}{salaryPct.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>COMENTARIO</label>
                        <textarea
                          value={salaryChangeComment}
                          onChange={e => setSalaryChangeComment(e.target.value)}
                          rows={2}
                          placeholder="Opcional: motivo o detalle de la subida..."
                          style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
                        />

                        <button
                          onClick={applySalaryRaise}
                          disabled={savingSalaryRaise || !salaryNew || salaryNew === selectedSalaryRow.sueldo_base}
                          style={{ width: "100%", background: savingSalaryRaise || !salaryNew || salaryNew === selectedSalaryRow.sueldo_base ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: savingSalaryRaise ? "default" : "pointer" }}
                        >
                          {savingSalaryRaise ? "Aplicando..." : "Aplicar subida"}
                        </button>
                      </>
                    ) : (
                      <div style={{ padding: 18, color: "var(--g66-muted)", fontSize: 13, background: "#f9fafb", borderRadius: 8 }}>
                        Selecciona una persona para editar su sueldo base.
                      </div>
                    )}
                  </div>

                  <div className="g66-card" style={{ padding: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "Personas", value: salaryHistoryPeople, color: "var(--g66-blue)", bg: "var(--g66-blue-light)" },
                        { label: "Países", value: salaryHistoryCountries, color: "#7c3aed", bg: "#f5f3ff" },
                        { label: "% promedio", value: `${salaryHistoryAvgPct >= 0 ? "+" : ""}${salaryHistoryAvgPct.toFixed(2)}%`, color: salaryHistoryAvgPct >= 0 ? "#15803d" : "#dc2626", bg: salaryHistoryAvgPct >= 0 ? "#dcfce7" : "#fee2e2" },
                        { label: "Dif. total", value: fmt(salaryHistoryTotalDiff), color: salaryHistoryTotalDiff >= 0 ? "#15803d" : "#dc2626", bg: salaryHistoryTotalDiff >= 0 ? "#dcfce7" : "#fee2e2" },
                      ].map(card => (
                        <div key={card.label} style={{ background: card.bg, borderRadius: 10, padding: "11px 14px", minHeight: 70 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: card.color, textTransform: "uppercase", letterSpacing: 0.4 }}>{card.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>Histórico de subidas</div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                          Cambios guardados en Supabase para este período.
                        </div>
                      </div>
                      <button
                        onClick={exportSalaryHistoryExcel}
                        disabled={salaryHistory.length === 0}
                        style={{ background: salaryHistory.length === 0 ? "var(--g66-border)" : "#ecfdf5", color: salaryHistory.length === 0 ? "var(--g66-muted)" : "#047857", border: salaryHistory.length === 0 ? "1px solid var(--g66-border)" : "1px solid #a7f3d0", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: salaryHistory.length === 0 ? "default" : "pointer", whiteSpace: "nowrap" }}
                      >
                        Descargar Excel
                      </button>
                    </div>
                    {salaryHistoryError && (
                      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>
                        {salaryHistoryError}
                      </div>
                    )}
                    {salaryHistory.length === 0 ? (
                      <div style={{ padding: 18, color: "var(--g66-muted)", fontSize: 13, background: "#f9fafb", borderRadius: 8 }}>
                        Todavía no hay subidas guardadas en el histórico.
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "var(--g66-bg)" }}>
                            {["Fecha", "Nombre", "País", "Mon.", "Anterior", "Nuevo", "Dif.", "%", "Comentario", ""].map(h => (
                              <th key={h} style={{ padding: "7px 9px", textAlign: h === "Nombre" || h === "País" ? "left" : "right", color: "var(--g66-muted)", fontWeight: 700 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {salaryHistory.map(change => {
                            const diff = Number(change.diff_amount ?? 0);
                            const pct = Number(change.diff_pct ?? 0) * 100;
                            const draft = salaryHistoryDrafts[change.id] ?? { newBase: String(change.new_base), comment: change.comment ?? "" };
                            const draftNewBase = Number(draft.newBase) || 0;
                            const hasDraftChanges = draftNewBase !== Number(change.new_base) || draft.comment !== (change.comment ?? "");
                            return (
                              <tr key={change.id} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                <td style={{ padding: "7px 9px", textAlign: "right", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{new Date(change.created_at).toLocaleDateString("es-CL")}</td>
                                <td style={{ padding: "7px 9px", fontWeight: 700 }}>{change.nombre}</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>{change.pais}</td>
                                <td style={{ padding: "7px 9px", textAlign: "right", fontWeight: 700 }}>{change.moneda}</td>
                                <td style={{ padding: "7px 9px", textAlign: "right", color: "var(--g66-muted)" }}>{fmt(change.old_base)}</td>
                                <td style={{ padding: "7px 9px", textAlign: "right", fontWeight: 800 }}>
                                  <input
                                    type="number"
                                    step="any"
                                    min={0}
                                    value={draft.newBase}
                                    onChange={e => setSalaryHistoryDrafts(prev => ({ ...prev, [change.id]: { ...draft, newBase: e.target.value } }))}
                                    style={editableInputStyle(105)}
                                  />
                                </td>
                                <td style={{ padding: "7px 9px", textAlign: "right", color: diff >= 0 ? "#15803d" : "#dc2626", fontWeight: 800 }}>{diff >= 0 ? "+" : ""}{fmt(diff)}</td>
                                <td style={{ padding: "7px 9px", textAlign: "right", color: diff >= 0 ? "#15803d" : "#dc2626", fontWeight: 800 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</td>
                                <td style={{ padding: "7px 9px", color: "var(--g66-muted)" }}>
                                  <input
                                    type="text"
                                    value={draft.comment}
                                    onChange={e => setSalaryHistoryDrafts(prev => ({ ...prev, [change.id]: { ...draft, comment: e.target.value } }))}
                                    placeholder="Comentario"
                                    style={{ width: 180, border: "1px solid var(--g66-border)", borderRadius: 5, padding: "3px 6px", fontSize: 12 }}
                                  />
                                </td>
                                <td style={{ padding: "7px 9px", textAlign: "right", whiteSpace: "nowrap" }}>
                                  <button
                                    onClick={() => editSalaryHistory(change)}
                                    disabled={savingSalaryHistoryId === change.id || !hasDraftChanges}
                                    style={{ background: !hasDraftChanges ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: !hasDraftChanges ? "default" : "pointer", marginRight: 6 }}
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => deleteSalaryHistory(change)}
                                    disabled={savingSalaryHistoryId === change.id}
                                    style={{ background: "var(--g66-red-bg)", color: "var(--g66-red)", border: "1px solid var(--g66-red-border)", borderRadius: 5, padding: "3px 7px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            )}

            {/* TAB: Verificación */}
            {activeTab === "verificacion" && (
              employees.length === 0 ? (
                <div style={{ color: "var(--g66-muted)", fontSize: 14, padding: 20 }}>Generá la nómina primero.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Summary bar */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "Empleados", value: calcRows.length, color: "var(--g66-blue)", bg: "var(--g66-blue-light)" },
                      { label: "Com. sin match", value: unmatchedCommissions.length, color: unmatchedCommissions.length > 0 ? "#dc2626" : "#16a34a", bg: unmatchedCommissions.length > 0 ? "#fee2e2" : "#dcfce7" },
                      { label: "Moneda distinta", value: mismatchMoneda.length, color: mismatchMoneda.length > 0 ? "#d97706" : "#16a34a", bg: mismatchMoneda.length > 0 ? "#fef3c7" : "#dcfce7" },
                      { label: "ARG sin ARS", value: argSinArs.length, color: argSinArs.length > 0 ? "#d97706" : "#16a34a", bg: argSinArs.length > 0 ? "#fef3c7" : "#dcfce7" },
                      { label: "Neto negativo", value: negativoNeto.length, color: negativoNeto.length > 0 ? "#dc2626" : "#16a34a", bg: negativoNeto.length > 0 ? "#fee2e2" : "#dcfce7" },
                      { label: "Fuera de período", value: fueraDePeriodo.length, color: fueraDePeriodo.length > 0 ? "#dc2626" : "#16a34a", bg: fueraDePeriodo.length > 0 ? "#fee2e2" : "#dcfce7" },
                      { label: "Pagos no calzan", value: failedPaymentChecks.length, color: failedPaymentChecks.length > 0 ? "#dc2626" : "#16a34a", bg: failedPaymentChecks.length > 0 ? "#fee2e2" : "#dcfce7" },
                      { label: "Novedades", value: novedadesRows.length, color: novedadesRows.length > 0 ? "#7c3aed" : "var(--g66-muted)", bg: novedadesRows.length > 0 ? "#f5f3ff" : "var(--g66-bg)" },
                      { label: "Mes parcial", value: parciales.length, color: parciales.length > 0 ? "#7c3aed" : "var(--g66-muted)", bg: parciales.length > 0 ? "#f5f3ff" : "var(--g66-bg)" },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 16px", minWidth: 110, textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                    <div style={{ background: "var(--g66-blue-light)", borderRadius: 10, padding: "10px 16px", minWidth: 130, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--g66-blue)" }}>{fmt(totalUSD)}</div>
                      <div style={{ fontSize: 11, color: "var(--g66-blue)", fontWeight: 600 }}>Total USD neto</div>
                    </div>
                  </div>

                  <div className="g66-card" style={{ padding: 14, borderLeft: "4px solid #2563eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#1d4ed8" }}>Comparación mes pasado</div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                        {previousMonthComparisonRows.length > 0
                          ? `${previousMonthComparisonRows.length} personas cruzadas contra abril. La tabla está más abajo en esta misma pestaña.`
                          : "No se cargó la referencia de abril. Recargá la página o vuelve a seleccionar Mayo 2026."}
                      </div>
                    </div>
                    {previousMonthComparisonRows.length > 0 && (
                      <a href="#comparacion-mes-pasado" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap" }}>
                        Ver tabla
                      </a>
                    )}
                  </div>

                  {/* Novedades manuales */}
                  <div className="g66-card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>Ingresos extra y descuentos</div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 3 }}>
                          Muestra solo personas con horas extra, ingresos, asegurado o descuentos cargados manualmente.
                        </div>
                      </div>
                      <span style={{ background: novedadesRows.length > 0 ? "#f5f3ff" : "var(--g66-bg)", color: novedadesRows.length > 0 ? "#7c3aed" : "var(--g66-muted)", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800 }}>
                        {novedadesRows.length} persona(s)
                      </span>
                    </div>
                    {novedadesRows.length === 0 ? (
                      <div style={{ padding: 14, borderRadius: 8, background: "var(--g66-bg)", color: "var(--g66-muted)", fontSize: 13 }}>
                        No hay ingresos extra ni descuentos cargados.
                      </div>
                    ) : (
                      <>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 14 }}>
                          <thead><tr style={{ background: "var(--g66-bg)" }}>
                            {["Moneda","Personas","Horas extra","Días desc.","Otros ingresos","Asegurado prop.","Desc. Boutique","Otros descuentos","Efecto neto"].map(h => (
                              <th key={h} style={{ padding: "6px 10px", textAlign: h === "Moneda" ? "left" : "right", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {Object.entries(novedadesTotales).sort(([a], [b]) => a.localeCompare(b)).map(([moneda, v]) => (
                              <tr key={moneda} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                <td style={{ padding: "6px 10px", fontWeight: 800 }}>{moneda}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }}>{v.personas}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(v.horasExtra, 2)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(v.diasDescuento, 2)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: v.otrosIngresos > 0 ? "#15803d" : "var(--g66-muted)", fontWeight: 700 }}>{fmt(v.otrosIngresos)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: v.asegurado > 0 ? "#15803d" : "var(--g66-muted)", fontWeight: 700 }}>{fmt(v.asegurado)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: v.descuentoBoutique > 0 ? "#dc2626" : "var(--g66-muted)", fontWeight: 700 }}>{fmt(v.descuentoBoutique)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: v.otrosDescuentos > 0 ? "#dc2626" : "var(--g66-muted)", fontWeight: 700 }}>{fmt(v.otrosDescuentos)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: v.efectoNeto >= 0 ? "#15803d" : "#dc2626", fontWeight: 800 }}>{fmt(v.efectoNeto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--g66-border)", borderRadius: 8 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead><tr style={{ background: "var(--g66-bg)" }}>
                              {["Nombre","País","Mon.","Horas extra","Días desc.","Otros ingresos","Asegurado prop.","Desc. Boutique","Otros descuentos","Efecto neto","Comentario"].map(h => (
                                <th key={h} style={{ position: "sticky", top: 0, background: "var(--g66-bg)", padding: "6px 8px", textAlign: ["Horas extra","Días desc.","Otros ingresos","Asegurado prop.","Desc. Boutique","Otros descuentos","Efecto neto"].includes(h) ? "right" : "left", fontWeight: 600, color: "var(--g66-muted)", zIndex: 1 }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {novedadesRows.map(r => {
                                const efecto = Number(r.otros_ingresos ?? 0) + Number(r.asegurado_proporcional ?? 0) - Number(r.descuento_boutique ?? 0) - Number(r.otros_descuentos ?? 0);
                                return (
                                  <tr key={r.id} style={{ borderTop: "1px solid var(--g66-border)", background: r.revisar ? "#fffde7" : "#fff" }}>
                                    <td style={{ padding: "6px 8px", fontWeight: 700 }}>{r.nombre}</td>
                                    <td style={{ padding: "6px 8px", color: "var(--g66-muted)" }}>{r.pais}</td>
                                    <td style={{ padding: "6px 8px", fontWeight: 800 }}>{r.moneda}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(r.horas_extra ?? 0), 2)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(r.dias_descuento ?? 0), 2)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.otros_ingresos ?? 0) > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(Number(r.otros_ingresos ?? 0))}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.asegurado_proporcional ?? 0) > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(Number(r.asegurado_proporcional ?? 0))}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.descuento_boutique ?? 0) > 0 ? "#dc2626" : "var(--g66-muted)" }}>{fmt(Number(r.descuento_boutique ?? 0))}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.otros_descuentos ?? 0) > 0 ? "#dc2626" : "var(--g66-muted)" }}>{fmt(Number(r.otros_descuentos ?? 0))}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: efecto >= 0 ? "#15803d" : "#dc2626", fontWeight: 800 }}>{fmt(efecto)}</td>
                                    <td style={{ padding: "6px 8px", color: "var(--g66-muted)" }}>{r.observaciones ?? ""}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Checks de pagos */}
                  <div className="g66-card" style={{ padding: 16, borderLeft: `4px solid ${failedPaymentChecks.length > 0 ? "#dc2626" : "#16a34a"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: failedPaymentChecks.length > 0 ? "#dc2626" : "#15803d" }}>
                          Checks de pagos Wallet/Banco
                        </div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 3 }}>
                          Verifica que el total neto calce con la suma de pagos a Wallet y Banco.
                        </div>
                      </div>
                      <span style={{
                        background: failedPaymentChecks.length > 0 ? "#fee2e2" : "#dcfce7",
                        color: failedPaymentChecks.length > 0 ? "#dc2626" : "#15803d",
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}>
                        {failedPaymentChecks.length > 0 ? `${failedPaymentChecks.length} no calzan` : "Todo calza"}
                      </span>
                    </div>
                    <div style={{ marginBottom: 14, border: "1px solid var(--g66-border)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "9px 12px", background: "var(--g66-bg)", fontSize: 12, fontWeight: 900 }}>
                        Totales por medio de pago
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ background: "#fff" }}>
                          {["Moneda","Total Wallet","Total Banco","Total pago"].map(h => (
                            <th key={h} style={{ padding: "7px 10px", textAlign: h === "Moneda" ? "left" : "right", fontWeight: 700, color: "var(--g66-muted)", borderTop: "1px solid var(--g66-border)" }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {paymentCurrencyOrder.map(moneda => {
                            const v = paymentTotalsByCurrency[moneda] ?? { wallet: 0, banco: 0, total: 0 };
                            return (
                              <tr key={`payment-total-${moneda}`} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                <td style={{ padding: "7px 10px", fontWeight: 900 }}>{moneda}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", color: "#2563eb", fontWeight: 800 }}>{fmt(v.wallet, moneda === "USD" || moneda === "EUR" ? 2 : 0)}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", color: "#9a3412", fontWeight: 800 }}>{fmt(v.banco, moneda === "USD" || moneda === "EUR" ? 2 : 0)}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 900 }}>{fmt(v.total, moneda === "USD" || moneda === "EUR" ? 2 : 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ background: "var(--g66-bg)" }}>
                        {["Check","Moneda","Base a pagar","Wallet","Banco","Wallet + Banco","Diferencia","Estado"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: ["Base a pagar","Wallet","Banco","Wallet + Banco","Diferencia"].includes(h) ? "right" : "left", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {paymentChecks.map(c => (
                          <tr key={`${c.grupo}-${c.moneda}`} style={{ borderTop: "1px solid var(--g66-border)", background: c.ok ? "#fff" : "#fff5f5" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 800 }}>{c.grupo}</td>
                            <td style={{ padding: "6px 10px", fontWeight: 800 }}>{c.moneda}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(c.base)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#2563eb", fontWeight: 700 }}>{fmt(c.wallet)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#9a3412", fontWeight: 700 }}>{fmt(c.banco)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 800 }}>{fmt(c.totalPago)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: c.ok ? "#15803d" : "#dc2626", fontWeight: 800 }}>{fmt(c.diff, 2)}</td>
                            <td style={{ padding: "6px 10px" }}>
                              <span style={{
                                background: c.ok ? "#dcfce7" : "#fee2e2",
                                color: c.ok ? "#15803d" : "#dc2626",
                                borderRadius: 999,
                                padding: "3px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                              }}>
                                {c.ok ? "Calza" : "No calza"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Promedios por moneda */}
                  <div className="g66-card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Promedios y checks por moneda</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ background: "var(--g66-bg)" }}>
                        {["Moneda","Personas","Prom. sueldo base","Prom. neto local","Total neto local","Total neto USD","Com. CX","Com. B2B","Asegurado"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: h === "Moneda" ? "left" : "right", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {Object.entries(totalesMoneda).sort(([a], [b]) => a.localeCompare(b)).map(([moneda, v]) => (
                          <tr key={moneda} style={{ borderTop: "1px solid var(--g66-border)" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 800 }}>{moneda}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--g66-muted)" }}>{v.count}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(v.sueldoBase / Math.max(1, v.count))}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(v.netoLocal / Math.max(1, v.count))}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(v.netoLocal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--g66-blue)", fontWeight: 700 }}>{fmt(v.netoUsd, 2)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: v.comCX > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(v.comCX)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: v.comB2B > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(v.comB2B)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: v.asegurado > 0 ? "#15803d" : "var(--g66-muted)" }}>{fmt(v.asegurado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Comparación mes pasado */}
                  {false && previousMonthComparisonRows.length > 0 && (
                    <div id="comparacion-mes-pasado" className="g66-card" style={{ padding: 16, borderLeft: "4px solid #2563eb", scrollMarginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#1d4ed8" }}>Comparación mes pasado</div>
                          <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                            Actual vs abril desde `/Users/alan.kulka/Desktop/Nomina de Servicios - ABRIL 2026 - VF (2).xlsx`.
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", fontWeight: 700 }}>{previousMonthComparisonRows.length} personas con match</div>
                      </div>
                      <div style={{ overflowX: "auto", border: "1px solid var(--g66-border)", borderRadius: 8 }}>
                        <table style={{ width: "100%", minWidth: 2520, borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "var(--g66-bg)" }}>
                              {[
                                "Nombre","País","Mon.","Pref. actual","Pref. abril",
                                "Base abril","Base actual","Δ base",
                                "Neto abril","Neto actual","Δ neto",
                                "CX abril","CX actual","Δ CX",
                                "B2B abril","B2B actual","Δ B2B",
                                "Com. abril","Com. actual","Δ com.",
                                "Wallet USD abr.","Wallet USD act.","Δ Wallet USD",
                                "Wallet local abr.","Wallet local act.","Δ Wallet local",
                                "Banco abril","Banco actual","Δ banco",
                                "Nov. abril","Nov. actual","Δ nov.",
                              ].map(h => (
                                <th key={h} style={{
                                  padding: "6px 8px",
                                  textAlign: ["Nombre","País","Mon.","Pref. actual","Pref. abril"].includes(h) ? "left" : "right",
                                  fontWeight: 700,
                                  color: "var(--g66-muted)",
                                  whiteSpace: "nowrap",
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previousMonthComparisonRows.map(({ row: r, previous, sueldoBaseDiff, netoDiff, comisionCxDiff, comisionB2BDiff, comisionesDiff, walletUsdDiff, walletLocalDiff, bancoDiff, novedadesDiff, currentComisiones, currentWalletUsd, currentWalletLocal, currentBanco, currentNovedades, previousWalletUsd, previousWalletLocal, previousBanco, previousNovedades }) => {
                              const diffColor = (value: number) => Math.abs(value) < 0.5 ? "var(--g66-muted)" : value > 0 ? "#15803d" : "#dc2626";
                              return (
                                <tr key={`prev-comp-${r.id}`} style={{ borderTop: "1px solid var(--g66-border)", background: Math.abs(netoDiff) >= 0.5 || Math.abs(comisionesDiff) >= 0.5 || Math.abs(walletUsdDiff) >= 0.5 || Math.abs(walletLocalDiff) >= 0.5 || Math.abs(bancoDiff) >= 0.5 ? "#fff" : "#fafafa" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 700, minWidth: 190 }}>{r.nombre}</td>
                                  <td style={{ padding: "6px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{r.pais}</td>
                                  <td style={{ padding: "6px 8px", fontWeight: 800 }}>{r.moneda}</td>
                                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.preferencia_pago ?? ""}</td>
                                  <td style={{ padding: "6px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{previous.preferencia_pago ?? ""}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.sueldo_base ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_base)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(sueldoBaseDiff), fontWeight: 800 }}>{fmt(sueldoBaseDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.sueldo_neto_local ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_neto_local)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(netoDiff), fontWeight: 800 }}>{fmt(netoDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comision_cx ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.comision_cx)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionCxDiff), fontWeight: 800 }}>{fmt(comisionCxDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comision_b2b ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.comision_b2b)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionB2BDiff), fontWeight: 800 }}>{fmt(comisionB2BDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comisiones ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentComisiones)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionesDiff), fontWeight: 800 }}>{fmt(comisionesDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousWalletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentWalletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(walletUsdDiff), fontWeight: 800 }}>{fmt(walletUsdDiff, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousWalletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentWalletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(walletLocalDiff), fontWeight: 800 }}>{fmt(walletLocalDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousBanco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentBanco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(bancoDiff), fontWeight: 800 }}>{fmt(bancoDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousNovedades)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentNovedades)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(novedadesDiff), fontWeight: 800 }}>{fmt(novedadesDiff)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Check tipo Excel */}
                  {verificationReviewRows.length > 0 && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #d97706" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#d97706", marginBottom: 10 }}>
                        Filas para revisar según lógica de nómina ({verificationReviewRows.length})
                      </div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 10 }}>
                        Replica los checks del Excel: variación de sueldo base, mes parcial, neto negativo, días cero y filas marcadas manualmente.
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ background: "var(--g66-bg)" }}>
                          {["Nombre","Motivo"].map(h => (
                            <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "var(--g66-muted)", fontSize: 11 }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {verificationReviewRows.map(r => {
                            const motivos = [
                              r.revisar ? "Marcado revisar" : "",
                              Math.abs(Number(r.variacion_salario_base ?? 0)) > 0 ? "Variación sueldo base" : "",
                              r.pct_mes < 0.999 ? "Mes parcial" : "",
                              r.sueldo_neto_usd < 0 ? "Neto negativo" : "",
                              r.dias_neto <= 0 ? "Días neto cero" : "",
                            ].filter(Boolean).join(" · ");
                            return (
                              <tr key={r.id} style={{ borderTop: "1px solid var(--g66-border)", background: r.revisar ? "#fffde7" : "#fff" }}>
                                <td style={{ padding: "5px 8px", fontWeight: 700 }}>{r.nombre}</td>
                                <td style={{ padding: "5px 8px", color: "#92400e" }}>{motivos}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Comisiones sin match */}
                  {unmatchedCommissions.length > 0 && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #dc2626" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 10 }}>
                        Comisiones sin empleado en nómina ({unmatchedCommissions.length})
                      </div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 8 }}>
                        Estos DNI están en el Excel de comisiones pero NO están en la nómina. Verificá si falta agregar la persona o si el DNI está mal escrito.
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ background: "var(--g66-bg)" }}>
                          {["Tipo","DNI","Nombre","Moneda","Monto"].map(h => <th key={h} style={{ padding: "5px 8px", textAlign: h === "Monto" ? "right" : "left", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {unmatchedCommissions.map((c, i) => (
                            <tr key={i} style={{ borderTop: "1px solid var(--g66-border)", background: "#fff5f5" }}>
                              <td style={{ padding: "5px 8px" }}><span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "1px 6px", fontWeight: 700, fontSize: 11 }}>{c.tipo}</span></td>
                              <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{c.dni}</td>
                              <td style={{ padding: "5px 8px", fontWeight: 600 }}>{c.nombre}</td>
                              <td style={{ padding: "5px 8px" }}>{c.moneda.trim()}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(c.monto_bruto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Moneda mismatch */}
                  {mismatchMoneda.length > 0 && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #d97706" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#d97706", marginBottom: 10 }}>
                        Moneda distinta entre nómina y comisión ({mismatchMoneda.length})
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ background: "var(--g66-bg)" }}>
                          {["Tipo","Nombre","Mon. nómina","Mon. comisión","Monto"].map(h => <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {mismatchMoneda.map((c, i) => {
                            const emp = employees.find(e => e.dni.trim() === c.dni.trim());
                            return (
                              <tr key={i} style={{ borderTop: "1px solid var(--g66-border)", background: "#fffbeb" }}>
                                <td style={{ padding: "5px 8px" }}><span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 6px", fontWeight: 700, fontSize: 11 }}>{c.tipo}</span></td>
                                <td style={{ padding: "5px 8px", fontWeight: 600 }}>{c.nombre}</td>
                                <td style={{ padding: "5px 8px" }}><span style={{ fontWeight: 700 }}>{emp?.moneda}</span></td>
                                <td style={{ padding: "5px 8px", color: "#dc2626", fontWeight: 700 }}>{c.moneda.trim()}</td>
                                <td style={{ padding: "5px 8px" }}>{fmt(c.monto_bruto)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Fuera de período — terminaron antes de que empezara el mes */}
                  {fueraDePeriodo.length > 0 && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #dc2626" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 6 }}>
                        Contrato terminado ANTES del período ({fueraDePeriodo.length}) — NO deben estar en esta nómina
                      </div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 10 }}>
                        Estas personas tienen <code>fecha_termino</code> anterior al {selected?.fecha_inicio}. Fueron agregadas manualmente por error o no fueron excluidas al generar. Eliminá cada fila.
                      </div>
                      {fueraDePeriodo.map(r => (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--g66-border)" }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre}</span>
                            <span style={{ marginLeft: 10, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Terminó: {r.fecha_termino}</span>
                          </div>
                          <button
                            onClick={async () => {
                              await fetch(`/api/nominas/base`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, _delete: true }) });
                              if (selected) { const res = await fetch(`/api/nominas/base?period_id=${selected.id}`); setEmployees((await res.json()) ?? []); }
                            }}
                            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >
                            Eliminar de nómina
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ARG sin ARS + neto negativo + días cero */}
                  {(argSinArs.length > 0 || negativoNeto.length > 0 || cerosDias.length > 0) && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #d97706" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#d97706", marginBottom: 10 }}>Alertas de nómina</div>
                      {argSinArs.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Argentinos sin monto ARS ({argSinArs.length})</div>
                          {argSinArs.map(e => <div key={e.id} style={{ fontSize: 12, color: "var(--g66-muted)", paddingLeft: 12 }}>· {e.nombre}</div>)}
                        </div>
                      )}
                      {negativoNeto.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>Sueldo neto negativo ({negativoNeto.length})</div>
                          {negativoNeto.map(r => <div key={r.id} style={{ fontSize: 12, color: "#dc2626", paddingLeft: 12 }}>· {r.nombre} → USD {fmt(r.sueldo_neto_usd, 2)}</div>)}
                        </div>
                      )}
                      {cerosDias.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#d97706", marginBottom: 4 }}>Días neto = 0 (sin fecha de término) ({cerosDias.length})</div>
                          {cerosDias.map(r => <div key={r.id} style={{ fontSize: 12, color: "var(--g66-muted)", paddingLeft: 12 }}>· {r.nombre}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proporcionalidad */}
                  {parciales.length > 0 && (
                    <div className="g66-card" style={{ padding: 16, borderLeft: "4px solid #7c3aed" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#7c3aed", marginBottom: 4 }}>
                        Sueldo proporcional — mes parcial ({parciales.length})
                      </div>
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 10 }}>
                        Fórmula: <code style={{ background: "var(--g66-bg)", padding: "1px 5px", borderRadius: 4 }}>(sueldo_base × (1 + variación/100)) ÷ {selected ? daysBetween(selected.fecha_inicio, selected.fecha_fin) : "días_mes"} × días_trabajados</code>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ background: "var(--g66-bg)" }}>
                          {["Nombre","Motivo","Días trabajados","% del mes","Sueldo base","Var. %","Base ajustada","Proporcional","Neto USD"].map(h => (
                            <th key={h} style={{ padding: "5px 8px", textAlign: ["Días trabajados","% del mes","Sueldo base","Var. %","Base ajustada","Proporcional","Neto USD"].includes(h) ? "right" : "left", fontWeight: 600, color: "var(--g66-muted)", fontSize: 11 }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {parciales.map(r => {
                            const esIngreso = r.fecha_ingreso && r.fecha_ingreso > (selected?.fecha_inicio ?? "");
                            const esTermino = r.fecha_termino && r.fecha_termino < (selected?.fecha_fin ?? "");
                            const motivo = esIngreso && esTermino
                              ? `Ingresó ${r.fecha_ingreso} · Terminó ${r.fecha_termino}`
                              : esTermino
                              ? `Terminó el ${r.fecha_termino}`
                              : `Ingresó el ${r.fecha_ingreso}`;
                            return (
                              <tr key={r.id} style={{ borderTop: "1px solid var(--g66-border)", background: "#faf5ff" }}>
                                <td style={{ padding: "5px 8px", fontWeight: 600 }}>{r.nombre}</td>
                                <td style={{ padding: "5px 8px", color: "#7c3aed", fontSize: 11 }}>{motivo}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>
                                  {r.dias_base}<span style={{ color: "var(--g66-muted)", fontWeight: 400 }}>/{r.dias_mes}</span>
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                  <span style={{ background: "#f5f3ff", color: "#7c3aed", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>
                                    {(r.pct_mes * 100).toFixed(1)}%
                                  </span>
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_base)} <span style={{ color: "var(--g66-muted)", fontSize: 10 }}>{r.moneda}</span></td>
                                <td style={{ padding: "5px 8px", textAlign: "right", color: (r.variacion_salario_base ?? 0) !== 0 ? "#7c3aed" : "var(--g66-muted)", fontWeight: (r.variacion_salario_base ?? 0) !== 0 ? 700 : 400 }}>{r.variacion_salario_base ?? 0}%</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.sueldo_base_ajustado)} <span style={{ color: "var(--g66-muted)", fontSize: 10 }}>{r.moneda}</span></td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>
                                  {fmt(r.sueldo_proporcional)} <span style={{ color: "var(--g66-muted)", fontSize: 10 }}>{r.moneda}</span>
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "var(--g66-blue)" }}>{fmt(r.sueldo_neto_usd, 2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totales por país */}
                  <div className="g66-card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Totales por país / moneda</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ background: "var(--g66-bg)" }}>
                        {["País (moneda)","Personas","Neto local","Neto USD"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: h === "País (moneda)" ? "left" : "right", fontWeight: 600, color: "var(--g66-muted)" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {Object.entries(totalesPais).sort(([,a],[,b]) => b.usd - a.usd).map(([key, v]) => (
                          <tr key={key} style={{ borderTop: "1px solid var(--g66-border)" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 600 }}>{key}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--g66-muted)" }}>{v.count}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(v.local)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "var(--g66-blue)" }}>{fmt(v.usd, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "var(--g66-bg)", fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: "7px 10px", textAlign: "right" }}>Total:</td>
                          <td style={{ padding: "7px 10px", textAlign: "right" }}>—</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--g66-blue)", fontSize: 14 }}>USD {fmt(totalUSD, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Checks finales */}
                  <div className="g66-card" style={{ padding: 18, border: "1px solid var(--g66-border)", boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 15 }}>Checks finales</div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 3 }}>
                          Resumen de los módulos críticos antes de descargar Banco, Wallet o cerrar la nómina.
                        </div>
                      </div>
                      <span style={{
                        background: totalIssues === 0 ? "#dcfce7" : "#fee2e2",
                        color: totalIssues === 0 ? "#15803d" : "#dc2626",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}>
                        {totalIssues === 0 ? "Sin alertas críticas" : `${totalIssues} alerta(s)`}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                      {finalChecks.map(check => {
                        const isOk = check.severity === "ok";
                        const isError = check.severity === "error";
                        const bg = isOk ? "#f0fdf4" : isError ? "#fff5f5" : check.severity === "warn" ? "#fffbeb" : "#f8fafc";
                        const border = isOk ? "#bbf7d0" : isError ? "#fecaca" : check.severity === "warn" ? "#fde68a" : "#e2e8f0";
                        const color = isOk ? "#15803d" : isError ? "#dc2626" : check.severity === "warn" ? "#d97706" : "#475569";
                        return (
                          <div key={check.label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 13px", minHeight: 96 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
                              <div style={{ fontSize: 12, fontWeight: 900, color }}>{check.label}</div>
                              <button
                                type="button"
                                disabled={check.count === 0}
                                onClick={() => setExpandedFinalCheck(prev => prev === check.label ? null : check.label)}
                                style={{
                                  background: "#fff",
                                  color,
                                  border: `1px solid ${border}`,
                                  borderRadius: 999,
                                  padding: "3px 8px",
                                  fontSize: 11,
                                  fontWeight: 900,
                                  cursor: check.count > 0 ? "pointer" : "default",
                                  opacity: check.count > 0 ? 1 : 0.85,
                                }}
                              >
                                {check.status}
                              </button>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{check.count}</div>
                            <div style={{ fontSize: 11, color: "var(--g66-muted)", marginTop: 6, lineHeight: 1.35 }}>{check.detail}</div>
                            {expandedFinalCheck === check.label && check.count > 0 && (
                              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 5 }}>
                                {(finalCheckDetails[check.label] ?? []).map((line, idx) => (
                                  <div key={`${check.label}-detail-${idx}`} style={{ fontSize: 11, lineHeight: 1.35, color: "#334155" }}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(walletDataIssues.length > 0 || bankDataIssues.length > 0) && (
                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#fff5f5", border: "1px solid #fecaca", color: "#991b1b", fontSize: 12 }}>
                        <div style={{ fontWeight: 900, marginBottom: 4 }}>Datos de pago incompletos</div>
                        {[...walletDataIssues, ...bankDataIssues].slice(0, 10).map(r => (
                          <div key={`payment-data-${r.id}`} style={{ lineHeight: 1.45 }}>
                            · {r.nombre} ({r.pais}) — {walletDataIssues.some(w => w.id === r.id) ? "Wallet sin correo/usuario" : "Banco sin banco/número"}
                          </div>
                        ))}
                        {walletDataIssues.length + bankDataIssues.length > 10 && (
                          <div style={{ marginTop: 3 }}>...y {walletDataIssues.length + bankDataIssues.length - 10} más.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* All clear */}
                  {totalIssues === 0 && (
                    <div style={{ background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 24 }}>✓</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#166534", fontSize: 14 }}>Todo OK — sin alertas</div>
                        <div style={{ fontSize: 12, color: "#15803d" }}>La nómina está lista para revisión final.</div>
                      </div>
                    </div>
                  )}

                  {/* Comparación mes pasado */}
                  <div id="comparacion-mes-pasado" className="g66-card" style={{ padding: 16, borderLeft: "4px solid #2563eb", scrollMarginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: "#1d4ed8" }}>Comparación mes pasado</div>
                          <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>
                            Actual vs abril desde `/Users/alan.kulka/Desktop/Nomina de Servicios - ABRIL 2026 - VF (2).xlsx`.
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--g66-muted)", fontWeight: 700 }}>
                          {previousMonthComparisonRows.length} personas con match · {previousReference.length} filas abril
                        </div>
                      </div>
                      {previousMonthComparisonRows.length === 0 && (
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 14px", color: "#1e40af", fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
                          No hay filas para mostrar todavía. Estado: empleados actuales {calcRows.length}, referencia abril {previousReference.length}.
                          {previousReferenceError ? ` Error: ${previousReferenceError}` : " Si acabas de abrir la página, vuelve a seleccionar Mayo 2026 o recarga."}
                        </div>
                      )}
                      {previousMonthComparisonRows.length > 0 && (
                      <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12, marginBottom: 12 }}>
                        {[
                          { title: "Comparación Sueldo Base, moneda local", rows: previousComparisonDashboard.baseRows, current: "Monto actual", previous: "Monto mes pasado", type: "local" },
                          { title: "Comparación Sueldo Neto, moneda local", rows: previousComparisonDashboard.netLocalRows, current: "Monto actual", previous: "Monto mes pasado", type: "local" },
                          { title: "Comparación Sueldo Neto, USD", rows: previousComparisonDashboard.netUsdRows, current: "Monto actual USD", previous: "Monto mes pasado USD", type: "country" },
                          { title: "Comparación Cantidad de personas", rows: previousComparisonDashboard.headcountRows, current: "# actual", previous: "# mes pasado", type: "country-count" },
                          { title: "Comparación Sueldo Neto promedio, USD / Head Count", rows: previousComparisonDashboard.avgUsdRows, current: "Promedio actual", previous: "Promedio mes pasado", type: "country" },
                        ].map(section => (
                          <div key={section.title} style={{ border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                            <div style={{ padding: "9px 10px", fontWeight: 900, fontSize: 12, color: "#111827", background: "#f8fafc", borderBottom: "1px solid var(--g66-border)" }}>{section.title}</div>
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                  <tr style={{ background: "#eff6ff" }}>
                                    <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 800, color: "#1d4ed8" }}>País</th>
                                    {section.type === "local" && <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 800, color: "#1d4ed8" }}>Mon.</th>}
                                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}>{section.current}</th>
                                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}>{section.previous}</th>
                                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}>Var.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.map((r: any) => (
                                    <tr key={`${section.title}-${r.key}`} style={{ borderTop: "1px solid var(--g66-border)", background: r.pais === "Total" ? "#f8fafc" : "#fff" }}>
                                      <td style={{ padding: "6px 8px", fontWeight: r.pais === "Total" ? 900 : 700 }}>{r.pais}</td>
                                      {section.type === "local" && <td style={{ padding: "6px 8px", fontWeight: 800 }}>{r.moneda}</td>}
                                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{section.type === "country-count" ? fmt(r.current) : fmt(r.current)}</td>
                                      <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--g66-muted)" }}>{section.type === "country-count" ? fmt(r.previous) : fmt(r.previous)}</td>
                                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 900, color: variationColor(r.variation) }}>{formatPct(r.variation)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                        <div style={{ border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                          <div style={{ padding: "9px 10px", fontWeight: 900, fontSize: 12, color: "#111827", background: "#f8fafc", borderBottom: "1px solid var(--g66-border)" }}>Comparación Comisiones, USD</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: "#eff6ff" }}>
                                {["Área", "Actual USD", "Mes pasado USD", "Var."].map(h => (
                                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Área" ? "left" : "right", fontWeight: 800, color: "#1d4ed8" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previousComparisonDashboard.commissions.map(r => (
                                <tr key={`commission-compare-${r.area}`} style={{ borderTop: "1px solid var(--g66-border)", background: r.area === "Total" ? "#f8fafc" : "#fff" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 900 }}>{r.area}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(r.current)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--g66-muted)" }}>{fmt(r.previous)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 900, color: variationColor(r.variation) }}>{formatPct(r.variation)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ border: "1px solid var(--g66-border)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                          <div style={{ padding: "9px 10px", fontWeight: 900, fontSize: 12, color: "#111827", background: "#f8fafc", borderBottom: "1px solid var(--g66-border)" }}>Check Pagos mes actual</div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 620 }}>
                              <thead>
                                <tr style={{ background: "#eff6ff" }}>
                                  {["Grupo", "Mon.", "Base", "Wallet", "Banco", "Diferencia", "Check"].map(h => (
                                    <th key={h} style={{ padding: "6px 8px", textAlign: ["Grupo", "Mon.", "Check"].includes(h) ? "left" : "right", fontWeight: 800, color: "#1d4ed8" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previousComparisonDashboard.paymentRows.map(r => (
                                  <tr key={`payment-compare-${r.grupo}-${r.moneda}`} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                    <td style={{ padding: "6px 8px", fontWeight: 700 }}>{r.grupo}</td>
                                    <td style={{ padding: "6px 8px", fontWeight: 800 }}>{r.moneda}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(r.base)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(r.wallet)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(r.banco)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: Math.abs(r.diff) <= 0.5 ? "var(--g66-muted)" : "#dc2626", fontWeight: 900 }}>{fmt(r.diff, 2)}</td>
                                    <td style={{ padding: "6px 8px", fontWeight: 900, color: r.ok ? "#15803d" : "#dc2626" }}>{r.ok ? "OK" : "Revisar"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "none", overflowX: "auto", border: "1px solid var(--g66-border)", borderRadius: 8, marginBottom: 12 }}>
                        <table style={{ width: "100%", minWidth: 1680, borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "#eff6ff" }}>
                              {[
                                "Mon.","Pers. abr.","Pers. act.",
                                "Neto abr.","Neto act.","Δ neto",
                                "Com. abr.","Com. act.","Δ com.",
                                "Wallet USD abr.","Wallet USD act.","Δ Wallet USD",
                                "Wallet local abr.","Wallet local act.","Δ Wallet local",
                                "Banco abr.","Banco act.","Δ banco",
                              ].map(h => (
                                <th key={h} style={{ padding: "6px 8px", textAlign: h === "Mon." ? "left" : "right", fontWeight: 800, color: "#1d4ed8", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previousMonthTotals.map(({ moneda, current, previous }) => {
                              const diffColor = (value: number) => Math.abs(value) < 0.5 ? "var(--g66-muted)" : value > 0 ? "#15803d" : "#dc2626";
                              return (
                                <tr key={`prev-total-${moneda}`} style={{ borderTop: "1px solid var(--g66-border)" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 900 }}>{moneda}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{previous.personas}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{current.personas}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previous.neto)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(current.neto)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(current.neto - previous.neto), fontWeight: 900 }}>{fmt(current.neto - previous.neto)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previous.comisiones)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(current.comisiones)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(current.comisiones - previous.comisiones), fontWeight: 900 }}>{fmt(current.comisiones - previous.comisiones)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previous.walletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(current.walletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(current.walletUsd - previous.walletUsd), fontWeight: 900 }}>{fmt(current.walletUsd - previous.walletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previous.walletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(current.walletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(current.walletLocal - previous.walletLocal), fontWeight: 900 }}>{fmt(current.walletLocal - previous.walletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previous.banco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800 }}>{fmt(current.banco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(current.banco - previous.banco), fontWeight: 900 }}>{fmt(current.banco - previous.banco)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display: "none", overflowX: "auto", border: "1px solid var(--g66-border)", borderRadius: 8 }}>
                        <table style={{ width: "100%", minWidth: 2520, borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "var(--g66-bg)" }}>
                              {[
                                "Nombre","País","Mon.","Pref. actual","Pref. abril",
                                "Base abril","Base actual","Δ base",
                                "Neto abril","Neto actual","Δ neto",
                                "CX abril","CX actual","Δ CX",
                                "B2B abril","B2B actual","Δ B2B",
                                "Com. abril","Com. actual","Δ com.",
                                "Wallet USD abr.","Wallet USD act.","Δ Wallet USD",
                                "Wallet local abr.","Wallet local act.","Δ Wallet local",
                                "Banco abril","Banco actual","Δ banco",
                                "Nov. abril","Nov. actual","Δ nov.",
                              ].map(h => (
                                <th key={h} style={{
                                  padding: "6px 8px",
                                  textAlign: ["Nombre","País","Mon.","Pref. actual","Pref. abril"].includes(h) ? "left" : "right",
                                  fontWeight: 700,
                                  color: "var(--g66-muted)",
                                  whiteSpace: "nowrap",
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previousMonthComparisonRows.map(({ row: r, previous, sueldoBaseDiff, netoDiff, comisionCxDiff, comisionB2BDiff, comisionesDiff, walletUsdDiff, walletLocalDiff, bancoDiff, novedadesDiff, currentComisiones, currentWalletUsd, currentWalletLocal, currentBanco, currentNovedades, previousWalletUsd, previousWalletLocal, previousBanco, previousNovedades }) => {
                              const diffColor = (value: number) => Math.abs(value) < 0.5 ? "var(--g66-muted)" : value > 0 ? "#15803d" : "#dc2626";
                              return (
                                <tr key={`prev-comp-bottom-${r.id}`} style={{ borderTop: "1px solid var(--g66-border)", background: Math.abs(netoDiff) >= 0.5 || Math.abs(comisionesDiff) >= 0.5 || Math.abs(walletUsdDiff) >= 0.5 || Math.abs(walletLocalDiff) >= 0.5 || Math.abs(bancoDiff) >= 0.5 ? "#fff" : "#fafafa" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 700, minWidth: 190 }}>{r.nombre}</td>
                                  <td style={{ padding: "6px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{r.pais}</td>
                                  <td style={{ padding: "6px 8px", fontWeight: 800 }}>{r.moneda}</td>
                                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.preferencia_pago ?? ""}</td>
                                  <td style={{ padding: "6px 8px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{previous.preferencia_pago ?? ""}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.sueldo_base ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_base)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(sueldoBaseDiff), fontWeight: 800 }}>{fmt(sueldoBaseDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.sueldo_neto_local ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.sueldo_neto_local)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(netoDiff), fontWeight: 800 }}>{fmt(netoDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comision_cx ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.comision_cx)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionCxDiff), fontWeight: 800 }}>{fmt(comisionCxDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comision_b2b ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(r.comision_b2b)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionB2BDiff), fontWeight: 800 }}>{fmt(comisionB2BDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(Number(previous.comisiones ?? 0))}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentComisiones)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(comisionesDiff), fontWeight: 800 }}>{fmt(comisionesDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousWalletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentWalletUsd, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(walletUsdDiff), fontWeight: 800 }}>{fmt(walletUsdDiff, 2)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousWalletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentWalletLocal)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(walletLocalDiff), fontWeight: 800 }}>{fmt(walletLocalDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousBanco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentBanco)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(bancoDiff), fontWeight: 800 }}>{fmt(bancoDiff)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(previousNovedades)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fmt(currentNovedades)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: diffColor(novedadesDiff), fontWeight: 800 }}>{fmt(novedadesDiff)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      </>
                      )}
                    </div>
                </div>
              )
            )}

            {/* TAB: Check boletas */}
            {activeTab === "checkeo_boleta" && (
              <div style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 10, padding: 22, minHeight: 260 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--g66-text)", marginBottom: 6 }}>Check boletas</div>
                    <div style={{ fontSize: 13, color: "var(--g66-muted)" }}>
                      Nómina de <strong>{selected ? formatMes(selected.mes) : "—"}</strong>. Argentinos deben subir 2 boletas (USD + ARS).
                    </div>
                    {boletaSheetName && (
                      <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 4 }}>
                        {boletaSheetName} · {boletaRows.length} respuestas · mes: {boletaCurrentMonth || "—"}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={loadBoletaResponses}
                      disabled={boletaLoading}
                      style={{ border: "none", background: "var(--g66-primary)", color: "#fff", borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: boletaLoading ? "default" : "pointer", opacity: boletaLoading ? 0.7 : 1 }}
                    >
                      {boletaLoading ? "Cargando..." : "Actualizar desde Google Sheet"}
                    </button>
                    <button
                      type="button"
                      onClick={runGeminiAnalysis}
                      disabled={geminiAnalyzing || boletaRows.length === 0}
                      style={{ border: "none", background: geminiAnalyzing ? "#6b7280" : "#7c3aed", color: "#fff", borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: (geminiAnalyzing || boletaRows.length === 0) ? "default" : "pointer", opacity: (geminiAnalyzing || boletaRows.length === 0) ? 0.7 : 1 }}
                    >
                      {geminiAnalyzing
                        ? `Analizando... ${geminiProgress.current}/${geminiProgress.total}`
                        : geminiReport.length > 0
                          ? `Gemini ✓ (${geminiReport.length})`
                          : "Analizar con Gemini"}
                    </button>
                    {geminiReport.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCross(v => !v)}
                        style={{ border: "none", background: showCross ? "#059669" : "#0f172a", color: "#fff", borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
                      >
                        {showCross ? "Ocultar cruce" : "Cruzar con nómina"}
                      </button>
                    )}
                  </div>
                </div>

                {boletaError && (
                  <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, fontWeight: 700 }}>
                    {boletaError}
                  </div>
                )}

                {/* Progress bar during analysis */}
                {geminiAnalyzing && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 6 }}>
                      Leyendo PDFs con Gemini... {geminiProgress.current} de {geminiProgress.total}
                    </div>
                    <div style={{ background: "#e2e8f0", borderRadius: 8, height: 8, overflow: "hidden" }}>
                      <div style={{ background: "#7c3aed", height: "100%", width: `${geminiProgress.total > 0 ? (geminiProgress.current / geminiProgress.total) * 100 : 0}%`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {boletaRows.length === 0 && !boletaLoading && (
                  <div style={{ border: "1px dashed var(--g66-border)", borderRadius: 10, padding: 24, color: "var(--g66-muted)", fontSize: 13, textAlign: "center" }}>
                    Carga las respuestas del Google Sheet para comenzar.
                  </div>
                )}

                {/* Section 1: Gemini Report */}
                {geminiReport.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--g66-text)", marginBottom: 10 }}>
                      Reporte Gemini — lo que cada persona puso en su boleta
                    </div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--g66-border)", borderRadius: 10 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead style={{ background: "#f8fafc", color: "var(--g66-muted)" }}>
                          <tr>
                            {["Correo (formulario)", "Nombre en boleta", "Monto", "Moneda", "Fecha boleta", "PDF", "Observación"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "9px 12px", borderBottom: "1px solid var(--g66-border)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {geminiReport.map((row, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #edf2f7", background: row.error ? "#fff7f7" : "#fff" }}>
                              <td style={{ padding: "8px 12px", color: "var(--g66-muted)", whiteSpace: "nowrap" }}>{row.formEmail || "—"}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--g66-text)", minWidth: 200 }}>{row.nombreEnBoleta || "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>{row.monto !== null ? fmt(row.monto, 2) : "—"}</td>
                              <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{row.moneda || "—"}</td>
                              <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{row.fecha || "—"}</td>
                              <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                                {row.fileUrl ? <a href={row.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--g66-primary)", fontWeight: 800 }}>Abrir</a> : "—"}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#b91c1c", fontSize: 11 }}>{row.error || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 2: Cross with nómina */}
                {showCross && geminiReport.length > 0 && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--g66-text)", marginBottom: 10 }}>
                      Cruce con nómina — {formatMes(selected?.mes ?? "")}
                    </div>

                    {/* Summary cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 1fr))", gap: 10, marginBottom: 16 }}>
                      {[
                        ["Total esperados", boletaSummary.total, "#f1f5f9", "#334155"],
                        ["OK", boletaSummary.ok, "#dcfce7", "#166534"],
                        ["Sin respuesta", boletaSummary.missing, "#fee2e2", "#991b1b"],
                        ["Monto distinto", boletaSummary.monto_distinto, "#ffedd5", "#9a3412"],
                        ["Fecha incorrecta", boletaSummary.fecha_incorrecta, "#fef3c7", "#92400e"],
                        ["Sin monto", boletaSummary.sin_monto, "#ede9fe", "#5b21b6"],
                      ].map(([label, value, bg, color]) => (
                        <div key={String(label)} style={{ background: String(bg), color: String(color), borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.06)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800 }}>{label}</div>
                          <div style={{ fontSize: 24, fontWeight: 950, marginTop: 4 }}>{String(value)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Cross table */}
                    <div style={{ overflowX: "auto", border: "1px solid var(--g66-border)", borderRadius: 10 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead style={{ background: "#f8fafc", color: "var(--g66-muted)" }}>
                          <tr>
                            {["Estado", "Nombre (nómina)", "País", "Mon.", "Monto nómina", "Monto Gemini", "Diferencia", "Fecha boleta", "PDF"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "9px 12px", borderBottom: "1px solid var(--g66-border)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {crossRows.map((row, i) => {
                            const bg = row.status === "ok" ? "#f0fdf4" : row.status === "sin_respuesta" ? "#fff7f7" : "#fffbeb";
                            const statusColor = row.status === "ok" ? "#166534" : row.status === "sin_respuesta" ? "#b91c1c" : "#92400e";
                            const statusLabel = row.status === "ok" ? "✓ OK" : row.status === "sin_respuesta" ? "Sin respuesta" : row.status === "monto_distinto" ? "Monto distinto" : row.status === "fecha_incorrecta" ? "Fecha incorrecta" : "Sin monto";
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid #edf2f7", background: bg }}>
                                <td style={{ padding: "9px 12px", fontWeight: 900, whiteSpace: "nowrap", color: statusColor }}>{statusLabel}</td>
                                <td style={{ padding: "9px 12px", fontWeight: 700, color: "var(--g66-text)", minWidth: 200 }}>{row.nombre}</td>
                                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{row.pais || "—"}</td>
                                <td style={{ padding: "9px 12px", fontWeight: 900, whiteSpace: "nowrap" }}>{row.moneda}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(row.montoNomina, 2)}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{row.montoGemini !== null ? fmt(row.montoGemini, 2) : "—"}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap", color: row.diferencia === null ? "var(--g66-muted)" : row.diferencia > 0 ? "#b91c1c" : row.diferencia < 0 ? "#7c3aed" : "#166534" }}>
                                  {row.diferencia !== null ? (row.diferencia > 0 ? "+" : "") + fmt(row.diferencia, 2) : "—"}
                                </td>
                                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{row.fechaGemini || "—"}</td>
                                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                                  {row.fileUrl ? <a href={row.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--g66-primary)", fontWeight: 800 }}>Abrir</a> : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {commentEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 230 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 440, boxShadow: "0 18px 50px rgba(0,0,0,0.22)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ position: "relative", width: 38, height: 28, borderRadius: 14, background: "#dbeafe", border: "1px solid #60a5fa", flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, bottom: -6, width: 10, height: 10, background: "#dbeafe", borderLeft: "1px solid #60a5fa", borderBottom: "1px solid #60a5fa", transform: "rotate(-22deg)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "var(--g66-text)" }}>Comentario</div>
                <div style={{ fontSize: 12, color: "var(--g66-muted)", marginTop: 2 }}>{commentEmp.nombre} · {commentEmp.dni}</div>
              </div>
            </div>
            <textarea
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value)}
              placeholder="Escribe un comentario para esta persona..."
              autoFocus
              style={{ width: "100%", minHeight: 150, border: "1px solid var(--g66-border)", borderRadius: 10, padding: "10px 12px", fontSize: 14, lineHeight: 1.5, resize: "vertical", outline: "none" }}
            />
            <div style={{ fontSize: 11, color: "var(--g66-muted)", marginTop: 8 }}>
              Se guarda en Supabase en esta persona de la nómina y se verá en ambas bases si corresponde.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button onClick={() => { setCommentEmp(null); setCommentDraft(""); }} style={{ background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--g66-muted)" }}>Cancelar</button>
              <button onClick={saveComment} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* New period modal */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 18 }}>Nuevo período</div>

            {/* Mes y año */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 5 }}>MES</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={newMes.month} onChange={e => setNewMes(m => ({ ...m, month: parseInt(e.target.value) }))} style={{ flex: 1, border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 10px", fontSize: 14 }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <input type="number" value={newMes.year} onChange={e => setNewMes(m => ({ ...m, year: parseInt(e.target.value) }))} style={{ width: 85, border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 10px", fontSize: 14 }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--g66-muted)", marginBottom: 18 }}>{firstDay(newMes.year, newMes.month)} → {lastDay(newMes.year, newMes.month)}</div>

            {/* Copiar nómina anterior */}
            {periods.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={copyFrom}
                    onChange={e => setCopyFrom(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--g66-blue)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g66-text)" }}>Copiar nómina anterior</span>
                </label>
                {copyFrom && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 5 }}>COPIAR DESDE</label>
                    <select
                      value={copyFromId}
                      onChange={e => setCopyFromId(e.target.value)}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 10px", fontSize: 14 }}
                    >
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>{formatMes(p.mes)} · {p.status === "cerrado" ? "Cerrado" : "Borrador"}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 8, padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
                      Se copian: empleados, sueldos, ARS split, wallets, preferencias de pago y TDC.<br />
                      Se resetean a 0: días descuento, horas extra, otros ingresos/descuentos.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNew(false)} disabled={creating} style={{ background: "none", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={createPeriod} disabled={creating} style={{ background: creating ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: creating ? "default" : "pointer" }}>
                {creating ? "Creando..." : copyFrom ? "Crear y copiar" : "Crear vacío"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editar empleado modal */}
      {editingEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Editar datos</div>
            <div style={{ fontSize: 13, color: "var(--g66-muted)", marginBottom: 18 }}>DNI: {editingEmp.dni}</div>

            {/* Fila 1: Nombre */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>NOMBRE</label>
            <input type="text" value={editEmpData.nombre} onChange={e => setEditEmpData(d => ({ ...d, nombre: e.target.value }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />

            {/* Fila 2: Email */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>EMAIL GLOBAL66</label>
            <input type="email" value={editEmpData.email_global} onChange={e => setEditEmpData(d => ({ ...d, email_global: e.target.value }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />

            {/* Fila 3: Cargo + Área */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CARGO</label>
                <input type="text" value={editEmpData.cargo} onChange={e => setEditEmpData(d => ({ ...d, cargo: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>ÁREA</label>
                <input type="text" value={editEmpData.area} onChange={e => setEditEmpData(d => ({ ...d, area: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Fila 4: Centro de costo */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CENTRO DE COSTO</label>
            <input type="text" value={editEmpData.centro_costo} onChange={e => setEditEmpData(d => ({ ...d, centro_costo: e.target.value }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />

            {/* Fila 5: País + Moneda */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>PAÍS</label>
                <input type="text" value={editEmpData.pais} onChange={e => setEditEmpData(d => ({ ...d, pais: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>MONEDA</label>
                <select value={editEmpData.moneda} onChange={e => setEditEmpData(d => ({ ...d, moneda: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                  {["USD","COP","CLP","ARS","PEN","EUR","PAB"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Fila 6: Sueldo base */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>SUELDO BASE</label>
                <input type="number" step="any" value={editEmpData.sueldo_base}
                  onChange={e => setEditEmpData(d => ({ ...d, sueldo_base: parseFloat(e.target.value) || 0 }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ width: 150 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>VAR. SUELDO %</label>
                <input type="number" step="any" value={editEmpData.variacion_salario_base}
                  onChange={e => setEditEmpData(d => ({ ...d, variacion_salario_base: parseFloat(e.target.value) || 0 }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Fila 7: Fechas */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>FECHA INGRESO</label>
                <input type="date" value={editEmpData.fecha_ingreso} onChange={e => setEditEmpData(d => ({ ...d, fecha_ingreso: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>FECHA TÉRMINO</label>
                <input type="date" value={editEmpData.fecha_termino} onChange={e => setEditEmpData(d => ({ ...d, fecha_termino: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Argentina */}
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="edit-es-arg" checked={editEmpData.es_argentina}
                onChange={e => setEditEmpData(d => ({ ...d, es_argentina: e.target.checked }))} />
              <label htmlFor="edit-es-arg" style={{ fontSize: 13, fontWeight: 600 }}>Es Argentina (split ARS/USD)</label>
            </div>
            {editEmpData.es_argentina && (
              <>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>MONTO ARS (en USD)</label>
                <input type="number" step="any" value={editEmpData.monto_ars_usd}
                  onChange={e => setEditEmpData(d => ({ ...d, monto_ars_usd: parseFloat(e.target.value) || 0 }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
              </>
            )}

            {/* Preferencia + Wallet */}
            <div style={{ borderTop: "1px solid var(--g66-border)", paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>PREFERENCIA DE PAGO</label>
              <select value={editEmpData.preferencia_pago} onChange={e => setEditEmpData(d => ({ ...d, preferencia_pago: e.target.value }))}
                style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, marginBottom: 10 }}>
                <option value="Banco">Banco</option>
                <option value="Wallet">Wallet</option>
              </select>
              {editEmpData.preferencia_pago === "Wallet" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CORREO WALLET</label>
                    <input type="email" value={editEmpData.correo_wallet} onChange={e => setEditEmpData(d => ({ ...d, correo_wallet: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>USUARIO WALLET</label>
                    <input type="text" value={editEmpData.usuario_wallet} onChange={e => setEditEmpData(d => ({ ...d, usuario_wallet: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
              {editEmpData.preferencia_pago === "Banco" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>BANCO</label>
                    <input type="text" value={editEmpData.banco} onChange={e => setEditEmpData(d => ({ ...d, banco: e.target.value }))}
                      placeholder="Ej: BCP, Interbank, BBVA..."
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>TIPO DE CUENTA</label>
                    <input type="text" value={editEmpData.tipo_cuenta} onChange={e => setEditEmpData(d => ({ ...d, tipo_cuenta: e.target.value }))}
                      placeholder="Ahorros / Corriente"
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>NÚMERO DE CUENTA</label>
                    <input type="text" value={editEmpData.numero_cuenta} onChange={e => setEditEmpData(d => ({ ...d, numero_cuenta: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>OBSERVACIONES</label>
            <textarea value={editEmpData.observaciones} onChange={e => setEditEmpData(d => ({ ...d, observaciones: e.target.value }))}
              rows={2} placeholder="Ej: Revisar, Pendiente documentación..."
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", resize: "vertical", marginBottom: 10, fontFamily: "inherit" }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingEmp(null)} style={{ background: "none", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveEditEmp} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Novedades modal */}
      {editingRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Novedades</div>
            <div style={{ fontSize: 13, color: "var(--g66-muted)", marginBottom: 18 }}>{editingRow.nombre} · {editingRow.moneda}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>
                FECHA DE TÉRMINO <span style={{ fontWeight: 400 }}>— deja vacío si trabaja todo el mes</span>
              </label>
              <input type="date"
                value={editNovedades.fecha_termino}
                onChange={e => setEditNovedades(n => ({ ...n, fecha_termino: e.target.value }))}
                style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 10px", fontSize: 14 }} />
              {editNovedades.fecha_termino && selected && (
                <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
                  Se pagará proporcional hasta el {editNovedades.fecha_termino}
                </div>
              )}
            </div>
            {([
              { key: "dias_descuento", label: "Días de descuento", hint: "Ausencias, vacaciones" },
              { key: "horas_extra", label: "Horas extra", hint: "Se dividen ÷9 para convertir a días" },
              { key: "otros_ingresos", label: "Otros ingresos", hint: "Bonos, ajustes en moneda local" },
              { key: "asegurado", label: "Asegurado", hint: "Monto mensual, se calcula proporcional por fecha de ingreso/término" },
              { key: "descuento_boutique", label: "Descuento Boutique", hint: "" },
              { key: "otros_descuentos", label: "Otros descuentos", hint: "" },
            ] as const).map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 4 }}>
                  {field.label.toUpperCase()} {field.hint && <span style={{ fontWeight: 400 }}>— {field.hint}</span>}
                </label>
                <input type="number" step="any"
                  value={editNovedades[field.key]}
                  onChange={e => setEditNovedades(n => ({ ...n, [field.key]: parseFloat(e.target.value) || 0 }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 10px", fontSize: 14 }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setEditingRow(null)} style={{ background: "none", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveNovedades} style={{ background: "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Agregar persona modal */}
      {showAddEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 460, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Agregar persona</div>
            <div style={{ fontSize: 13, color: "var(--g66-muted)", marginBottom: 14 }}>
              {addEmpTarget === "argentina" ? "Argentina (USD/ARS)" : "Nómina Sin ARG"}
            </div>

            {/* Búsqueda en DB */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>BUSCAR EN BASE DE DATOS</label>
              <input
                type="text"
                placeholder="Escribí nombre o DNI..."
                value={empSearchQ}
                onChange={e => { setEmpSearchQ(e.target.value); searchEmployees(e.target.value); }}
                style={{ width: "100%", border: "1px solid var(--g66-blue)", borderRadius: 7, padding: "8px 10px", fontSize: 13, boxSizing: "border-box", outline: "none" }}
              />
              {empSearchLoading && <div style={{ position: "absolute", right: 10, top: 28, fontSize: 11, color: "var(--g66-muted)" }}>Buscando...</div>}
              {empSearchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--g66-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 300, maxHeight: 220, overflowY: "auto" }}>
                  {empSearchResults.map((emp, i) => (
                    <button key={i} onClick={() => !Boolean(emp.already_in_period) && selectEmpFromSearch(emp)}
                      disabled={Boolean(emp.already_in_period)}
                      style={{ width: "100%", display: "block", textAlign: "left", padding: "9px 14px", background: "none", border: "none", borderBottom: "1px solid var(--g66-border)", cursor: Boolean(emp.already_in_period) ? "not-allowed" : "pointer", fontSize: 13, opacity: Boolean(emp.already_in_period) ? 0.55 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--g66-blue-light)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{String(emp.nombre)}</span>
                        {Boolean(emp.already_in_period) && <span style={{ fontSize: 10, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 999, padding: "1px 6px" }}>Ya está</span>}
                        {emp.activo === 0 && <span style={{ fontSize: 10, color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 999, padding: "1px 6px" }}>Inactivo</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--g66-muted)" }}>
                        {String(emp.dni)} · {String(emp.cargo ?? "")} · {String(emp.pais ?? "")}
                        {emp.fecha_termino ? ` · término ${String(emp.fecha_termino).slice(0, 10)}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {newEmp.nombre && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#166534", marginBottom: 12 }}>✓ Datos cargados — revisá y completá lo necesario</div>}

            {/* Campos */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>DNI / RUT *</label>
                <input type="text" value={newEmp.dni} onChange={e => setNewEmp(n => ({ ...n, dni: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>NOMBRE *</label>
                <input type="text" value={newEmp.nombre} onChange={e => setNewEmp(n => ({ ...n, nombre: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>EMAIL GLOBAL66</label>
            <input type="email" value={newEmp.email_global} onChange={e => setNewEmp(n => ({ ...n, email_global: e.target.value }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CARGO</label>
                <input type="text" value={newEmp.cargo} onChange={e => setNewEmp(n => ({ ...n, cargo: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>ÁREA</label>
                <input type="text" value={newEmp.area} onChange={e => setNewEmp(n => ({ ...n, area: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CENTRO DE COSTO</label>
            <input type="text" value={newEmp.centro_costo} onChange={e => setNewEmp(n => ({ ...n, centro_costo: e.target.value }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>PAÍS</label>
                <input type="text" value={newEmp.pais} onChange={e => setNewEmp(n => ({ ...n, pais: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>MONEDA *</label>
                <select value={newEmp.moneda} onChange={e => setNewEmp(n => ({ ...n, moneda: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                  {["COP","PEN","CLP","ARS","USD","EUR","PAB"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>SUELDO BASE *</label>
            <input type="number" step="any" min={0} value={newEmp.sueldo_base}
              onChange={e => setNewEmp(n => ({ ...n, sueldo_base: parseFloat(e.target.value) || 0 }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>VARIACIÓN SALARIO BASE %</label>
            <input type="number" step="any" value={newEmp.variacion_salario_base}
              onChange={e => setNewEmp(n => ({ ...n, variacion_salario_base: parseFloat(e.target.value) || 0 }))}
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>FECHA INGRESO</label>
                <input type="date" value={newEmp.fecha_ingreso} onChange={e => setNewEmp(n => ({ ...n, fecha_ingreso: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>FECHA TÉRMINO</label>
                <input type="date" value={newEmp.fecha_termino} onChange={e => setNewEmp(n => ({ ...n, fecha_termino: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                {newEmp.fecha_termino && <div style={{ fontSize: 11, color: "#92400e", marginTop: 3 }}>Se pagará proporcional hasta el {newEmp.fecha_termino}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="es_arg" checked={newEmp.es_argentina}
                onChange={e => setNewEmp(n => ({ ...n, es_argentina: e.target.checked }))} />
              <label htmlFor="es_arg" style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Es Argentina (split ARS/USD)</label>
            </div>
            {newEmp.es_argentina && (
              <>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>MONTO ARS (en USD)</label>
                <input type="number" step="any" min={0} value={newEmp.monto_ars_usd}
                  onChange={e => setNewEmp(n => ({ ...n, monto_ars_usd: parseFloat(e.target.value) || 0 }))}
                  style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
              </>
            )}

            {/* Preferencia + Wallet */}
            <div style={{ borderTop: "1px solid var(--g66-border)", paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>PREFERENCIA DE PAGO</label>
              <select value={newEmp.preferencia_pago} onChange={e => setNewEmp(n => ({ ...n, preferencia_pago: e.target.value }))}
                style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, marginBottom: 10 }}>
                <option value="Banco">Banco</option>
                <option value="Wallet">Wallet</option>
              </select>
              {newEmp.preferencia_pago === "Wallet" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>CORREO WALLET</label>
                    <input type="email" value={newEmp.correo_wallet} onChange={e => setNewEmp(n => ({ ...n, correo_wallet: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>USUARIO WALLET</label>
                    <input type="text" value={newEmp.usuario_wallet} onChange={e => setNewEmp(n => ({ ...n, usuario_wallet: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
              {newEmp.preferencia_pago === "Banco" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>BANCO</label>
                    <input type="text" value={newEmp.banco} onChange={e => setNewEmp(n => ({ ...n, banco: e.target.value }))}
                      placeholder="Ej: BCP, Interbank, BBVA..."
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>TIPO DE CUENTA</label>
                    <input type="text" value={newEmp.tipo_cuenta} onChange={e => setNewEmp(n => ({ ...n, tipo_cuenta: e.target.value }))}
                      placeholder="Ahorros / Corriente"
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>NÚMERO DE CUENTA</label>
                    <input type="text" value={newEmp.numero_cuenta} onChange={e => setNewEmp(n => ({ ...n, numero_cuenta: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--g66-muted)", display: "block", marginBottom: 3 }}>OBSERVACIONES</label>
            <textarea value={newEmp.observaciones} onChange={e => setNewEmp(n => ({ ...n, observaciones: e.target.value }))}
              rows={2} placeholder="Opcional..."
              style={{ width: "100%", border: "1px solid var(--g66-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box", resize: "vertical", marginBottom: 10, fontFamily: "inherit" }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowAddEmp(false)} style={{ background: "none", border: "1px solid var(--g66-border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={addEmployee} disabled={addingEmp || !newEmp.dni.trim() || !newEmp.nombre.trim()} style={{ background: addingEmp || !newEmp.dni.trim() || !newEmp.nombre.trim() ? "var(--g66-border)" : "var(--g66-blue)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: addingEmp ? "default" : "pointer" }}>
                {addingEmp ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
