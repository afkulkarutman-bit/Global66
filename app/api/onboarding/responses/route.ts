import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const pais = searchParams.get('pais')?.trim() ?? '';
  const activo = searchParams.get('activo')?.trim() ?? '';

  let query = supabaseAdmin
    .from('employees')
    .select('*')
    .or('onboarding_completado.eq.1,onboarding_fecha.not.is.null');

  if (search) {
    query = query.or([
      `nombre.ilike.%${search}%`,
      `dni.ilike.%${search}%`,
      `email_personal.ilike.%${search}%`,
      `email_global.ilike.%${search}%`,
      `cargo.ilike.%${search}%`,
    ].join(','));
  }

  if (pais) query = query.eq('pais', pais);
  if (activo === '1' || activo === '0') query = query.eq('activo', Number(activo));

  const { data, error } = await query
    .order('onboarding_fecha', { ascending: false, nullsFirst: false })
    .order('nombre', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    responses: data ?? [],
    total: data?.length ?? 0,
  });
}
