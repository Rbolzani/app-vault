#!/usr/bin/env node
/**
 * export-cloud.js
 * Lê o banco SQLite local e gera frontend/public/data.json
 * para ser servido pelo app estático no GitHub Pages.
 *
 * Uso: node scripts/export-cloud.js
 */
const path = require('path');
const fs   = require('fs');

const ROOT       = path.join(__dirname, '..');
const DB_MOD     = path.join(ROOT, 'backend', 'db');
const OUT_DIR    = path.join(ROOT, 'frontend', 'public');
const OUT        = path.join(OUT_DIR, 'data.json');
const SRC_UPL    = path.join(ROOT, 'backend', 'uploads');
const DEST_UPL   = path.join(OUT_DIR, 'uploads');

// Inicializa o banco (cria tabelas/seed se necessário)
const { initDB, getDB } = require(DB_MOD);
initDB();
const db = getDB();

// ── Exporta todos os dados ──────────────────────────────────
const repositories = db.prepare(
  'SELECT * FROM repositories ORDER BY sort_order'
).all();

const types = db.prepare(
  'SELECT * FROM document_types ORDER BY sort_order'
).all();

const documents = db.prepare(`
  SELECT d.*,
         t.label AS type_label,
         t.icon  AS type_icon,
         t.color AS type_color
  FROM documents d
  LEFT JOIN document_types t ON d.type_id = t.id
  ORDER BY d.updated_at DESC
`).all();

const payload = {
  exportedAt: new Date().toISOString(),
  repositories,
  types,
  documents,
};

fs.mkdirSync(OUT_DIR,  { recursive: true });
fs.mkdirSync(DEST_UPL, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));

// ── Copia arquivos PDF/anexos para frontend/public/uploads/ ──
let filesCopied = 0;
let filesMissing = 0;
for (const doc of documents) {
  if (!doc.file_path) continue;
  const src  = path.join(SRC_UPL, doc.file_path);
  const dest = path.join(DEST_UPL, doc.file_path);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    filesCopied++;
  } else {
    filesMissing++;
  }
}

const size = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('\n✓  DocVault — Exportação para nuvem concluída');
console.log(`   Repositórios : ${repositories.length}`);
console.log(`   Documentos   : ${documents.length}`);
console.log(`   Arquivos     : ${filesCopied} copiados${filesMissing ? `, ${filesMissing} não encontrados` : ''}`);
console.log(`   data.json    : ${size} KB\n`);
