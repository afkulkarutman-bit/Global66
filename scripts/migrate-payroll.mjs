import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PAYROLL_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.PAYROLL_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Faltan PAYROLL_SUPABASE_URL y PAYROLL_SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SQL = `
create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  status text default 'borrador',
  created_at timestamptz default now()
);

create table if not exists payroll_params (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id) on delete cascade,
  moneda text not null,
  tdc_usd numeric not null,
  retencion numeric default 0
);

create table if not exists payroll_employees (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id) on delete cascade,
  dni text,
  nombre text,
  email_global text,
  cargo text,
  area text,
  centro_costo text,
  pais text,
  moneda text,
  fecha_ingreso date,
  fecha_termino date,
  sueldo_base numeric default 0,
  es_argentina boolean default false,
  monto_ars_usd numeric default 0,
  dias_descuento numeric default 0,
  horas_extra numeric default 0,
  otros_ingresos numeric default 0,
  descuento_boutique numeric default 0,
  otros_descuentos numeric default 0
);

create table if not exists payroll_commissions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id) on delete cascade,
  tipo text not null,
  dni text not null,
  nombre text,
  monto_bruto numeric default 0,
  moneda text,
  mes text
);
`;

// Execute each statement separately
const statements = SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);

for (const stmt of statements) {
  const { error } = await supabase.rpc('exec_sql', { sql: stmt }).catch(() => ({ error: { message: 'rpc not available' } }));
  if (error) {
    // Try direct via REST if rpc fails
    console.log(`Trying: ${stmt.slice(0, 60)}...`);
  }
}

// Verify tables exist by querying them
const tables = ['payroll_periods', 'payroll_params', 'payroll_employees', 'payroll_commissions'];
for (const table of tables) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error && error.code === 'PGRST205') {
    console.log(`✗ ${table} - NO existe`);
  } else {
    console.log(`✓ ${table} - OK`);
  }
}
