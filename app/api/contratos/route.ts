import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

// ---- Number to Spanish words ----
const UNITS = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
  'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
const TENS = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const HUNDREDS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

function toWords(n: number): string {
  if (n === 0) return 'cero';
  if (n < 0) return 'menos ' + toWords(-n);
  if (n === 100) return 'cien';
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return r === 0 ? HUNDREDS[h] : `${HUNDREDS[h]} ${toWords(r)}`;
  }
  if (n < 1000000) {
    const miles = Math.floor(n / 1000), r = n % 1000;
    const prefix = miles === 1 ? 'mil' : `${toWords(miles)} mil`;
    return r === 0 ? prefix : `${prefix} ${toWords(r)}`;
  }
  const mils = Math.floor(n / 1000000), r = n % 1000000;
  const prefix = mils === 1 ? 'un millón' : `${toWords(mils)} millones`;
  return r === 0 ? prefix : `${prefix} ${toWords(r)}`;
}

function numToWords(n: number): string {
  return toWords(Math.round(n)).toUpperCase();
}

// ---- Template detection ----
function detectTemplate(pais: string, cargo: string): string {
  const p = (pais ?? '').toLowerCase();
  const c = (cargo ?? '').toLowerCase();

  if (p.includes('colombia')) return 'contrato_colombia.docx';

  const isSenior = ['head','lead','vp','director','chief','country manager','clevel','c-level','ceo','cto','coo','cfo','cpo']
    .some(kw => c.includes(kw));

  return isSenior ? 'contrato_chile_senior.docx' : 'contrato_chile.docx';
}

// ---- Date formatting ----
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function formatDateLong(dateStr: string): string {
  if (!dateStr || dateStr === 'NA') return '';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ---- Search endpoint ----
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';

  if (q.length < 2) return NextResponse.json([]);

  const { data } = await supabaseAdmin
    .from('employees')
    .select('id,nombre,dni,cargo,pais,moneda,sueldo_local,salario_bruto,fecha_ingreso,fecha_termino,email_personal,email_global,domicilio,tipo_contrato,jefatura,activo,sexo')
    .or(`nombre.ilike.%${q}%,dni.ilike.%${q}%`)
    .order('activo', { ascending: false })
    .order('nombre')
    .limit(10);

  return NextResponse.json(data ?? []);
}

// ---- Generate contract ----
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    empleado,              // full employee object
    fecha_redaccion,
    fecha_nacimiento,
    fecha_termino,
    nacionalidad,
    responsabilidades,
    monto_movilizacion,
    monto_colacion,
    monto_conexion,
    template_override,    // optional: force a specific template
  } = body;

  if (!empleado) return NextResponse.json({ error: 'empleado requerido' }, { status: 400 });

  const templateFile = template_override ?? detectTemplate(empleado.pais ?? '', empleado.cargo ?? '');
  const templatePath = path.join(process.cwd(), 'public', 'templates', templateFile);

  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: `Template no encontrado: ${templateFile}` }, { status: 500 });
  }

  const sueldo = Number(empleado.sueldo_local ?? empleado.salario_bruto ?? 0);
  const sueldoLetras = numToWords(sueldo);
  const movNum = Number(monto_movilizacion ?? 0);
  const colNum = Number(monto_colacion ?? 0);
  const conNum = Number(monto_conexion ?? 0);

  const data: Record<string, string> = {
    // Chile
    Nombre: empleado.nombre ?? '',
    CI: empleado.dni ?? '',
    Cargo: empleado.cargo ?? '',
    Fecha_De_Redacción: fecha_redaccion ? formatDateLong(fecha_redaccion) : formatDateLong(new Date().toISOString().slice(0,10)),
    Fecha_Ingreso: formatDateLong(empleado.fecha_ingreso),
    Fecha_Inicio: formatDateLong(empleado.fecha_ingreso),
    Fecha_Nacimiento: fecha_nacimiento ? formatDateLong(fecha_nacimiento) : '',
    'Fecha_termino_relación_laboral': fecha_termino ? formatDateLong(fecha_termino) : 'indefinido',
    Domicilio: empleado.domicilio && empleado.domicilio !== 'NA' ? empleado.domicilio : '',
    Comuna: '',
    Correo_Personal: empleado.email_personal && empleado.email_personal !== 'NA' ? empleado.email_personal : (empleado.email_global ?? ''),
    Nacionalidad: nacionalidad ?? '',
    Monto_Sueldo_Numero: sueldo.toLocaleString('es-CL'),
    monto_sueldo_base_numero: sueldo.toLocaleString('es-CL'),
    Monto_Sueldo_Letras: sueldoLetras,
    Monto_sueldo_letras: sueldoLetras,
    Jefatura_Nombre: empleado.jefatura && empleado.jefatura !== 'NA' ? empleado.jefatura : '',
    'Listado_Responsabilidades_ y_Actividades_Basicas': responsabilidades ?? '',
    Listado_Responsabilidades_Basicas: responsabilidades ?? '',
    monto_movilizacion_numero: movNum.toLocaleString('es-CL'),
    Monto_movilizacion_letras: numToWords(movNum),
    monto_colacion_numero: colNum.toLocaleString('es-CL'),
    Monto_colacion_letras: numToWords(colNum),
    monto_conexion_numero: conNum.toLocaleString('es-CL'),
    Monto_conexion_letras: numToWords(conNum),

    // Colombia
    Nombre_Prestador: empleado.nombre ?? '',
    DNI: empleado.dni ?? '',
    Servicio_Nombre: empleado.cargo ?? '',
    Correo: empleado.email_personal && empleado.email_personal !== 'NA' ? empleado.email_personal : (empleado.email_global ?? ''),
    'Dirección_Domicilio_Prestador': empleado.domicilio && empleado.domicilio !== 'NA' ? empleado.domicilio : '',
    Sueldo_Bruto: sueldo.toLocaleString('es-CO'),
    Sueldo_Bruto_Palabras: sueldoLetras,
  };

  try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: { start: '{{', end: '}}' },
    });

    doc.render(data);

    const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `Contrato_${(empleado.nombre ?? 'empleado').replace(/\s+/g, '_')}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    // Docxtemplater wraps multiple template errors in err.properties.errors
    const dtErr = err as { properties?: { errors?: unknown[] }; message?: string };
    if (dtErr?.properties?.errors?.length) {
      const details = dtErr.properties.errors.map((e: unknown) => {
        const de = e as { properties?: { explanation?: string; tag?: string } };
        return de?.properties?.explanation ?? de?.properties?.tag ?? String(e);
      });
      console.error('Docxtemplater errors:', details);
      return NextResponse.json({ error: 'Multi error', details }, { status: 500 });
    }
    const msg = err instanceof Error ? err.message : 'Error generando contrato';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
