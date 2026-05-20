create table if not exists public.payroll_salary_changes (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  payroll_employee_id uuid references public.payroll_employees(id) on delete set null,
  dni text not null,
  nombre text not null,
  pais text,
  cargo text,
  moneda text not null,
  old_base numeric not null default 0,
  new_base numeric not null default 0,
  diff_amount numeric not null default 0,
  diff_pct numeric not null default 0,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists payroll_salary_changes_period_idx
  on public.payroll_salary_changes(period_id);

create index if not exists payroll_salary_changes_dni_idx
  on public.payroll_salary_changes(dni);

alter table public.payroll_salary_changes enable row level security;

notify pgrst, 'reload schema';
