import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activo = searchParams.get('activo');
  const search = searchParams.get('search') || '';
  const pais = searchParams.get('pais') || '';
  const area = searchParams.get('area') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = supabaseAdmin.from('employees').select('*', { count: 'exact' });

  if (activo === '1' || activo === '0') query = query.eq('activo', parseInt(activo));
  if (search) query = query.or(`nombre.ilike.%${search}%,dni.ilike.%${search}%,cargo.ilike.%${search}%,email_global.ilike.%${search}%`);
  if (pais) query = query.eq('pais', pais);
  if (area) query = query.eq('area', area);

  if (activo === '0') {
    query = query.order('fecha_termino', { ascending: false, nullsFirst: false }).order('nombre');
  } else {
    query = query.order('nombre');
  }
  query = query.range(offset, offset + limit - 1);

  const { data: employees, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ employees, total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.dni || !body.nombre) {
    return NextResponse.json({ error: 'dni y nombre son requeridos' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from('employees').select('id').eq('dni', body.dni).single();
  if (existing) return NextResponse.json({ error: 'Ya existe un empleado con ese DNI' }, { status: 409 });

  const { data: employee, error } = await supabaseAdmin.from('employees').insert({
    dni: body.dni,
    nombre: body.nombre,
    activo: body.activo !== false ? 1 : 0,
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
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(employee, { status: 201 });
}
