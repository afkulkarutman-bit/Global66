import { NextRequest, NextResponse } from 'next/server';
import { supabasePayroll as supabaseAdmin } from '@/lib/supabase/payroll';
import * as XLSX from 'xlsx';

// ── Real-file column layout (verified from actual Excel) ─────────────────
// CX headers: ["CX RET", "DNI", "Área", "Mes t-1", "Diferencia t-2", "Total", "Moneda", "Bruto", "Mes"]
//   nombre=0, dni=1, moneda=6, monto_bruto=7, mes=8
// B2B headers: ["DNI","B2B","Cargo","Mes t-1","Mes t+0","Competencia","Total","Moneda","arch","Asegurado","Bruto","Mes","Column1"]
//   dni=0, nombre=1, moneda=7, monto_bruto=10, mes=11

const CX_FALLBACK:  Record<string, number> = { nombre: 0, dni: 1, moneda: 6, monto_bruto: 7, mes: 8 };
const B2B_FALLBACK: Record<string, number> = { dni: 0, nombre: 1, moneda: 7, monto_bruto: 10, mes: 11 };

// ── Header-based detection (exact patterns to avoid "Mes t-1" matching "mes") ──
type FieldDef = { field: string; patterns: RegExp[] };

const CX_FIELDS: FieldDef[] = [
  { field: 'nombre',      patterns: [/^nombre$/i, /^colaborador$/i, /^empleado$/i, /^name$/i] },
  { field: 'dni',         patterns: [/^dni$/i, /^rut$/i, /^cc$/i, /^c[eé]dula$/i] },
  { field: 'monto_bruto', patterns: [/^bruto$/i, /^monto bruto$/i] },
  { field: 'moneda',      patterns: [/^moneda$/i, /^currency$/i] },
  { field: 'mes',         patterns: [/^mes$/i, /^month$/i] },
];

const B2B_FIELDS: FieldDef[] = [
  { field: 'dni',         patterns: [/^dni$/i, /^rut$/i, /^cc$/i, /^c[eé]dula$/i] },
  { field: 'nombre',      patterns: [/^nombre$/i, /^colaborador$/i, /^empleado$/i, /^name$/i] },
  { field: 'monto_bruto', patterns: [/^bruto$/i, /^monto bruto$/i] },
  { field: 'moneda',      patterns: [/^moneda$/i, /^currency$/i] },
  { field: 'mes',         patterns: [/^mes$/i, /^month$/i] },
];

function detectHeaders(
  rows: unknown[][],
  fields: FieldDef[],
  fallback: Record<string, number>,
  maxScanRows = 5,
): { map: Record<string, number>; dataStart: number } {
  for (let r = 0; r < Math.min(maxScanRows, rows.length); r++) {
    const row = rows[r] as (string | null)[];
    const detected: Record<string, number> = {};

    for (const fd of fields) {
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] ?? '').trim();
        if (fd.patterns.some(p => p.test(cell))) {
          detected[fd.field] = c;
          break;
        }
      }
    }

    // Only accept this row as headers if we found at least dni AND monto_bruto
    if ('dni' in detected && 'monto_bruto' in detected) {
      // Merge: fallback provides defaults for fields not found in headers (e.g. "CX RET" for nombre)
      return { map: { ...fallback, ...detected }, dataStart: r + 1 };
    }
  }

  // No header row found → use fallback as-is
  return { map: fallback, dataStart: 1 };
}

function parseNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s || s === '-' || s === '-' || /^-+$/.test(s)) return 0;
  // Detect European format: "1.200.000" or "1.200,50"
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let n = s;
  if (dots > 1) n = s.replace(/\./g, '').replace(',', '.');       // "1.200.000" → "1200000"
  else if (commas > 1) n = s.replace(/,/g, '');                   // "1,200,000" → "1200000"
  else if (dots === 1 && commas === 1) {
    n = s.indexOf('.') < s.indexOf(',')
      ? s.replace(/\./g, '').replace(',', '.')                    // "1.200,50" → "1200.50"
      : s.replace(',', '');                                        // "1,200.50" → "1200.50"
  }
  return parseFloat(n) || 0;
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  tipo: string,
  fields: FieldDef[],
  fallback: Record<string, number>,
) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const { map, dataStart } = detectHeaders(rawRows, fields, fallback);

  const rows: Record<string, unknown>[] = [];
  for (let i = dataStart; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    const dni = row[map['dni']];
    if (!dni) continue;
    const monto = parseNumber(row[map['monto_bruto']]);
    if (monto === 0) continue;

    rows.push({
      tipo,
      dni: String(dni).trim(),
      nombre: String(row[map['nombre']] ?? '').trim(),
      monto_bruto: monto,
      moneda: String(row[map['moneda']] ?? '').trim(),
      mes: String(row[map['mes']] ?? '').trim(),
    });
  }

  const usedHeaders = JSON.stringify(map) !== JSON.stringify(fallback);
  return { rows, usedHeaders, map };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const periodId = formData.get('period_id') as string;
  const tipo = formData.get('tipo') as 'CX' | 'B2B';
  const file = formData.get('file') as File;

  if (!periodId || !tipo || !file) {
    return NextResponse.json({ error: 'period_id, tipo y file son requeridos' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // Pick the right sheet: prefer "actual" over "pasado" for same tipo
  const sheetName =
    wb.SheetNames.find(n => n.toLowerCase().includes(tipo.toLowerCase()) && n.toLowerCase().includes('actual')) ??
    wb.SheetNames.find(n => n.toLowerCase().includes(tipo.toLowerCase())) ??
    wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  const fields  = tipo === 'CX' ? CX_FIELDS  : B2B_FIELDS;
  const fallback = tipo === 'CX' ? CX_FALLBACK : B2B_FALLBACK;
  const { rows, usedHeaders, map } = parseSheet(sheet, tipo, fields, fallback);

  if (rows.length === 0) {
    return NextResponse.json({
      error: `No se encontraron filas con datos en "${sheetName}". Verificá que el archivo tenga la hoja correcta y montos distintos de cero.`,
      sheet: sheetName, usedHeaders, map,
    }, { status: 400 });
  }

  await supabaseAdmin.from('payroll_commissions').delete().eq('period_id', periodId).eq('tipo', tipo);

  const { error } = await supabaseAdmin.from('payroll_commissions').insert(
    rows.map(r => ({ ...r, period_id: periodId }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    inserted: rows.length,
    sheet: sheetName,
    usedHeaders,
    preview: rows.slice(0, 5),
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id');
  const tipo = searchParams.get('tipo');

  if (!periodId) return NextResponse.json({ error: 'period_id requerido' }, { status: 400 });

  let query = supabaseAdmin.from('payroll_commissions').select('*').eq('period_id', periodId);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { period_id, tipo, dni, nombre, monto_bruto, moneda, mes } = body;

  if (!period_id || !tipo || !dni || !nombre) {
    return NextResponse.json({ error: 'period_id, tipo, dni y nombre son requeridos' }, { status: 400 });
  }
  if (tipo !== 'CX' && tipo !== 'B2B') {
    return NextResponse.json({ error: 'tipo debe ser CX o B2B' }, { status: 400 });
  }

  const monto = Number(monto_bruto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'monto_bruto debe ser mayor a cero' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('payroll_commissions')
    .insert({
      period_id,
      tipo,
      dni: String(dni).trim(),
      nombre: String(nombre).trim(),
      monto_bruto: monto,
      moneda: String(moneda || 'USD').trim(),
      mes: String(mes || '').trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('payroll_commissions')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
