const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'docvault.db');

let db;

function initDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#f97316',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS document_types (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      icon       TEXT NOT NULL,
      color      TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      type_id     TEXT NOT NULL REFERENCES document_types(id),
      repo_id     INTEGER DEFAULT 1 REFERENCES repositories(id),
      doc_number  TEXT,
      issuer      TEXT,
      issue_date  TEXT,
      expiry_date TEXT,
      description TEXT,
      file_path   TEXT,
      file_name   TEXT,
      file_size   INTEGER,
      file_mime   TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add repo_id to existing installations
  try { db.exec('ALTER TABLE documents ADD COLUMN repo_id INTEGER DEFAULT 1'); } catch {}
  db.exec("UPDATE documents SET repo_id = 1 WHERE repo_id IS NULL");

  // Seed repositories
  const { n: rn } = db.prepare('SELECT COUNT(*) AS n FROM repositories').get();
  if (rn === 0) {
    const ins = db.prepare('INSERT INTO repositories (name, color, sort_order) VALUES (?, ?, ?)');
    ins.run('Meus Documentos', '#f97316', 1);
    ins.run('Segundo Repositório', '#8b5cf6', 2);
  }

  // Seed document types
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM document_types').get();
  if (n === 0) {
    const ins = db.prepare('INSERT INTO document_types VALUES (?, ?, ?, ?, ?)');
    [
      ['identidade', 'Identidade', '🪪', '#6366f1', 1],
      ['contratos',  'Contratos',  '📋', '#f59e0b', 2],
      ['apolices',   'Apólices',   '🛡️',  '#10b981', 3],
      ['financeiro', 'Financeiro', '💳', '#3b82f6', 4],
      ['saude',      'Saúde',      '🏥', '#ef4444', 5],
      ['outros',     'Outros',     '📁', '#8b5cf6', 6],
    ].forEach(row => ins.run(...row));
  }
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
