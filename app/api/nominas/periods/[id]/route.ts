import { NextRequest, NextResponse } from 'next/server';
import { supabasePayroll as supabaseAdmin } from '@/lib/supabase/payroll';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('payroll_periods')
    .select('*, payroll_params(*), payroll_commissions(*)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Update period fields (fecha_inicio, fecha_fin, status)
  if (body.period) {
    const { error } = await supabaseAdmin
      .from('payroll_periods')
      .update(body.period)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update individual param rows
  if (body.params && Array.isArray(body.params)) {
    for (const p of body.params) {
      const { error } = await supabaseAdmin
        .from('payroll_params')
        .update({ tdc_usd: p.tdc_usd, retencion: p.retencion })
        .eq('id', p.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Only allow deleting drafts
  const { data: period } = await supabaseAdmin.from('payroll_periods').select('status').eq('id', id).single();
  if (period?.status === 'cerrado') {
    return NextResponse.json({ error: 'No se puede eliminar un período cerrado' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('payroll_periods').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
