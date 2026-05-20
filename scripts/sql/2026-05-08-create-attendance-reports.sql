create table if not exists attendance_reports (
  id uuid primary key,
  country text not null,
  year integer not null,
  month integer not null,
  month_name text not null,
  source_file text,
  sheet_name text,
  business_days integer not null default 0,
  holidays jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  unmatched jsonb not null default '[]'::jsonb,
  ai_review jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table attendance_reports
  add column if not exists ai_review jsonb not null default '{}'::jsonb;

create index if not exists attendance_reports_period_country_idx
  on attendance_reports (year, month, country);
