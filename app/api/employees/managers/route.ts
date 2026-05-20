import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('nombre,email_global')
    .eq('activo', 1)
    .not('email_global', 'is', null)
    .neq('email_global', 'NA')
    .neq('email_global', '')
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
