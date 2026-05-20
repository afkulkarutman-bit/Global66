import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'people.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
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
}

export type Employee = {
  id: number;
  dni: string;
  nombre: string;
  activo: number;
  cargo: string;
  sexo: string;
  salario_bruto: number | null;
  area: string;
  centro_costo: string;
  pais: string;
  moneda: string;
  sueldo_local: number | null;
  domicilio: string;
  fecha_ingreso: string;
  tipo_contrato: string;
  jefatura: string;
  email_global: string;
  email_personal: string;
  created_at: string;
  updated_at: string;
};
