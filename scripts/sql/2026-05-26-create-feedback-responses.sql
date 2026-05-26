create table if not exists public.feedback_responses (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  tipo_feedback text not null default 'primer_feedback',
  evaluador_employee_id bigint null references public.employees(id) on delete set null,
  evaluador_nombre text null,
  evaluador_email text not null,
  evaluado_employee_id bigint null references public.employees(id) on delete set null,
  evaluado_nombre text null,
  evaluado_email text not null,
  stop text not null,
  start text not null,
  continue_text text not null,
  aprueba_continuidad boolean not null
);

alter table public.feedback_responses enable row level security;

drop policy if exists "Service role manages feedback responses" on public.feedback_responses;
create policy "Service role manages feedback responses"
  on public.feedback_responses
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists feedback_responses_created_at_idx on public.feedback_responses(created_at desc);
create index if not exists feedback_responses_evaluado_email_idx on public.feedback_responses(evaluado_email);
create index if not exists feedback_responses_tipo_feedback_idx on public.feedback_responses(tipo_feedback);
