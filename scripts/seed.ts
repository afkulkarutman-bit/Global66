import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'people.db');
const JSON_PATH = path.join(process.cwd(), 'data', 'employees.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dni TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    cargo TEXT,
    sexo TEXT,
    salario_bruto REAL,
    area TEXT,
    centro_costo TEXT,
    pais TEXT,
    moneda TEXT,
    sueldo_local REAL,
    domicilio TEXT,
    fecha_ingreso TEXT,
    tipo_contrato TEXT,
    jefatura TEXT,
    email_global TEXT,
    email_personal TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const employees = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

const insert = db.prepare(`
  INSERT OR IGNORE INTO employees
    (dni, nombre, activo, cargo, sexo, salario_bruto, area, centro_costo, pais, moneda, sueldo_local, domicilio, fecha_ingreso, tipo_contrato, jefatura, email_global, email_personal)
  VALUES
    (@dni, @nombre, @activo, @cargo, @sexo, @salario_bruto, @area, @centro_costo, @pais, @moneda, @sueldo_local, @domicilio, @fecha_ingreso, @tipo_contrato, @jefatura, @email_global, @email_personal)
`);

const insertMany = db.transaction((emps: typeof employees) => {
  for (const e of emps) {
    insert.run({
      ...e,
      activo: e.activo ? 1 : 0,
      salario_bruto: e.salario_bruto ?? null,
      sueldo_local: e.sueldo_local ?? null,
      area: e.area || 'NA',
      centro_costo: e.centro_costo || 'NA',
      pais: e.pais || 'NA',
      moneda: e.moneda || 'NA',
      domicilio: e.domicilio || 'NA',
      fecha_ingreso: e.fecha_ingreso || 'NA',
      tipo_contrato: e.tipo_contrato || 'NA',
      jefatura: e.jefatura || 'NA',
      email_global: e.email_global || 'NA',
      email_personal: e.email_personal || 'NA',
      sexo: e.sexo || 'NA',
      cargo: e.cargo || 'NA',
    });
  }
});

insertMany(employees);

const count = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;
console.log(`Seeded ${count} employees into ${DB_PATH}`);
db.close();
