import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase/admin';

type AttendanceEmployee = {
  id: number;
  dni: string;
  nombre: string;
  email_global: string | null;
  pais: string | null;
  cargo: string | null;
  area: string | null;
  activo: number;
  presencialidad: string | null;
  fecha_ingreso: string | null;
  fecha_termino: string | null;
};

type AttendanceParsed = {
  dni: string;
  email: string;
  nameKey: string;
  nombre?: string;
  fecha: string;
};

type AttendanceIdentity = {
  dni: string;
  email: string;
  nombre: string;
};

type AttendanceAiReview = {
  status: 'ok' | 'warning' | 'error' | 'disabled';
  summary: string;
  findings: string[];
  generatedAt: string;
  error?: string | null;
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COUNTRY_CODES: Record<string, string> = {
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  peru: 'PE',
  perú: 'PE',
};
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

function normDoc(value: unknown) {
  return String(value ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function canonicalDni(value: unknown) {
  const raw = normDoc(value);
  if (!raw) return '';
  if (raw.length <= 1) return raw;
  return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
}

function normEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function nameKey(value: unknown) {
  return normText(value).replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();
}

function normText(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function excelSerialToIso(value: number) {
  const date = new Date(Math.round((value - 25569) * 86400 * 1000));
  return date.toISOString().slice(0, 10);
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return excelSerialToIso(value);

  const raw = String(value).trim();
  if (!raw || raw === '-') return null;

  const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const latin = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (latin) {
    const year = latin[3].length === 2 ? `20${latin[3]}` : latin[3];
    return `${year}-${latin[2].padStart(2, '0')}-${latin[1].padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function isBusinessDay(dateIso: string, holidays: Set<string>) {
  const day = new Date(`${dateIso}T12:00:00`).getDay();
  return day !== 0 && day !== 6 && !holidays.has(dateIso);
}

function businessDays(year: number, month: number, holidays: Set<string>) {
  const totalDays = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= totalDays; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isBusinessDay(iso, holidays)) count++;
  }
  return count;
}

function validDate(value: string | null | undefined) {
  if (!value || value === 'NA') return null;
  const raw = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return { start, end };
}

async function getPublicHolidays(country: string, year: number) {
  const countryCode = COUNTRY_CODES[normText(country)];
  if (!countryCode) return { holidays: [] as string[], error: `País sin código de feriados: ${country}` };

  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return { holidays: [] as string[], error: `No se pudieron obtener feriados (${res.status})` };
    const data = await res.json() as { date?: string; global?: boolean }[];
    return {
      holidays: data
        .filter(item => item.global !== false)
        .map(item => item.date)
        .filter((date): date is string => Boolean(date)),
      error: null as string | null,
    };
  } catch (error) {
    return {
      holidays: [] as string[],
      error: error instanceof Error ? error.message : 'No se pudieron obtener feriados',
    };
  }
}

function attendanceRatio(value: string | null | undefined) {
  const key = String(value ?? '4x1').trim().toLowerCase();
  const direct: Record<string, number> = {
    '5x0': 1,
    '4x1': 0.8,
    '3x2': 0.6,
    '2x3': 0.4,
    '1x4': 0.2,
    '0x5': 0,
    remoto: 0,
    presencial: 1,
    flexible: 0.8,
  };
  if (key in direct) return direct[key];
  const match = key.match(/^(\d)\s*x\s*(\d)$/);
  if (!match) return 0.8;
  const onsite = Number(match[1]);
  const remote = Number(match[2]);
  const total = onsite + remote;
  return total > 0 ? onsite / total : 0;
}

function getCell(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  for (const name of names) {
    const direct = row[name];
    if (direct !== undefined) return direct;
    const found = keys.find(k => normText(k) === normText(name));
    if (found) return row[found];
  }
  return undefined;
}

function worksheetToRows(worksheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: false, blankrows: false });
  const headerIndex = matrix.findIndex(row => {
    const values = row.map(value => normText(value));
    const hasDate = values.some(value => ['tiempo', 'llegada', 'report_date', 'fecha', 'date/time'].includes(value));
    const hasIdentity = values.some(value => ['dni', 'documento', 'documento / cedula', 'cedula residente', 'cedula residente', 'correo', 'email', 'customer_email', 'tarjeta / id', 'hotstamp', 'person id', 'first name'].includes(value));
    return hasDate && hasIdentity;
  });

  if (headerIndex === -1) {
    // raw: true preserves Date objects so parseDate handles them correctly
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null, raw: true });
  }

  const headers = matrix[headerIndex].map((value, index) => {
    const text = String(value ?? '').trim();
    return text || `__EMPTY_${index}`;
  });

  return matrix.slice(headerIndex + 1).map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });
    return obj;
  });
}

function buildIdentityMap(workbook: XLSX.WorkBook) {
  const identities = new Map<string, AttendanceIdentity>();
  const sheetName = workbook.SheetNames.find(name => normText(name).includes('usuario'));
  if (!sheetName) return identities;

  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: false, blankrows: false });
  const headerIndex = matrix.findIndex(row => {
    const values = row.map(value => normText(value));
    const hasId = values.includes('id') || values.includes('person id');
    const hasName = values.includes('nombre') || values.includes('first name');
    const hasIdentity = values.some(value => ['email', 'correo', 'documento / cedula', 'documento', 'dni'].includes(value));
    return hasId && hasName && hasIdentity;
  });
  if (headerIndex === -1) return identities;

  const headers = matrix[headerIndex].map((value, index) => {
    const text = String(value ?? '').trim();
    return text || `__EMPTY_${index}`;
  });
  const rows = matrix.slice(headerIndex + 1).map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });
    return obj;
  });

  for (const row of rows) {
    const id = String(getCell(row, ['ID', 'Person ID']) ?? '').trim();
    if (!id) continue;
    const firstName = String(getCell(row, ['Nombre', 'FIRST NAME']) ?? '').trim();
    const lastName = String(getCell(row, ['Apellido', 'LAST NAME']) ?? '').trim();
    const nombre = `${firstName} ${lastName}`.trim();
    identities.set(id, {
      dni: canonicalDni(getCell(row, ['Documento / Cédula', 'Documento', 'DNI', 'Cédula residente', 'Cedula residente'])),
      email: normEmail(getCell(row, ['Email', 'email', 'Correo', 'CUSTOMER_EMAIL'])),
      nombre,
    });
  }
  return identities;
}

function parseRows(rawRows: Record<string, unknown>[], country: string, identityById = new Map<string, AttendanceIdentity>()): AttendanceParsed[] {
  const countryKey = normText(country);
  const out: AttendanceParsed[] = [];

  if (countryKey === 'argentina') {
    let headerIndex = -1;
    let headers: Record<string, string> = {};
    for (let i = 0; i < rawRows.length; i++) {
      const entries = Object.entries(rawRows[i]);
      const values = entries.map(([, v]) => String(v ?? '').trim());
      if (values.some(v => normText(v) === 'sentido')) {
        headerIndex = i;
        headers = Object.fromEntries(entries.map(([key, val]) => [normText(val), key]));
        break;
      }
    }

    const rows = headerIndex >= 0 ? rawRows.slice(headerIndex + 1) : rawRows;
    for (const row of rows) {
      const dni = canonicalDni(row[headers[normText('Tarjeta / ID')]] ?? getCell(row, ['Tarjeta / ID', 'DNI', 'Documento']));
      const email = normEmail(getCell(row, ['Email', 'email', 'Correo']));
      const sentido = String(row[headers[normText('Sentido')]] ?? getCell(row, ['Sentido']) ?? '').trim();
      if (sentido && !['entrada', 'salida'].includes(normText(sentido))) continue;
      const fecha = parseDate(row[headers[normText('Fecha')]] ?? getCell(row, ['Fecha', 'Tiempo', 'Llegada']));
      const nombreRaw = row[headers[normText('Nombre / Descripción del evento')]] ?? getCell(row, ['Nombre / Descripción del evento', 'Nombre']);
      const nombre = String(nombreRaw ?? '').replace(/\(\d+\)/, '').trim();
      if ((dni || email || nombre) && fecha) out.push({ dni, email, nameKey: nameKey(nombre), fecha, nombre });
    }
    return out;
  }

  for (const row of rawRows) {
    const id = String(getCell(row, ['ID', 'Person ID']) ?? '').trim();
    const identity = id ? identityById.get(id) : undefined;
    const docSource = getCell(row, [
      'Documento',
      'Documento / Cédula',
      'DNI',
      'Cédula residente',
      'Cedula residente',
      'Tarjeta / ID',
    ]);
    const emailSource = getCell(row, ['email', 'Email', 'Correo', 'CUSTOMER_EMAIL']);
    const dni = identity?.dni || canonicalDni(docSource);
    const email = identity?.email || normEmail(emailSource);
    const firstName = String(getCell(row, ['FIRST NAME']) ?? '').trim();
    const lastName = String(getCell(row, ['LAST NAME']) ?? '').trim();
    const nombreRaw = String(getCell(row, ['Nombre residente', 'Nombre', 'CUSTOMER_NAME']) ?? '').trim();
    const apellidoRaw = String(getCell(row, ['Apellido', 'LAST NAME']) ?? '').trim();
    let nombre = identity?.nombre || `${nombreRaw || firstName} ${apellidoRaw || lastName}`.trim();
    // Format: "123456(Full Name)" or "123456(Full Name" (truncated) — access control systems (e.g. Peru)
    if (!nombre) {
      const userCell = String(getCell(row, ['User']) ?? '').trim();
      const userMatch = userCell.match(/^\d+\((.+?)\)?$/);
      if (userMatch) nombre = userMatch[1].trim();
    }
    const type = String(getCell(row, ['TYPE']) ?? '').trim();
    if (type && normText(type) !== 'access granted') continue;
    const fecha = parseDate(getCell(row, ['Tiempo', 'Llegada', 'REPORT_DATE', 'Fecha', 'Date', 'DATE/TIME']));
    if ((dni || email || nombre) && fecha) out.push({ dni, email, nameKey: nameKey(nombre), fecha, nombre });
  }
  return out;
}

function parseGeminiJson(text: string): { status?: string; summary?: string; findings?: unknown } | null {
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function generateAiReview({
  summary,
  rows,
  unmatched,
}: {
  summary: Record<string, unknown>;
  rows: Array<{
    nombre: string;
    dni: string;
    pais: string | null;
    cargo: string | null;
    area: string | null;
    presencialidad: string;
    dias_esperados: number;
    dias_asistidos: number;
    porcentaje_requerido?: number;
    porcentaje_cumplimiento?: number | null;
    porcentaje_asistencia: number | null;
    estado: string;
    alertas: string[];
  }>;
  unmatched: Array<{
    dni: string;
    email: string;
    name_key: string;
    match_key: string;
    nombre_excel: string;
    dias_asistidos: number;
  }>;
}): Promise<AttendanceAiReview> {
  const generatedAt = new Date().toISOString();
  if (!GEMINI_URL) {
    return {
      status: 'disabled',
      summary: 'Revisión IA no ejecutada porque falta GEMINI_API_KEY.',
      findings: [],
      generatedAt,
    };
  }

  const rowsForReview = rows
    .filter(row => row.estado !== 'Cumple' || row.alertas.length > 0)
    .slice(0, 80)
    .map(row => ({
      nombre: row.nombre,
      dni: row.dni,
      pais: row.pais,
      cargo: row.cargo,
      area: row.area,
      presencialidad: row.presencialidad,
      dias_esperados: row.dias_esperados,
      dias_asistidos: row.dias_asistidos,
      porcentaje_requerido: row.porcentaje_requerido,
      porcentaje_cumplimiento: row.porcentaje_cumplimiento,
      porcentaje_asistencia: row.porcentaje_asistencia,
      estado: row.estado,
      alertas: row.alertas,
    }));

  const unmatchedForReview = unmatched.slice(0, 60).map(item => ({
    dni: item.dni,
    email: item.email,
    name_key: item.name_key,
    match_key: item.match_key,
    nombre_excel: item.nombre_excel,
    dias_asistidos: item.dias_asistidos,
  }));

  const systemText = `Eres auditor de reportes de asistencia de Global66 People.
El cálculo ya fue hecho por código y NO debes recalcular ni cambiar estados.
Tu tarea es revisar si hay señales raras, datos incompletos o cosas que RRHH debería mirar antes de cerrar el reporte.
Responde SOLO JSON válido con esta forma:
{"status":"ok|warning|error","summary":"texto breve","findings":["hallazgo concreto 1","hallazgo concreto 2"]}
Usa español, directo, sin markdown. Si no ves riesgos, status ok y findings vacío.`;

  const userText = JSON.stringify({
    summary,
    reglas: {
      cruce: 'DNI/email/nombre solo si no hay identificador',
      dias_unicos: 'multiples accesos en un dia cuentan como 1',
      porcentaje_asistencia: 'dias asistidos dividido por dias habiles del mes',
      cumplimiento: 'cumple si dias asistidos alcanza el minimo segun presencialidad',
      estados: 'Cumple/Revisar/No cumple/No aplica ya vienen calculados por codigo',
    },
    filas_revisar: rowsForReview,
    accesos_sin_match: unmatchedForReview,
  });

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        summary: 'No se pudo ejecutar la revisión IA.',
        findings: [],
        generatedAt,
        error: data.error?.message ?? 'Error de Gemini',
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseGeminiJson(text);
    const status = parsed?.status === 'ok' || parsed?.status === 'warning' || parsed?.status === 'error'
      ? parsed.status
      : 'warning';
    const findings = Array.isArray(parsed?.findings)
      ? parsed.findings.map(item => String(item)).filter(Boolean).slice(0, 12)
      : [];

    return {
      status,
      summary: parsed?.summary ? String(parsed.summary) : 'Revisión IA generada, pero la respuesta no trajo resumen estructurado.',
      findings,
      generatedAt,
    };
  } catch (error) {
    return {
      status: 'error',
      summary: 'No se pudo ejecutar la revisión IA.',
      findings: [],
      generatedAt,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  const country = String(form.get('country') ?? '').trim();
  const year = Number(form.get('year'));
  const month = Number(form.get('month'));

  if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  if (!country || !year || !month) return NextResponse.json({ error: 'País, año y mes son requeridos' }, { status: 400 });

  const holidayResult = await getPublicHolidays(country, year);
  const holidays = new Set(holidayResult.holidays);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheetName = workbook.SheetNames.find(s => normText(s).includes(normText(country))) ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const identityById = buildIdentityMap(workbook);
  const rawRows = worksheetToRows(worksheet);
  const parsed = parseRows(rawRows, country, identityById).filter(row => {
    const [rowYear, rowMonth] = row.fecha.split('-').map(Number);
    return rowYear === year && rowMonth === month && isBusinessDay(row.fecha, holidays);
  });

  const datesByKey = new Map<string, Set<string>>();
  const nameByKey = new Map<string, string>();
  const excelIdentityByKey = new Map<string, { dni: string; email: string; nameKey: string }>();
  for (const row of parsed) {
    const keys = [row.dni ? `dni:${row.dni}` : '', row.email ? `email:${row.email}` : '', row.nameKey ? `name:${row.nameKey}` : ''].filter(Boolean);
    for (const key of keys) {
      if (!datesByKey.has(key)) datesByKey.set(key, new Set<string>());
      datesByKey.get(key)!.add(row.fecha);
      if (row.nombre && !nameByKey.has(key)) nameByKey.set(key, row.nombre);
      if (!excelIdentityByKey.has(key)) excelIdentityByKey.set(key, { dni: row.dni, email: row.email, nameKey: row.nameKey });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id,dni,nombre,email_global,pais,cargo,area,activo,presencialidad,fecha_ingreso,fecha_termino')
    .eq('pais', country)
    .eq('activo', 1)
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { start: monthStart, end: monthEnd } = monthBounds(year, month);
  const employees = ((data ?? []) as AttendanceEmployee[]).filter(emp => {
    const ingreso = validDate(emp.fecha_ingreso);
    const termino = validDate(emp.fecha_termino);
    if (ingreso && ingreso > monthEnd) return false;
    if (termino && termino < monthStart) return false;
    return true;
  });
  const employeeKeys = new Set<string>();
  const nameKeyToEmployeeId = new Map<string, number>();
  const fuzzyMatchKeys = new Set<string>();
  const parsedNameKeys = [...datesByKey.keys()]
    .filter(key => key.startsWith('name:'))
    .map(key => key.slice(5));

  for (const parsedKey of parsedNameKeys) {
    const tokens = parsedKey.split(' ').filter(Boolean);
    if (tokens.length < 2) continue;
    const matches = employees.filter(emp => {
      const employeeName = nameKey(emp.nombre);
      return tokens.every(token => employeeName.includes(token));
    });
    if (matches.length === 1) {
      nameKeyToEmployeeId.set(parsedKey, matches[0].id);
      continue;
    }
    // Fuzzy pass: allow 1 token mismatch when name has 3+ tokens and match is unique
    if (matches.length === 0 && tokens.length >= 3) {
      const fuzzy = employees.filter(emp => {
        const employeeName = nameKey(emp.nombre);
        const matched = tokens.filter(t => employeeName.includes(t)).length;
        return matched >= tokens.length - 1 && matched >= 2;
      });
      if (fuzzy.length === 1) {
        nameKeyToEmployeeId.set(parsedKey, fuzzy[0].id);
        fuzzyMatchKeys.add(parsedKey);
      }
    }
  }

  for (const emp of employees) {
    const dni = canonicalDni(emp.dni);
    const email = normEmail(emp.email_global);
    if (dni) employeeKeys.add(`dni:${dni}`);
    if (email) employeeKeys.add(`email:${email}`);
    for (const [parsedKey, employeeId] of nameKeyToEmployeeId.entries()) {
      if (employeeId === emp.id) employeeKeys.add(`name:${parsedKey}`);
    }
  }
  const monthBusinessDays = businessDays(year, month, holidays);

  const rows = employees.map(emp => {
    const dni = canonicalDni(emp.dni);
    const email = normEmail(emp.email_global);
    const hasDniAccess = Boolean(dni && datesByKey.has(`dni:${dni}`));
    const hasEmailAccess = Boolean(email && datesByKey.has(`email:${email}`));
    const mergedDates = new Set<string>();
    for (const date of datesByKey.get(`dni:${dni}`) ?? []) mergedDates.add(date);
    if (email) {
      for (const date of datesByKey.get(`email:${email}`) ?? []) mergedDates.add(date);
    }
    for (const [parsedKey, employeeId] of nameKeyToEmployeeId.entries()) {
      if (employeeId === emp.id) {
        for (const date of datesByKey.get(`name:${parsedKey}`) ?? []) mergedDates.add(date);
      }
    }
    const presentDates = [...mergedDates].sort();
    const ratio = attendanceRatio(emp.presencialidad);
    const expectedDays = Math.ceil(monthBusinessDays * ratio);
    const requiredPercent = Number((ratio * 100).toFixed(2));
    const percent = monthBusinessDays > 0 ? Number(((presentDates.length / monthBusinessDays) * 100).toFixed(2)) : null;
    const compliancePercent = expectedDays > 0 ? Number(((presentDates.length / expectedDays) * 100).toFixed(2)) : null;
    const alertas: string[] = [];
    if (!dni && !email) alertas.push('Empleado activo sin DNI ni email para cruzar asistencia');
    const reviewThreshold = Math.max(requiredPercent - 20, 0);
    if (expectedDays > 0 && presentDates.length === 0) alertas.push('Sin registros de asistencia encontrados en el Excel');
    if (expectedDays === 0 && presentDates.length > 0) alertas.push('Tiene presencialidad 0x5/remoto pero registra accesos');
    if (presentDates.length > 0 && !hasDniAccess && hasEmailAccess) alertas.push('Cruzado por email; revisar DNI si falta o no coincide');
    if (presentDates.length > 0 && !hasDniAccess && !hasEmailAccess) {
      const matchedByFuzzy = [...nameKeyToEmployeeId.entries()].some(([k, id]) => id === emp.id && fuzzyMatchKeys.has(k));
      if (matchedByFuzzy) {
        alertas.push('Cruzado por similitud de nombre (diferencia ortográfica); verificar que sea la persona correcta');
      } else {
        alertas.push('Cruzado por nombre; revisar identificador porque el Excel no trae DNI/email usable');
      }
    }
    if (presentDates.length > 0 && hasDniAccess && !hasEmailAccess && !email) alertas.push('Cruzado por DNI; empleado sin email global cargado');
    const estado = expectedDays === 0
      ? 'No aplica'
      : presentDates.length >= expectedDays
        ? 'Cumple'
        : percent !== null && percent >= reviewThreshold
          ? 'Revisar'
          : 'No cumple';
    if (estado === 'Revisar') {
      alertas.push(`Bajo el objetivo ${requiredPercent}%, pero dentro de banda de revisión (${reviewThreshold}% o más)`);
    }
    return {
      employee_id: emp.id,
      dni: emp.dni,
      nombre: emp.nombre,
      email_global: emp.email_global,
      pais: emp.pais,
      cargo: emp.cargo,
      area: emp.area,
      presencialidad: emp.presencialidad ?? '4x1',
      dias_habiles_mes: monthBusinessDays,
      dias_esperados: expectedDays,
      dias_asistidos: presentDates.length,
      porcentaje_requerido: requiredPercent,
      porcentaje_cumplimiento: compliancePercent,
      porcentaje_asistencia: percent,
      fechas: presentDates,
      estado,
      alertas,
    };
  });

  const unmatched = [...datesByKey.entries()]
    .filter(([key]) => !employeeKeys.has(key))
    .map(([key, dates]) => ({
      dni: excelIdentityByKey.get(key)?.dni ?? '',
      email: excelIdentityByKey.get(key)?.email ?? '',
      name_key: excelIdentityByKey.get(key)?.nameKey ?? '',
      match_key: key,
      nombre_excel: nameByKey.get(key) ?? '',
      dias_asistidos: dates.size,
      fechas: [...dates].sort(),
    }))
    .sort((a, b) => b.dias_asistidos - a.dias_asistidos);

  const summary = {
    country,
    year,
    month,
    mes: MONTHS[month - 1],
    sheetName,
    rawRows: rawRows.length,
    parsedRows: parsed.length,
    employees: rows.length,
    monthBusinessDays,
    holidays: [...holidays],
    holidaysSource: holidayResult.error ? 'fallback_empty' : 'Nager.Date',
    holidaysError: holidayResult.error,
    cumple: rows.filter(r => r.estado === 'Cumple').length,
    noCumple: rows.filter(r => r.estado === 'No cumple').length,
    revisar: rows.filter(r => r.estado === 'Revisar').length,
    noAplica: rows.filter(r => r.estado === 'No aplica').length,
    alertas: rows.reduce((sum, r) => sum + r.alertas.length, 0) + unmatched.length,
  };

  let saved = false;
  const reportId = crypto.randomUUID();
  const { error: insertError } = await supabaseAdmin.from('attendance_reports').insert({
    id: reportId,
    country,
    year,
    month,
    month_name: summary.mes,
    source_file: file.name,
    sheet_name: sheetName,
    business_days: monthBusinessDays,
    holidays: [...holidays],
    summary,
    rows,
    unmatched,
  });
  if (!insertError) saved = true;

  return NextResponse.json({
    reportId: saved ? reportId : null,
    saved,
    saveError: insertError?.message ?? null,
    summary,
    rows,
    unmatched,
    aiReview: null,
  });
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('attendance_reports')
    .select('id,country,year,month,month_name,source_file,sheet_name,business_days,summary,rows,unmatched,ai_review,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('attendance_reports')
    .select('id,summary,rows,unmatched')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const aiReview = await generateAiReview({
    summary: data.summary ?? {},
    rows: Array.isArray(data.rows) ? data.rows : [],
    unmatched: Array.isArray(data.unmatched) ? data.unmatched : [],
  });

  const { error: updateError } = await supabaseAdmin
    .from('attendance_reports')
    .update({ ai_review: aiReview })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ aiReview });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('attendance_reports')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
