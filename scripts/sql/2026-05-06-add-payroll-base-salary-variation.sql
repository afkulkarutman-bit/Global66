alter table payroll_employees
  add column if not exists variacion_salario_base numeric default 0;
