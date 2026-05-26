import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('feedback_responses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ responses: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const evaluadorEmail = String(body.evaluador_email || '').trim();
    const evaluadoEmail = String(body.evaluado_email || '').trim();
    const stop = String(body.stop || '').trim();
    const start = String(body.start || '').trim();
    const continuar = String(body.continue || '').trim();
    const apruebaContinuidad = String(body.aprueba_continuidad || '').trim();

    if (!evaluadorEmail) return NextResponse.json({ error: 'Mail del evaluador requerido' }, { status: 400 });
    if (!evaluadoEmail) return NextResponse.json({ error: 'Mail del evaluado requerido' }, { status: 400 });
    if (!stop) return NextResponse.json({ error: 'Stop es requerido' }, { status: 400 });
    if (!start) return NextResponse.json({ error: 'Start es requerido' }, { status: 400 });
    if (!continuar) return NextResponse.json({ error: 'Continue es requerido' }, { status: 400 });
    if (!['si', 'no'].includes(apruebaContinuidad)) return NextResponse.json({ error: 'Debes indicar si se aprueba continuidad' }, { status: 400 });

    const { data: evaluador } = await supabaseAdmin
      .from('employees')
      .select('id,nombre,email_global,email_personal')
      .or(`email_global.eq.${evaluadorEmail},email_personal.eq.${evaluadorEmail}`)
      .maybeSingle();

    const { data: evaluado } = await supabaseAdmin
      .from('employees')
      .select('id,nombre,email_global,email_personal')
      .or(`email_global.eq.${evaluadoEmail},email_personal.eq.${evaluadoEmail}`)
      .maybeSingle();

    const { data, error } = await supabaseAdmin
      .from('feedback_responses')
      .insert({
        tipo_feedback: 'primer_feedback',
        evaluador_employee_id: evaluador?.id ?? null,
        evaluador_nombre: evaluador?.nombre ?? null,
        evaluador_email: evaluadorEmail,
        evaluado_employee_id: evaluado?.id ?? null,
        evaluado_nombre: evaluado?.nombre ?? null,
        evaluado_email: evaluadoEmail,
        stop,
        start,
        continue_text: continuar,
        aprueba_continuidad: apruebaContinuidad === 'si',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedback: data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
