import fs from 'fs';
import path from 'path';
import process from 'process';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EXCEL_PATH = '/Users/alan.kulka/Downloads/Copia de [Confidencial] Diciembre 2025 - Repositorio Contratos People Global66.xlsx';
const CANONICAL_SHEET = 'Inactivos';
const ACTIVE_SHEET = 'Doc 9-12';
const EXPECTED = { active: 406, inactive: 66, total: 472 };

const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const excelPathArg = process.argv.find((arg) => arg.startsWith('--file='));
const excelPath = excelPathArg ? excelPathArg.slice('--file='.length) : DEFAULT_EXCEL_PATH;

function readEnv(filePath) {
  const envPath = path.resolve(filePath);
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return out;
}

function clean(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '#REF!' || text === '#N/A') return '';
  return text;
}

function nullableText(value) {
  const text = clean(value);
  return text || null;
}

function textOrNA(value) {
  return clean(value) || 'NA';
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = clean(value);
  if (!text || text === '-') return null;
  const normalized = text.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }

  const text = clean(value);
  if (!text || text === 'NA') return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

function monedaForCountry(country) {
  const pais = clean(country).toLowerCase();
  if (pais === 'chile') return 'CLP';
  if (pais === 'colombia') return 'COP';
  if (pais === 'perú' || pais === 'peru') return 'PEN';
  if (pais === 'españa' || pais === 'espana') return 'EUR';
  if (pais === 'argentina' || pais === 'panamá' || pais === 'panama' || pais === 'singapur') return 'USD';
  return 'NA';
}

