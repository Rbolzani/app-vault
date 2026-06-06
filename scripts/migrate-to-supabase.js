/**
 * Migra dados do SQLite local para o Supabase.
 *
 * Uso:
 *   set SUPABASE_URL=https://xxxx.supabase.co
 *   set SUPABASE_ANON_KEY=eyJ...
 *   node scripts/migrate-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const { DatabaseSync } = require('node:sqlite');
const fs   = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT        = path.join(__dirname, '..');
const DB_PATH     = path.join(ROOT, 'backend', 'data', 'docvault.db');
const UPLOADS_DIR = path.join(ROOT, 'backend', 'uploads');

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('\nConfigure as variáveis de ambiente antes de rodar:');
  console.error('  set SUPABASE_URL=https://xxxx.supabase.co');
  console.error('  set SUPABASE_ANON_KEY=eyJ...\n');
  process.exit(1);
}

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   DocVault → Migração para Supabase  ║');
  console.log('╚══════════════════════════════════════╝\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error('Banco de dados não encontrado em:', DB_PATH);
    process.exit(1);
  }

  const email    = await ask('E-mail (conta Supabase): ');
  const password = await ask('Senha: ');
  rl.close();

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\nAutenticando...');
  const { data: { session }, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    console.error('Falha na autenticação:', authError.message);
    process.exit(1);
  }
  const userId = session.user.id;
  console.log('✓ Autenticado como', email, '\n');

  const db = new DatabaseSync(DB_PATH);

  // ── Categorias ──────────────────────────────────────────────────────────
  console.log('Migrando categorias...');
  const types  = db.prepare('SELECT * FROM document_types ORDER BY sort_order').all();
  const typeMap = {};

  for (const t of types) {
    const { data, error } = await supabase
      .from('document_types')
      .insert({
        user_id:    userId,
        slug:       t.id,
        label:      t.label,
        icon:       t.icon,
        color:      t.color,
        sort_order: t.sort_order,
      })
      .select('id')
      .single();
    if (error) { console.error('  ✗', t.label, '—', error.message); continue; }
    typeMap[t.id] = data.id;
    console.log('  ✓', t.icon, t.label);
  }

  // ── Repositórios ────────────────────────────────────────────────────────
  console.log('\nMigrando repositórios...');
  const repos  = db.prepare('SELECT * FROM repositories ORDER BY sort_order').all();
  const repoMap = {};

  for (const r of repos) {
    const { data, error } = await supabase
      .from('repositories')
      .insert({
        user_id:    userId,
        name:       r.name,
        color:      r.color,
        sort_order: r.sort_order,
      })
      .select('id')
      .single();
    if (error) { console.error('  ✗', r.name, '—', error.message); continue; }
    repoMap[r.id] = data.id;
    console.log('  ✓', r.name);
  }

  // ── Documentos e arquivos ────────────────────────────────────────────────
  console.log('\nMigrando documentos...');
  const docs = db.prepare('SELECT * FROM documents ORDER BY created_at').all();
  let ok = 0, fail = 0;

  for (const doc of docs) {
    let filePath = null;

    if (doc.file_path) {
      const src = path.join(UPLOADS_DIR, doc.file_path);
      if (fs.existsSync(src)) {
        const ext   = path.extname(doc.file_path);
        const dest  = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
        const bytes = fs.readFileSync(src);
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(dest, bytes, { contentType: doc.file_mime || 'application/octet-stream' });
        if (!upErr) { filePath = dest; process.stdout.write('↑'); }
      }
    }

    const { error } = await supabase.from('documents').insert({
      user_id:     userId,
      repo_id:     repoMap[doc.repo_id] ?? null,
      type_id:     typeMap[doc.type_id] ?? null,
      title:       doc.title,
      doc_number:  doc.doc_number  || null,
      issuer:      doc.issuer      || null,
      issue_date:  doc.issue_date  || null,
      expiry_date: doc.expiry_date || null,
      description: doc.description || null,
      file_path:   filePath,
      file_name:   doc.file_name   || null,
      file_size:   doc.file_size   || null,
      file_mime:   doc.file_mime   || null,
      created_at:  doc.created_at,
      updated_at:  doc.updated_at,
    });

    if (error) { console.error('\n  ✗', doc.title, '—', error.message); fail++; }
    else { console.log(`  ✓ ${doc.title}`); ok++; }
  }

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Migração concluída!                 ║`);
  console.log(`║  ${ok} documentos migrados, ${fail} erros       ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
