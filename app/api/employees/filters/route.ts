import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function isPending(emp: Record<string, unknown>): boolean {
  const empty = (v: unknown) => v === null || v === undefined || v === 'NA' || v === '';
  const noSueldo = (emp.sueldo_local === null || emp.sueldo_local === undefined || Number(emp.sueldo_local) === 0)
    && (emp.salario_bruto === null || emp.salario_bruto === undefined);
  return (
    empty(emp.cargo) || empty(emp.area) || empty(emp.jefatura) ||
    empty(emp.email_global) || empty(emp.email_personal) ||
    empty(emp.tipo_contrato) || empty(emp.sexo) || empty(emp.domicilio) ||
    empty(emp.usuario_wallet) || noSueldo
  );
}

export async function GET() {
  const { data: all } = await supabaseAdmin
    .from('employees')
    .select('pais,area,activo,cargo,jefatura,email_global,email_personal,tipo_contrato,sexo,domicilio,sueldo_local,salario_bruto,usuario_wallet');

  const rows = (all ?? []) as Record<string, unknown>[];

  const paises = [...new Set(rows.map(r => r.pais as string).filter(p => p && p !== 'NA'))].sort();
  const areas = [...new Set(rows.map(r => r.area as string).filter(a => a && a !== 'NA'))].sort();

  const activos = rows.filter(r => r.activo === 1).length;
  const inactivos = rows.filter(r => r.activo === 0).length;
  const stats = [
    { activo: 1, c: activos },
    { activo: 0, c: inactivos },
  ];

  const sinJefe = rows.filter(r => r.activo === 1 && r.area !== 'Directorio' && r.jefatura !== 'Directorio' && (!r.jefatura || r.jefatura === 'NA' || r.jefatura === '')).length;
  const pendingCount = rows.filter(r => r.activo === 1 && isPending(r)).length;

  return NextResponse.json({ paises, areas, stats, sinJefe, pendingCount });
}
