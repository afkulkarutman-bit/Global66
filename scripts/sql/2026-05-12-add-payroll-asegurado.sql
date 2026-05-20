alter table payroll_employees
  add column if not exists asegurado numeric default 0;

update payroll_employees
set asegurado = 0
where asegurado is null;
