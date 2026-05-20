import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function groupBy<T>(arr: T[], key: keyof T) {
  const map = new Map<unknown, number>();
  for (const item of arr) {
    const k = item[key];
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, total]) => ({ [key]: k, total }));
}

export async function GET() {
  const { data: all, error } = await supabaseAdmin
    .from('employees')
    .select('activo,pais,sexo,area,tipo_contrato,cargo,fecha_ingreso,moneda,sueldo_local,salario_bruto');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = all ?? [];

  const activos = rows.filter(r => r.activo === 1).length;
  const inactivos = rows.filter(r => r.activo === 0).length;
  const total = rows.length;

  // porPais
  const paisMap = new Map<string, { total: number; activos: number }>();
  for (const r of rows) {
    if (!r.pais || r.pais === 'NA') continue;
    const cur = paisMap.get(r.pais) ?? { total: 0, activos: 0 };
    cur.total++;
    if (r.activo === 1) cur.activos++;
    paisMap.set(r.pais, cur);
  }
  const porPais = [...paisMap.entries()].map(([pais, v]) => ({ pais, ...v })).sort((a, b) => b.total - a.total);

  // porSexo
  const activeRows = rows.filter(r => r.activo === 1);
  const sexoMap = new Map<string, number>();
  for (const r of activeRows) { if (r.sexo) sexoMap.set(r.sexo, (sexoMap.get(r.sexo) ?? 0) + 1); }
  const porSexo = [...sexoMap.entries()].map(([sexo, total]) => ({ sexo, total })).sort((a, b) => b.total - a.total);

  // porArea
  const areaMap = new Map<string, { total: number; activos: number }>();
  for (const r of rows) {
    if (!r.area || r.area === 'NA') continue;
    const cur = areaMap.get(r.area) ?? { total: 0, activos: 0 };
    cur.total++;
    if (r.activo === 1) cur.activos++;
    areaMap.set(r.area, cur);
  }
  const porArea = [...areaMap.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.total - a.total).slice(0, 10);

  // Inactivos por pais y area
  const inactivePaisAreaMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.activo !== 0) continue;
    const pais = r.pais && r.pais !== 'NA' ? r.pais : 'Sin pais';
    const area = r.area && r.area !== 'NA' ? r.area : 'Sin area';
    const areaMapForPais = inactivePaisAreaMap.get(pais) ?? new Map<string, number>();
    areaMapForPais.set(area, (areaMapForPais.get(area) ?? 0) + 1);
    inactivePaisAreaMap.set(pais, areaMapForPais);
  }
  const inactivosPorPaisArea = [...inactivePaisAreaMap.entries()]
    .map(([pais, areas]) => {
      const areaRows = [...areas.entries()]
        .map(([area, total]) => ({ area, total }))
        .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area));
      return {
        pais,
        total: areaRows.reduce((sum, item) => sum + item.total, 0),
        areas: areaRows,
      };
    })
    .sort((a, b) => b.total - a.total || a.pais.localeCompare(b.pais));

  // porContrato
  const contratoMap = new Map<string, number>();
  for (const r of activeRows) { if (r.tipo_contrato && r.tipo_contrato !== 'NA') contratoMap.set(r.tipo_contrato, (contratoMap.get(r.tipo_contrato) ?? 0) + 1); }
  const porContrato = [...contratoMap.entries()].map(([tipo_contrato, total]) => ({ tipo_contrato, total })).sort((a, b) => b.total - a.total);

  // porCargo
  const cargoMap = new Map<string, number>();
  for (const r of activeRows) { if (r.cargo && r.cargo !== 'NA') cargoMap.set(r.cargo, (cargoMap.get(r.cargo) ?? 0) + 1); }
  const porCargo = [...cargoMap.entries()].map(([cargo, total]) => ({ cargo, total })).sort((a, b) => b.total - a.total).slice(0, 10);

  // ingresosPorAno
  const anoMap = new Map<string, number>();
  for (const r of rows) {
    const anio = r.fecha_ingreso?.slice(0, 4);
    if (anio && anio.length === 4 && !isNaN(Number(anio))) anoMap.set(anio, (anoMap.get(anio) ?? 0) + 1);
  }
  const ingresosPorAno = [...anoMap.entries()].map(([anio, total]) => ({ anio, total })).sort((a, b) => a.anio.localeCompare(b.anio));

  // sueldosPorPais
  type SalKey = string;
  const salMap = new Map<SalKey, { sum: number; min: number; max: number; n: number }>();
  for (const r of activeRows) {
    if (!r.pais || r.pais === 'NA') continue;
    const sal = Number(r.sueldo_local ?? r.salario_bruto ?? 0);
    if (!sal) continue;
    const key = `${r.pais}|${r.moneda}`;
    const cur = salMap.get(key) ?? { sum: 0, min: Infinity, max: -Infinity, n: 0 };
    cur.sum += sal; cur.min = Math.min(cur.min, sal); cur.max = Math.max(cur.max, sal); cur.n++;
    salMap.set(key, cur);
  }
  const sueldosPorPais = [...salMap.entries()].map(([key, v]) => {
    const [pais, moneda] = key.split('|');
    return { pais, moneda, avg_local: Math.round(v.sum / v.n), min_local: v.min, max_local: v.max, n: v.n };
  }).sort((a, b) => a.pais.localeCompare(b.pais));

  return NextResponse.json({ total, activos, inactivos, porPais, porSexo, porArea, inactivosPorPaisArea, porContrato, porCargo, ingresosPorAno, sueldosPorPais });
}
