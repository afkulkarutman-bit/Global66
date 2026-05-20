import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabasePayroll } from '@/lib/supabase/payroll';

// Employees with these contract types are "nómina de servicios"
const SERVICIOS_TIPOS = [
  'Servicios Argentina',
  'Servicios Chile',
  'Servicios Colombia',
  'Servicios Colombia ',
  'servicios Colombia',
  'Global Colombia 81 SA/Servicios Colombia',
  'Servicios España',
  'Servicios Panamá',
  'Servicios Perú',
];

export async function POST(req: NextRequest) {
  const { period_id } = await req.json();
  if (!period_id) return NextResponse.json({ error: 'period_id requerido' }, { status: 400 });

  // Get period dates so we can exclude employees who left before it started
  const { data: periodData, error: periodError } = await supabasePayroll
    .from('payroll_periods')
    .select('fecha_inicio, fecha_fin')
    .eq('id', period_id)
    .single();
  if (periodError) return NextResponse.json({ error: periodError.message }, { status: 500 });
  const periodoInicio = periodData.fecha_inicio as string;
  const periodoFin = periodData.fecha_fin as string;

  const SELECT_FIELDS = 'dni,nombre,email_global,cargo,area,centro_costo,pais,moneda,sueldo_local,fecha_ingreso,fecha_termino,tipo_contrato,usuario_wallet,activo';

  const fechaTerminoInPeriod = (fecha: string | null | undefined) =>
    !!fecha && fecha !== 'NA' && fecha >= periodoInicio && fecha <= periodoFin;

  const shouldIncludeInPeriod = (e: { activo?: number | null; fecha_termino?: string | null }) => {
    if (e.activo === 1) return true;
    return !!e.fecha_termino && e.fecha_termino !== 'NA' && e.fecha_termino >= periodoInicio;
  };

  // Query 1: standard servicios contract types
  const { data: empStd, error: err1 } = await supabaseAdmin
    .from('employees')
    .select(SELECT_FIELDS)
    .in('tipo_contrato', SERVICIOS_TIPOS);
  if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });

  // Query 2: Global81 SPA interns/practicantes (Chilean entity — only intern cargo qualifies)
  const { data: empInterns, error: err2 } = await supabaseAdmin
    .from('employees')
    .select(SELECT_FIELDS)
    .eq('tipo_contrato', 'Global81 SPA')
    .or('cargo.ilike.%Intern%,cargo.ilike.%Practicante%');
  if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });

  // Merge and deduplicate by DNI
  const seenDNI = new Set<string>();
  const empData = [...(empStd ?? []), ...(empInterns ?? [])].filter(e => {
    const key = String(e.dni ?? '').trim();
    if (seenDNI.has(key)) return false;
    seenDNI.add(key);
    return true;
  });

  if (empData.length === 0) {
    return NextResponse.json({ error: 'No se encontraron empleados de servicios para este período' }, { status: 404 });
  }

  // Include active employees plus employees whose termination overlaps this period.
  const excluidos = empData.filter(e =>
    !shouldIncludeInPeriod(e)
  );
  const empFiltrados = empData.filter(e =>
    shouldIncludeInPeriod(e)
  );

  if (empFiltrados.length === 0) {
    return NextResponse.json({ error: 'No se encontraron empleados para este período' }, { status: 404 });
  }

  // Load existing rows so we can preserve manual edits (novedades, monto_ars_usd, etc.)
  const { data: existingRows } = await supabasePayroll
    .from('payroll_employees')
    .select('*')
    .eq('period_id', period_id);
  const existingByDni = new Map((existingRows ?? []).map(r => [String(r.dni).trim(), r]));
  const hasAseguradoColumn = (existingRows ?? []).some(r => Object.prototype.hasOwnProperty.call(r, 'asegurado'));

  // DNIs currently in the period — used to detect new vs existing
  const incomingDnis = new Set(empFiltrados.map(e => String(e.dni ?? '').trim()));

  // Remove rows whose DNI is no longer in the active employee list (left the company)
  const dnisToDrop = [...existingByDni.keys()].filter(dni => !incomingDnis.has(dni));
  if (dnisToDrop.length > 0) {
    for (const dni of dnisToDrop) {
      await supabasePayroll.from('payroll_employees').delete().eq('period_id', period_id).eq('dni', dni);
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const e of empFiltrados) {
    const dni = String(e.dni ?? '').trim();
    const existing = existingByDni.get(dni);

    const baseData = {
      period_id,
      dni,
      nombre: e.nombre ?? '',
      email_global: e.email_global ?? null,
      cargo: e.cargo ?? null,
      area: e.area ?? null,
      centro_costo: e.centro_costo ?? null,
      pais: e.pais ?? null,
      moneda: e.moneda ?? 'USD',
      fecha_ingreso: e.fecha_ingreso && e.fecha_ingreso !== 'NA' ? e.fecha_ingreso : null,
      sueldo_base: Number(e.sueldo_local) || 0,
      es_argentina: e.pais === 'Argentina',
    };

    if (existing) {
      // Update base fields only — preserve all manual edits
      const fechaTerminoMes = fechaTerminoInPeriod(e.fecha_termino) ? e.fecha_termino : null;
      const updateData = {
        ...baseData,
        fecha_termino: fechaTerminoMes,
        usuario_wallet: existing.usuario_wallet ?? e.usuario_wallet ?? null,
        variacion_salario_base: existing.variacion_salario_base ?? 0,
        ...(hasAseguradoColumn ? { asegurado: existing.asegurado ?? 0 } : {}),
      };
      await supabasePayroll
        .from('payroll_employees')
        .update(updateData)
        .eq('period_id', period_id)
        .eq('dni', dni);
      updated++;
    } else {
      // New employee — insert with zeroed editable fields
      const fechaTermino = fechaTerminoInPeriod(e.fecha_termino) ? e.fecha_termino : null;
      await supabasePayroll.from('payroll_employees').insert({
        ...baseData,
        fecha_termino: fechaTermino,
        usuario_wallet: e.usuario_wallet ?? null,
        variacion_salario_base: 0,
        monto_ars_usd: 0,
        dias_descuento: 0,
        horas_extra: 0,
        otros_ingresos: 0,
        ...(hasAseguradoColumn ? { asegurado: 0 } : {}),
        descuento_boutique: 0,
        otros_descuentos: 0,
        fecha_boleta: null,
      });
      inserted++;
    }
  }

  const allRows = await supabasePayroll.from('payroll_employees').select('es_argentina').eq('period_id', period_id);
  const argentina = (allRows.data ?? []).filter(r => r.es_argentina).length;

  return NextResponse.json({
    inserted,
    updated,
    argentina,
    excluidos: excluidos.length,
    excluidos_detalle: excluidos.map(e => ({ dni: String(e.dni), nombre: e.nombre, fecha_termino: e.fecha_termino })),
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id');
  if (!periodId) return NextResponse.json({ error: 'period_id requerido' }, { status: 400 });

  const { data, error } = await supabasePayroll
    .from('payroll_employees')
    .select('*')
    .eq('period_id', periodId)
    .order('pais')
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const dnis = rows.map(r => String(r.dni ?? '').trim()).filter(Boolean);
  if (dnis.length === 0) return NextResponse.json(rows);

  const { data: bankData, error: bankError } = await supabaseAdmin
    .from('employees')
    .select('dni,banco,tipo_cuenta,numero_cuenta')
    .in('dni', dnis);
  if (bankError) return NextResponse.json({ error: bankError.message }, { status: 500 });

  const bankByDni = new Map((bankData ?? []).map(e => [String(e.dni ?? '').trim(), e]));
  return NextResponse.json(rows.map(row => {
    const bank = bankByDni.get(String(row.dni ?? '').trim());
    return {
      ...row,
      banco: bank?.banco ?? null,
      tipo_cuenta: bank?.tipo_cuenta ?? null,
      numero_cuenta: bank?.numero_cuenta ?? null,
    };
  }));
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, _delete, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  if (_delete) {
    const { error } = await supabasePayroll.from('payroll_employees').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const bankKeys = ['banco', 'tipo_cuenta', 'numero_cuenta'];
  const bankUpdate = Object.fromEntries(
    Object.entries(fields)
      .filter(([k]) => bankKeys.includes(k))
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v ?? null])
  );
  const hasBankUpdate = Object.keys(bankUpdate).length > 0;

  const allowed = [
    'dias_descuento', 'horas_extra', 'otros_ingresos', 'descuento_boutique', 'otros_descuentos',
    'asegurado',
    'monto_ars_usd', 'fecha_termino', 'fecha_ingreso',
    'variacion_salario_base',
    'revisar',
    'nombre', 'email_global', 'cargo', 'area', 'centro_costo', 'pais', 'moneda', 'sueldo_base', 'es_argentina',
    'preferencia_pago', 'correo_wallet', 'usuario_wallet', 'observaciones',
    'fecha_boleta',
  ];
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  let rowForChecks: { period_id: string; dni: string } | null = null;

  if ((typeof update.fecha_termino === 'string' && update.fecha_termino) || hasBankUpdate) {
    const { data: row, error: rowError } = await supabasePayroll
      .from('payroll_employees')
      .select('period_id,dni')
      .eq('id', id)
      .single();
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
    rowForChecks = row;
  }

  if (typeof update.fecha_termino === 'string' && update.fecha_termino) {
    const { data: period, error: periodError } = await supabasePayroll
      .from('payroll_periods')
      .select('fecha_inicio')
      .eq('id', rowForChecks!.period_id)
      .single();
    if (periodError) return NextResponse.json({ error: periodError.message }, { status: 500 });
    if (update.fecha_termino < period.fecha_inicio) {
      return NextResponse.json({
        error: `No se puede dejar en esta nómina a una persona que terminó antes del período (${update.fecha_termino} < ${period.fecha_inicio})`,
      }, { status: 400 });
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabasePayroll.from('payroll_employees').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (hasBankUpdate && rowForChecks?.dni) {
    const { error: bankError } = await supabaseAdmin
      .from('employees')
      .update(bankUpdate)
      .eq('dni', String(rowForChecks.dni).trim());
    if (bankError) return NextResponse.json({ error: bankError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { period_id, dni, nombre, email_global, cargo, area, centro_costo, pais, moneda, sueldo_base, fecha_ingreso, fecha_termino, es_argentina, monto_ars_usd, variacion_salario_base, preferencia_pago, correo_wallet, usuario_wallet, banco, tipo_cuenta, numero_cuenta, observaciones } = body;
  if (!period_id || !dni || !nombre) {
    return NextResponse.json({ error: 'period_id, dni y nombre son requeridos' }, { status: 400 });
  }

  const { data: period, error: periodError } = await supabasePayroll
    .from('payroll_periods')
    .select('fecha_inicio')
    .eq('id', period_id)
    .single();
  if (periodError) return NextResponse.json({ error: periodError.message }, { status: 500 });
  if (fecha_termino && fecha_termino < period.fecha_inicio) {
    return NextResponse.json({
      error: `No se puede agregar a una persona que terminó antes del período (${fecha_termino} < ${period.fecha_inicio})`,
    }, { status: 400 });
  }

  const toInsert = {
    period_id,
    dni: String(dni).trim(),
    nombre,
    email_global: email_global || null,
    cargo: cargo || null,
    area: area || null,
    centro_costo: centro_costo || null,
    pais: pais || null,
    moneda: moneda || 'USD',
    fecha_ingreso: fecha_ingreso || null,
    fecha_termino: fecha_termino || null,
    sueldo_base: Number(sueldo_base) || 0,
    variacion_salario_base: Number(variacion_salario_base) || 0,
    es_argentina: Boolean(es_argentina),
    monto_ars_usd: Number(monto_ars_usd) || 0,
    preferencia_pago: preferencia_pago || 'Banco',
    correo_wallet: correo_wallet || null,
    usuario_wallet: usuario_wallet || null,
    observaciones: observaciones || null,
    dias_descuento: 0,
    horas_extra: 0,
    otros_ingresos: 0,
    descuento_boutique: 0,
    otros_descuentos: 0,
    fecha_boleta: null,
  };

  const { error } = await supabasePayroll.from('payroll_employees').insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bankUpdate = {
    banco: typeof banco === 'string' ? banco.trim() || null : banco ?? null,
    tipo_cuenta: typeof tipo_cuenta === 'string' ? tipo_cuenta.trim() || null : tipo_cuenta ?? null,
    numero_cuenta: typeof numero_cuenta === 'string' ? numero_cuenta.trim() || null : numero_cuenta ?? null,
  };
  if (bankUpdate.banco || bankUpdate.tipo_cuenta || bankUpdate.numero_cuenta) {
    const { error: bankError } = await supabaseAdmin
      .from('employees')
      .update(bankUpdate)
      .eq('dni', String(dni).trim());
    if (bankError) return NextResponse.json({ error: bankError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
