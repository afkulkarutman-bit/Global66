import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function isPending(emp: Record<string, unknown>): boolean {
  const empty = (v: unknown) => v === null || v === undefined || v === 'NA' || v === '';
  const noSueldo = (emp.sueldo_local === null || emp.sueldo_local === undefined || Number(emp.sueldo_local) === 0)
    && (emp.salario_bruto === null || emp.salario_bruto === undefined);
  const sinJefe = emp.area !== 'Directorio' && emp.jefatura !== 'Directorio' && empty(emp.jefatura);
  return (
    empty(emp.cargo) || empty(emp.area) || sinJefe ||
    empty(emp.email_global) || empty(emp.email_personal) ||
    empty(emp.tipo_contrato) || empty(emp.sexo) || empty(emp.domicilio) ||
    empty(emp.usuario_wallet) || noSueldo
  );
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id,dni,nombre,cargo,area,jefatura,email_global,email_personal,tipo_contrato,pais,moneda,sueldo_local,salario_bruto,domicilio,sexo,fecha_ingreso,onboarding_completado,usuario_wallet')
    .eq('activo', 1)
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = (data ?? []).filter(emp => isPending(emp as Record<string, unknown>));
  return NextResponse.json(pending);
}
