alter table employees
  add column if not exists presencialidad text default '4x1';

update employees
set presencialidad = '4x1'
where presencialidad is null
   or trim(presencialidad) = '';
