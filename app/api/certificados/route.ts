import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '';

  const { count: total } = await supabaseAdmin.from('employees').select('*', { count: 'exact', head: true });

  if (q.length < 2) return NextResponse.json({ employees: [], total: total ?? 0 });

  const { data: employees, error } = await supabaseAdmin
    .from('employees')
    .select('id,nombre,dni,cargo,pais,moneda,sueldo_local,salario_bruto,fecha_ingreso,fecha_termino,sexo,tipo_contrato,activo')
    .or(`nombre.ilike.%${q}%,dni.ilike.%${q}%`)
    .order('activo', { ascending: false })
    .order('nombre')
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dnis = (employees ?? []).map(emp => emp.dni).filter(Boolean);
  const { data: payrollRows } = dnis.length > 0
    ? await supabaseAdmin.from('payroll_employees').select('dni').in('dni', dnis)
    : { data: [] };
  const payrollDnis = new Set((payrollRows ?? []).map(row => row.dni));
  const enrichedEmployees = (employees ?? []).map(emp => ({
    ...emp,
    in_payroll: payrollDnis.has(emp.dni),
  }));

  return NextResponse.json({ employees: enrichedEmployees, total: total ?? 0 });
}
