import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

type GeminiMsg = { role: 'user' | 'model'; parts: { text: string }[] };

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] }: { message: string; history: GeminiMsg[] } = await req.json();

    const [
      { data: allEmployees },
      { data: attendanceReports },
      { data: payrollPeriods },
      { data: payrollEmployees },
    ] = await Promise.all([
      supabaseAdmin.from('employees').select(
        'id,nombre,dni,cargo,area,pais,activo,presencialidad,jefatura,email_global,email_personal,moneda,sueldo_local,salario_bruto,tipo_contrato,sexo,fecha_ingreso,fecha_termino,onboarding_completado,domicilio,nacionalidad,fecha_nacimiento'
      ).order('nombre'),
      supabaseAdmin.from('attendance_reports').select('country,year,month,month_name,summary,rows').order('created_at', { ascending: false }),
      supabaseAdmin.from('payroll_periods').select('*').order('mes', { ascending: false }),
      supabaseAdmin.from('payroll_employees').select('employee_id,nombre,cargo,pais,moneda,sueldo_base,total_bruto,total_descuentos,total_neto').limit(500),
    ]);

    const employees = allEmployees ?? [];
    const activos = employees.filter(e => e.activo === 1);
    const inactivos = employees.filter(e => e.activo === 0);

    const pending = activos.filter(emp => {
      const empty = (v: unknown) => v === null || v === undefined || v === 'NA' || v === '';
      const noSueldo = (emp.sueldo_local === null || Number(emp.sueldo_local) === 0) && emp.salario_bruto === null;
      return empty(emp.cargo) || empty(emp.area) || empty(emp.jefatura) || empty(emp.email_global) || empty(emp.email_personal) || empty(emp.tipo_contrato) || empty(emp.sexo) || empty(emp.domicilio) || noSueldo;
    });

    const count = (arr: typeof employees, key: string) =>
      Object.entries(arr.reduce((acc, e) => {
        const k = (e as Record<string, unknown>)[key] as string || 'Sin definir';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]);

    const employeeData = employees.map(e => ({
      id: e.id,
      nombre: e.nombre,
      dni: e.dni,
      estado: e.activo === 1 ? 'activo' : 'inactivo',
      cargo: e.cargo,
      area: e.area,
      pais: e.pais,
      presencialidad: e.presencialidad,
      jefatura: e.jefatura,
      email: e.email_global,
      moneda: e.moneda,
      sueldo: e.sueldo_local || e.salario_bruto,
      contrato: e.tipo_contrato,
      sexo: e.sexo,
      ingreso: e.fecha_ingreso,
      termino: e.fecha_termino,
      onboarding: e.onboarding_completado === 1 ? 'completo' : 'pendiente',
      domicilio: e.domicilio,
      nacionalidad: e.nacionalidad,
    }));

    // Attendance: include only rows needed for analysis (strip heavy unused fields)
    type AttendanceRow = {
      nombre: string;
      dni: string;
      cargo: string;
      presencialidad: string;
      dias_esperados: number;
      dias_asistidos: number;
      porcentaje_cumplimiento: number | null;
      estado: string;
      alertas: string[];
    };
    const attendanceData = (attendanceReports ?? []).map(r => ({
      pais: r.country,
      anio: r.year,
      mes: r.month_name,
      resumen: {
        empleados: r.summary.employees,
        dias_habiles: r.summary.monthBusinessDays,
        cumple: r.summary.cumple,
        revisar: r.summary.revisar,
        no_cumple: r.summary.noCumple,
        no_aplica: r.summary.noAplica,
      },
      empleados: (r.rows ?? []).map((row: AttendanceRow) => ({
        nombre: row.nombre,
        dni: row.dni,
        cargo: row.cargo,
        presencialidad: row.presencialidad,
        esperados: row.dias_esperados,
        asistidos: row.dias_asistidos,
        pct: row.porcentaje_cumplimiento,
        estado: row.estado,
        alertas: row.alertas,
      })),
    }));

    const systemText = `Eres el asistente de RRHH de Global66 People, la plataforma interna de Global66 (fintech latinoamericana con operaciones en Chile, Colombia, Argentina, Perú y España).
Tenés acceso COMPLETO a todos los datos: empleados, asistencia y nómina.
Respondé siempre en español, de forma directa y concisa. Cuando te pregunten por personas, buscá por nombre, cargo, área, país o cualquier campo disponible.
Podés hacer cálculos, comparaciones y rankings con los datos que tenés. No inventes datos que no estén aquí.

━━━ RESUMEN GENERAL ━━━
Total: ${employees.length} | Activos: ${activos.length} | Inactivos: ${inactivos.length} | Con datos incompletos: ${pending.length}

Por país (activos): ${count(activos, 'pais').map(([p, n]) => `${p}: ${n}`).join(' | ')}
Por área (activos): ${count(activos, 'area').slice(0, 8).map(([a, n]) => `${a}: ${n}`).join(' | ')}
Por presencialidad (activos): ${count(activos, 'presencialidad').map(([p, n]) => `${p}: ${n}`).join(' | ')}
Por sexo (activos): ${count(activos, 'sexo').map(([s, n]) => `${s}: ${n}`).join(' | ')}
Onboarding pendiente (activos): ${activos.filter(e => !e.onboarding_completado).length}

━━━ TODOS LOS EMPLEADOS (${employees.length}) ━━━
${JSON.stringify(employeeData)}

━━━ REPORTES DE ASISTENCIA (${attendanceData.length} reportes) ━━━
${JSON.stringify(attendanceData)}

━━━ NÓMINA ━━━
Períodos: ${JSON.stringify(payrollPeriods ?? [])}
Empleados en nómina (${(payrollEmployees ?? []).length}): ${JSON.stringify(payrollEmployees ?? [])}`;

    const contents: GeminiMsg[] = [...history, { role: 'user', parts: [{ text: message }] }];

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemText }] }, contents }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || 'Error de Gemini' }, { status: 500 });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    return NextResponse.json({ text });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