function migrationDni(row) {
  const dni = clean(row.CI);
  if (dni) return dni;
  const email = clean(row.Correo || row.Correo_Personal).toLowerCase();
  if (email) return `PENDIENTE-CI:${email}`;
  const name = clean(row.Nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `PENDIENTE-CI:${name}`;
}

function mapRow(row) {
  const activeText = clean(row.Activo).toLowerCase();
  const active = activeText === 'si' || activeText === 'sí';
  const salary = parseNumber(row['Salario bruto actualizado'])
    ?? parseNumber(row.Monto_Sueldo)
    ?? parseNumber(row['Salario bruto']);
  const fechaBaja = parseDate(row['Fecha de baja']);
  const fechaTerminoContrato = parseDate(row['Fecha termino contrato']);

  return {
    dni: migrationDni(row),
    nombre: textOrNA(row.Nombre),
    activo: active ? 1 : 0,
    cargo: textOrNA(row['Cargo nuevo'] || row.Cargo),
    sexo: textOrNA(row.Sexo),
    salario_bruto: salary,
    area: textOrNA(row.Area),
    centro_costo: textOrNA(row['Centro de costo']),
    pais: textOrNA(row.Pais),
    moneda: monedaForCountry(row.Pais),
    sueldo_local: salary,
    domicilio: textOrNA(row.Domicilio),
    fecha_ingreso: parseDate(row['Fecha de inicio']) ?? parseDate(row.Fecha_Ingreso) ?? 'NA',
    fecha_termino: active ? null : (fechaBaja ?? fechaTerminoContrato),
    tipo_contrato: textOrNA(row['Tipo de Contrato']),
    jefatura: textOrNA(row.Jefatura),
    email_global: textOrNA(row.Correo),
    email_personal: textOrNA(row.Correo_Personal),
    nacionalidad: nullableText(row.Nacionalidad),
    fecha_nacimiento: parseDate(row['Fecha nac']) ?? parseDate(row.Fecha_Nacimiento),
    usuario_wallet: nullableText(row.Usuario_Wallet || row['Usuario Wallet']),
    updated_at: new Date().toISOString(),
  };
}

function loadSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No existe la hoja "${sheetName}"`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, blankrows: false })
    .filter((row) => clean(row.Activo) && clean(row.Nombre));
}

function summarize(rows) {
  const active = rows.filter((row) => clean(row.Activo).toLowerCase() === 'si').length;
  const inactive = rows.filter((row) => clean(row.Activo).toLowerCase() === 'no').length;
  return { active, inactive, total: rows.length };
}

function assertSummary(label, actual, expected) {
  const mismatches = Object.entries(expected).filter(([key, value]) => actual[key] !== value);
  if (mismatches.length > 0) {
    throw new Error(`${label}: conteo inesperado ${JSON.stringify(actual)}; esperado ${JSON.stringify(expected)}`);
  }
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

const workbook = XLSX.readFile(excelPath, { cellDates: false });
const activeRows = loadSheet(workbook, ACTIVE_SHEET);
const canonicalRows = loadSheet(workbook, CANONICAL_SHEET);

assertSummary(ACTIVE_SHEET, summarize(activeRows), { active: EXPECTED.active, inactive: 0, total: EXPECTED.active });
assertSummary(CANONICAL_SHEET, summarize(canonicalRows), EXPECTED);

const records = canonicalRows.map(mapRow);
const byDni = new Map();
const duplicates = [];
for (const record of records) {
  if (byDni.has(record.dni)) duplicates.push(record.dni);
  byDni.set(record.dni, record);
}
if (duplicates.length > 0) throw new Error(`DNI duplicados en migración: ${duplicates.join(', ')}`);

const missingCi = canonicalRows
  .filter((row) => !clean(row.CI))
  .map((row) => ({
    dni_generado: migrationDni(row),
    activo: clean(row.Activo),
    nombre: clean(row.Nombre),
    correo: clean(row.Correo || row.Correo_Personal),
  }));

const report = {
  file: excelPath,
  commit,
  expected: EXPECTED,
  actual: summarize(canonicalRows),
  import_mode: 'upsert_by_dni_without_deleting_existing_rows',
  generated_at: new Date().toISOString(),
  rows_without_ci: missingCi,
};

fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), 'data', 'migration-report-employees.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(process.cwd(), 'data', 'employees-normalized-backup.json'),
  `${JSON.stringify(records, null, 2)}\n`,
);

console.log(`Planilla validada: ${records.length} empleados (${EXPECTED.active} activos, ${EXPECTED.inactive} inactivos).`);
console.log(`Filas sin CI: ${missingCi.length}. Ver data/migration-report-employees.json`);

if (!commit) {
  console.log('Dry run OK. Ejecuta con --commit para escribir en Supabase.');
  process.exit(0);
}

const env = readEnv('.env.local');
const url = process.env.PAYROLL_SUPABASE_URL || env.PAYROLL_SUPABASE_URL;
const key = process.env.PAYROLL_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  || env.PAYROLL_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Faltan PAYROLL_SUPABASE_URL y PAYROLL_SUPABASE_SERVICE_ROLE_KEY en .env.local');
}

const supabase = createClient(url, key);
let upserted = 0;
for (const part of chunk(records, 100)) {
  const { error } = await supabase
    .from('employees')
    .upsert(part, { onConflict: 'dni' });
  if (error) throw new Error(error.message);
  upserted += part.length;
}

const { count, error: countError } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true });
if (countError) throw new Error(countError.message);

const { data: statusRows, error: statusError } = await supabase
  .from('employees')
  .select('activo');
if (statusError) throw new Error(statusError.message);

const activeCount = (statusRows ?? []).filter((row) => row.activo === 1).length;
const inactiveCount = (statusRows ?? []).filter((row) => row.activo === 0).length;

console.log(`Upsert completado: ${upserted} filas.`);
console.log(`Supabase employees ahora: ${count} total, ${activeCount} activos, ${inactiveCount} inactivos.`);

if (count !== EXPECTED.total || activeCount !== EXPECTED.active || inactiveCount !== EXPECTED.inactive) {
  throw new Error('La verificación post-migración no coincide con los conteos esperados.');
}
