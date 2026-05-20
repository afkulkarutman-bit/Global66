alter table payroll_employees
  add column if not exists banco text,
  add column if not exists tipo_cuenta text,
  add column if not exists numero_cuenta text;
