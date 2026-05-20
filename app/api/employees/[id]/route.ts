import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabasePayroll } from '@/lib/supabase/payroll';

async function syncPayrollTermination(employee: { dni?: string | null; activo?: number | null; fecha_termino?: string | null }) {
  const dni = String(employee.dni ?? '').trim();
  if (!dni) return;

  const fechaTermino = employee.activo === 0 ? String(employee.fecha_termino ?? '').trim() : '';
  if (!fechaTermino || fechaTermino === 'NA') {
    await supabasePayroll
      .from('payroll_employees')
      .update({ fecha_termino: null })
      .eq('dni', dni);
    return;
  }

  const { data: periods } = await supabasePayroll
    .from('payroll_periods')
    .select('id,fecha_inicio,fecha_fin')
    .lte('fecha_inicio', fechaTermino)
    .gte('fecha_fin', fechaTermino);

  const periodIds = (periods ?? []).map(p => p.id);
  if (periodIds.length === 0) return;

  await supabasePayroll
    .from('payroll_employees')
    .update({ fecha_termino: fechaTermino })
    .eq('dni', dni)
    .in('period_id', periodIds);
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from('employees').select('*').eq('id', parseInt(id)).single();
  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { data: existing } = await supabaseAdmin.from('employees').select('id').eq('id', parseInt(id)).single();
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const cleanDni = String(body.dni || '').trim().replace(/\./g, '');
  if (!cleanDni) return NextResponse.json({ error: 'dni es requerido' }, { status: 400 });

  const { data: duplicate } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('dni', cleanDni)
    .neq('id', parseInt(id))
    .single();
  if (duplicate) return NextResponse.json({ error: 'Ya existe otro empleado con ese DNI' }, { status: 409 });

  const { data: employee, error } = await supabaseAdmin.from('employees').update({
    dni: cleanDni,
    nombre: body.nombre,
    activo: body.activo ? 1 : 0,
    cargo: body.cargo || 'NA',
    sexo: body.sexo || 'NA',
    salario_bruto: body.salario_bruto || null,
    area: body.area || 'NA',
    centro_costo: body.centro_costo || 'NA',
    pais: body.pais || 'NA',
    moneda: body.moneda || 'NA',
    sueldo_local: body.sueldo_local || null,
    domicilio: body.domicilio || 'NA',
    fecha_ingreso: body.fecha_ingreso || 'NA',
    tipo_contrato: body.tipo_contrato || 'NA',
    jefatura: body.jefatura || 'NA',
    email_global: body.email_global || 'NA',
    email_personal: body.email_personal || 'NA',
    usuario_wallet: body.usuario_wallet || null,
    presencialidad: body.presencialidad || '4x1',
    fecha_termino: body.activo ? null : (body.fecha_termino || null),
    updated_at: new Date().toISOString(),
  }).eq('id', parseInt(id)).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncPayrollTermination(employee);
  return NextResponse.json(employee);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { data: existing } = await supabaseAdmin.from('employees').select('id,activo').eq('id', parseInt(id)).single();
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const newActivo = typeof body.activo === 'boolean' ? (body.activo ? 1 : 0) : (existing.activo === 1 ? 0 : 1);
  const today = new Date().toISOString().split('T')[0];
  const fechaTermino = newActivo === 0 ? today : null;

  const { data: employee, error } = await supabaseAdmin.from('employees').update({
    activo: newActivo,
    fecha_termino: fechaTermino,
    updated_at: new Date().toISOString(),
  }).eq('id', parseInt(id)).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncPayrollTermination(employee);
  return NextResponse.json(employee);
}
