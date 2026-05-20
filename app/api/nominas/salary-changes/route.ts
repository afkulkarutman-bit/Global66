import { NextRequest, NextResponse } from 'next/server';
import { supabasePayroll as supabaseAdmin } from '@/lib/supabase/payroll';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id')?.trim();

  let query = supabaseAdmin
    .from('payroll_salary_changes')
    .select('*')
    .order('created_at', { ascending: false });

  if (periodId) query = query.eq('period_id', periodId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    period_id,
    payroll_employee_id,
    dni,
    nombre,
    pais,
    cargo,
    moneda,
    old_base,
    new_base,
    comment,
  } = body;

  if (!period_id || !payroll_employee_id || !dni || !nombre || !moneda) {
    return NextResponse.json({ error: 'period_id, payroll_employee_id, dni, nombre y moneda son requeridos' }, { status: 400 });
  }

  const oldBase = Number(old_base) || 0;
  const newBase = Number(new_base) || 0;
  const diff = newBase - oldBase;
  const pct = oldBase > 0 ? diff / oldBase : 0;

  const { data, error } = await supabaseAdmin
    .from('payroll_salary_changes')
    .insert({
      period_id,
      payroll_employee_id,
      dni: String(dni).trim(),
      nombre,
      pais: pais || null,
      cargo: cargo || null,
      moneda,
      old_base: oldBase,
      new_base: newBase,
      diff_amount: diff,
      diff_pct: pct,
      comment: comment || null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, new_base, comment } = body;
  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('payroll_salary_changes')
    .select('*')
    .eq('id', id)
    .single();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const oldBase = Number(existing.old_base) || 0;
  const newBase = Number(new_base) || 0;
  if (!Number.isFinite(newBase) || newBase <= 0) {
    return NextResponse.json({ error: 'new_base debe ser mayor a 0' }, { status: 400 });
  }
  const diff = newBase - oldBase;
  const pct = oldBase > 0 ? diff / oldBase : 0;

  const { data, error } = await supabaseAdmin
    .from('payroll_salary_changes')
    .update({
      new_base: newBase,
      diff_amount: diff,
      diff_pct: pct,
      comment: comment || null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.payroll_employee_id) {
    const { error: payrollError } = await supabaseAdmin
      .from('payroll_employees')
      .update({ sueldo_base: newBase })
      .eq('id', existing.payroll_employee_id);
    if (payrollError) return NextResponse.json({ error: payrollError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id, revert = true } = body;
  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('payroll_salary_changes')
    .select('*')
    .eq('id', id)
    .single();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  if (revert && existing.payroll_employee_id) {
    const { error: payrollError } = await supabaseAdmin
      .from('payroll_employees')
      .update({ sueldo_base: Number(existing.old_base) || 0 })
      .eq('id', existing.payroll_employee_id);
    if (payrollError) return NextResponse.json({ error: payrollError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('payroll_salary_changes')
    .delete()
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reverted_to: revert ? existing.old_base : null, payroll_employee_id: existing.payroll_employee_id });
}
