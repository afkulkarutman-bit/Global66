import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const FIELDS = 'dni,nombre,email_global,cargo,area,centro_costo,pais,moneda,sueldo_local,fecha_ingreso,fecha_termino,usuario_wallet,banco,tipo_cuenta,numero_cuenta,activo';

function tokenVariants(token: string): string[] {
  const variants = new Set([token]);
  const accentMap: Record<string, string[]> = {
    a: ['á'],
    e: ['é'],
    i: ['í'],
    o: ['ó'],
    u: ['ú'],
    n: ['ñ'],
  };
  const lower = token.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const accents = accentMap[lower[i]];
    if (!accents) continue;
    for (const accent of accents) {
      variants.add(token.slice(0, i) + accent + token.slice(i + 1));
    }
  }
  return [...variants];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const periodId = searchParams.get('period_id')?.trim() ?? '';
  const target = searchParams.get('target')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);
  const tokens = q.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2).slice(0, 5);
  const searchTokens = [...new Set(tokens.flatMap(tokenVariants))].slice(0, 20);

  let periodStart: string | null = null;
  let existingDnis = new Set<string>();

  if (periodId) {
    const { data: period, error: periodError } = await supabaseAdmin
      .from('payroll_periods')
      .select('fecha_inicio')
      .eq('id', periodId)
      .single();
    if (periodError) return NextResponse.json({ error: periodError.message }, { status: 500 });
    periodStart = period?.fecha_inicio ?? null;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('payroll_employees')
      .select('dni')
      .eq('period_id', periodId);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    existingDnis = new Set((existing ?? []).map(r => String(r.dni ?? '').trim().toUpperCase()));
  }

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select(FIELDS)
    .or(searchTokens.flatMap(t => [`nombre.ilike.%${t}%`, `dni.ilike.%${t}%`]).join(','))
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? [])
    .filter(emp => {
      const pais = String(emp.pais ?? '').trim().toLowerCase();
      if (target === 'argentina' && pais !== 'argentina') return false;
      if (target === 'sin_arg' && pais === 'argentina') return false;

      const fechaTermino = emp.fecha_termino ? String(emp.fecha_termino).slice(0, 10) : '';
      if (periodStart && fechaTermino && fechaTermino < periodStart) return false;
      return true;
    })
    .map(emp => ({
      ...emp,
      already_in_period: existingDnis.has(String(emp.dni ?? '').trim().toUpperCase()),
    }))
    .sort((a, b) => {
      if (a.already_in_period !== b.already_in_period) return a.already_in_period ? 1 : -1;
      const fechaDiff = String(b.fecha_ingreso ?? '').localeCompare(String(a.fecha_ingreso ?? ''));
      if (fechaDiff !== 0) return fechaDiff;
      if ((a.activo ?? 0) !== (b.activo ?? 0)) return (b.activo ?? 0) - (a.activo ?? 0);
      return String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es');
    })
    .slice(0, 20);

  return NextResponse.json(rows);
}
