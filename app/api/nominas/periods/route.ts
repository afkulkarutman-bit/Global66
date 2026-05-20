import { NextRequest, NextResponse } from 'next/server';
import { supabasePayroll as supabaseAdmin } from '@/lib/supabase/payroll';

const DEFAULT_PARAMS = [
  { moneda: 'COP', tdc_usd: 3574, retencion: 0 },
  { moneda: 'ARS', tdc_usd: 1452, retencion: 0 },
  { moneda: 'PEN', tdc_usd: 3.44, retencion: 0.10 },
  { moneda: 'CLP', tdc_usd: 905, retencion: 0.1525 },
  { moneda: 'EUR', tdc_usd: 0.84, retencion: 0 },
  { moneda: 'USD', tdc_usd: 1, retencion: 0 },
];

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('payroll_periods')
    .select('*, payroll_params(*)')
    .order('mes', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mes, fecha_inicio, fecha_fin, copy_from_period_id } = body;

  if (!mes || !fecha_inicio || !fecha_fin) {
    return NextResponse.json({ error: 'mes, fecha_inicio y fecha_fin son requeridos' }, { status: 400 });
  }

  const { data: period, error } = await supabaseAdmin
    .from('payroll_periods')
    .insert({ mes, fecha_inicio, fecha_fin, status: 'borrador' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (copy_from_period_id) {
    // Copy params from source period
    const { data: sourceParams } = await supabaseAdmin
      .from('payroll_params')
      .select('moneda, tdc_usd, retencion')
      .eq('period_id', copy_from_period_id);

    if (sourceParams && sourceParams.length > 0) {
      const newParams = sourceParams.map(p => ({ ...p, period_id: period.id }));
      await supabaseAdmin.from('payroll_params').insert(newParams);
    } else {
      const params = DEFAULT_PARAMS.map(p => ({ ...p, period_id: period.id }));
      await supabaseAdmin.from('payroll_params').insert(params);
    }

    // Copy employees from source period, preserving all persistent settings.
    // Guardrail: never carry into a new period someone whose contract ended
    // before the new period starts. If they end during the new period, keep
    // fecha_termino so payroll calculates proportional days.
    const { data: sourceEmps } = await supabaseAdmin
      .from('payroll_employees')
      .select('*')
      .eq('period_id', copy_from_period_id);

    let skippedEndedBeforePeriod: { dni: string; nombre: string; fecha_termino: string }[] = [];
    let copiedWithTerminationInPeriod: { dni: string; nombre: string; fecha_termino: string }[] = [];

    if (sourceEmps && sourceEmps.length > 0) {
      const sourceDnis = [...new Set(sourceEmps.map(e => String(e.dni ?? '').trim()).filter(Boolean))];
      const { data: employees } = await supabaseAdmin
        .from('employees')
        .select('dni,fecha_termino,activo')
        .in('dni', sourceDnis);
      const employeesByDni = new Map((employees ?? []).map(e => [String(e.dni ?? '').trim(), e]));

      const cleanDate = (value: unknown) => {
        const date = String(value ?? '').trim();
        return date && date !== 'NA' ? date : null;
      };
      const terminationForNewPeriod = (e: { dni?: string | null; fecha_termino?: string | null; nombre?: string | null }) => {
        const dni = String(e.dni ?? '').trim();
        const employee = employeesByDni.get(dni);
        return cleanDate(employee?.fecha_termino) ?? cleanDate(e.fecha_termino);
      };

      const newEmps = sourceEmps.flatMap(e => {
        const fechaTermino = terminationForNewPeriod(e);
        if (fechaTermino && fechaTermino < fecha_inicio) {
          skippedEndedBeforePeriod.push({ dni: String(e.dni ?? ''), nombre: e.nombre ?? '', fecha_termino: fechaTermino });
          return [];
        }
        const fechaTerminoInPeriod = fechaTermino && fechaTermino <= fecha_fin ? fechaTermino : null;
        if (fechaTerminoInPeriod) {
          copiedWithTerminationInPeriod.push({ dni: String(e.dni ?? ''), nombre: e.nombre ?? '', fecha_termino: fechaTerminoInPeriod });
        }
        return [{
          period_id: period.id,
          dni: e.dni,
          nombre: e.nombre,
          email_global: e.email_global,
          cargo: e.cargo,
          area: e.area,
          centro_costo: e.centro_costo,
          pais: e.pais,
          moneda: e.moneda,
          sueldo_base: e.sueldo_base,
          variacion_salario_base: e.variacion_salario_base,
          es_argentina: e.es_argentina,
          monto_ars_usd: e.monto_ars_usd,
          preferencia_pago: e.preferencia_pago,
          correo_wallet: e.correo_wallet,
          usuario_wallet: e.usuario_wallet,
          observaciones: e.observaciones,
          fecha_ingreso: e.fecha_ingreso,
          fecha_termino: fechaTerminoInPeriod,
          dias_descuento: 0,
          horas_extra: 0,
          otros_ingresos: 0,
          asegurado: e.asegurado ?? 0,
          descuento_boutique: 0,
          otros_descuentos: 0,
          revisar: false,
          fecha_boleta: null,
        }];
      });
      if (newEmps.length > 0) {
        await supabaseAdmin.from('payroll_employees').insert(newEmps);
      }
    }

    return NextResponse.json({
      ...period,
      copy_summary: {
        skipped_ended_before_period: skippedEndedBeforePeriod,
        copied_with_termination_in_period: copiedWithTerminationInPeriod,
      },
    }, { status: 201 });
  } else {
    const params = DEFAULT_PARAMS.map(p => ({ ...p, period_id: period.id }));
    await supabaseAdmin.from('payroll_params').insert(params);
  }

  return NextResponse.json(period, { status: 201 });
}
