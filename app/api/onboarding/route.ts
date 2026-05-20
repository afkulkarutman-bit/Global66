import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

async function saveFile(file: File, subdir: string, fieldName: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const safeName = `${fieldName}.${ext}`;
  const dir = path.join(UPLOADS_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, safeName);
  const bytes = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(bytes));
  return `/uploads/${subdir}/${safeName}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const get = (k: string) => (formData.get(k) as string | null) || '';
    const getFile = (k: string) => formData.get(k) as File | null;

    const rut = get('rut').trim();
    if (!rut) return NextResponse.json({ error: 'RUT requerido' }, { status: 400 });

    // Check if employee exists
    const { data: existing } = await supabaseAdmin
      .from('employees')
      .select('id,nombre')
      .eq('dni', rut)
      .single();

    // Sanitize rut for folder name
    const safeRut = rut.replace(/[^a-zA-Z0-9\-]/g, '_');

    // Save files
    const filePaths: Record<string, string> = {};
    const fileFields: Record<string, string> = {
      foto: 'doc_foto',
      doc_isapre: 'doc_isapre',
      doc_afp: 'doc_afp',
      doc_estudios: 'doc_estudios',
      doc_antecedentes: 'doc_antecedentes',
      doc_finiquito: 'doc_finiquito',
      doc_visa: 'doc_visa',
      doc_ci: 'doc_ci',
      doc_cv: 'doc_cv',
    };

    for (const [formField, dbField] of Object.entries(fileFields)) {
      const file = getFile(formField);
      if (file && file.size > 0) {
        filePaths[dbField] = await saveFile(file, safeRut, formField);
      }
    }

    const tiene_hijos = get('tiene_hijos') === 'si' ? 1 : 0;
    const discapacidad = get('discapacidad') === 'si' ? 1 : 0;
    const carnet_discapacidad = get('carnet_discapacidad') === 'si' ? 1 : 0;

    const usuarioWallet = get('usuario_wallet') || get('usuario_global66') || '';

    const fields = {
      nombre: get('nombre_completo') || existing?.nombre || '',
      domicilio: get('domicilio') || '',
      domicilio_completo: get('domicilio_completo') || '',
      pais_ciudad_comuna: get('pais_ciudad_comuna') || '',
      pais: get('pais') || '',
      nacionalidad: get('nacionalidad') || '',
      fecha_nacimiento: get('fecha_nacimiento') || '',
      estado_civil: get('estado_civil') || '',
      prevision: get('prevision') || '',
      afp: get('afp') || '',
      telefono: get('telefono') || '',
      email_personal: get('email_personal') || '',
      tiene_hijos,
      fechas_hijos: get('fechas_hijos') || '',
      discapacidad,
      carnet_discapacidad,
      alergias: get('alergias') || '',
      alimentacion_especial: get('alimentacion_especial') || '',
      banco: get('banco') || '',
      tipo_cuenta: get('tipo_cuenta') || '',
      numero_cuenta: get('numero_cuenta') || '',
      rut_cuenta: get('rut_cuenta') || '',
      email_cuenta: get('email_cuenta') || '',
      nombre_cuenta: get('nombre_cuenta') || '',
      usuario_wallet: usuarioWallet,
      usuario_global66: usuarioWallet,
      contacto_emergencia: get('contacto_emergencia') || '',
      foto_path: filePaths['doc_foto'] || '',
      doc_isapre: filePaths['doc_isapre'] || '',
      doc_afp: filePaths['doc_afp'] || '',
      doc_estudios: filePaths['doc_estudios'] || '',
      doc_antecedentes: filePaths['doc_antecedentes'] || '',
      doc_finiquito: filePaths['doc_finiquito'] || '',
      doc_visa: filePaths['doc_visa'] || '',
      doc_ci: filePaths['doc_ci'] || '',
      doc_cv: filePaths['doc_cv'] || '',
      onboarding_completado: 1,
      onboarding_fecha: new Date().toISOString().split('T')[0],
    };

    if (existing) {
      const fileKeys = ['foto_path','doc_isapre','doc_afp','doc_estudios','doc_antecedentes','doc_finiquito','doc_visa','doc_ci','doc_cv'];
      const updateFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (fileKeys.includes(k)) {
          if (v) updateFields[k] = v;
        } else {
          if (v !== '' && v !== null && v !== undefined) updateFields[k] = v;
        }
      }
      updateFields.onboarding_completado = 1;
      updateFields.onboarding_fecha = fields.onboarding_fecha;

      const { error } = await supabaseAdmin
        .from('employees')
        .update(updateFields)
        .eq('dni', rut);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: 'updated', nombre: existing.nombre });
    } else {
      const moneda_map: Record<string, string> = { Chile: 'CLP', Colombia: 'COP', Argentina: 'USD', Perú: 'PEN', España: 'EUR', Panamá: 'USD', Singapur: 'USD' };
      const moneda = moneda_map[fields.pais] || 'NA';
      const domicilio = fields.domicilio_completo || fields.domicilio || 'NA';

      const { error } = await supabaseAdmin.from('employees').insert({
        dni: rut,
        nombre: fields.nombre,
        activo: 1,
        cargo: get('cargo') || 'NA',
        sexo: 'NA',
        area: get('area') || 'NA',
        centro_costo: 'NA',
        pais: fields.pais,
        moneda,
        sueldo_local: null,
        salario_bruto: null,
        domicilio,
        fecha_ingreso: 'NA',
        tipo_contrato: get('tipo_contrato') || 'NA',
        jefatura: 'NA',
        email_global: 'NA',
        email_personal: fields.email_personal,
        domicilio_completo: fields.domicilio_completo,
        pais_ciudad_comuna: fields.pais_ciudad_comuna,
        nacionalidad: fields.nacionalidad,
        fecha_nacimiento: fields.fecha_nacimiento,
        estado_civil: fields.estado_civil,
        prevision: fields.prevision,
        afp: fields.afp,
        telefono: fields.telefono,
        tiene_hijos: fields.tiene_hijos,
        fechas_hijos: fields.fechas_hijos,
        discapacidad: fields.discapacidad,
        carnet_discapacidad: fields.carnet_discapacidad,
        alergias: fields.alergias,
        alimentacion_especial: fields.alimentacion_especial,
        banco: fields.banco,
        tipo_cuenta: fields.tipo_cuenta,
        numero_cuenta: fields.numero_cuenta,
        rut_cuenta: fields.rut_cuenta,
        email_cuenta: fields.email_cuenta,
        nombre_cuenta: fields.nombre_cuenta,
        usuario_wallet: fields.usuario_wallet,
        usuario_global66: fields.usuario_global66,
        contacto_emergencia: fields.contacto_emergencia,
        foto_path: fields.foto_path,
        doc_isapre: fields.doc_isapre,
        doc_afp: fields.doc_afp,
        doc_estudios: fields.doc_estudios,
        doc_antecedentes: fields.doc_antecedentes,
        doc_finiquito: fields.doc_finiquito,
        doc_visa: fields.doc_visa,
        doc_ci: fields.doc_ci,
        doc_cv: fields.doc_cv,
        onboarding_completado: 1,
        onboarding_fecha: fields.onboarding_fecha,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: 'created', nombre: fields.nombre });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[onboarding]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
