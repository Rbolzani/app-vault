const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDB, getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const ok = allowed.includes(file.mimetype);
    cb(ok ? null : new Error('Tipo de arquivo não permitido'), ok);
  },
});

// CORS só é necessário em desenvolvimento (em produção tudo é same-origin)
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || /^http:\/\/localhost(:\d+)?$/.test(origin)),
  }));
}
app.use(express.json());

initDB();
const db = getDB();

// ── Repositórios — listar com estatísticas ─────────────────────────────────
app.get('/api/repositories', (_req, res) => {
  const repos = db.prepare('SELECT * FROM repositories ORDER BY sort_order').all();
  const docs  = db.prepare('SELECT repo_id, expiry_date FROM documents').all();
  const now   = new Date();

  const result = repos.map(r => {
    const rDocs = docs.filter(d => d.repo_id === r.id);
    let validCount = 0, expiringCount = 0, expiredCount = 0;
    rDocs.forEach(d => {
      if (!d.expiry_date) { validCount++; return; }
      const days = Math.floor((new Date(d.expiry_date + 'T12:00:00') - now) / 86_400_000);
      if (days < 0)   expiredCount++;
      else if (days < 90) expiringCount++;
      else validCount++;
    });
    return { ...r, docCount: rDocs.length, validCount, expiringCount, expiredCount };
  });

  res.json(result);
});

// ── Repositórios — renomear ────────────────────────────────────────────────
app.put('/api/repositories/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  const existing = db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Repositório não encontrado' });

  db.prepare('UPDATE repositories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.id);
  res.json(repo);
});

// ── Tipos ──────────────────────────────────────────────────────────────────
app.get('/api/types', (_req, res) => {
  res.json(db.prepare('SELECT * FROM document_types ORDER BY sort_order').all());
});

// ── Documentos — listar (filtrado por repo) ────────────────────────────────
app.get('/api/documents', (req, res) => {
  const { repo_id } = req.query;
  const query = `
    SELECT d.*, t.label AS type_label, t.icon AS type_icon, t.color AS type_color
    FROM documents d
    LEFT JOIN document_types t ON d.type_id = t.id
    ${repo_id ? 'WHERE d.repo_id = ?' : ''}
    ORDER BY d.updated_at DESC
  `;
  const docs = repo_id
    ? db.prepare(query).all(repo_id)
    : db.prepare(query).all();
  res.json(docs);
});

// ── Documentos — buscar um ─────────────────────────────────────────────────
app.get('/api/documents/:id', (req, res) => {
  const doc = db.prepare(`
    SELECT d.*, t.label AS type_label, t.icon AS type_icon, t.color AS type_color
    FROM documents d
    LEFT JOIN document_types t ON d.type_id = t.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Não encontrado' });
  res.json(doc);
});

// ── Documentos — criar ─────────────────────────────────────────────────────
app.post('/api/documents', upload.single('file'), (req, res) => {
  const { title, type_id, repo_id, doc_number, issuer, issue_date, expiry_date, description } = req.body;

  if (!title?.trim() || !type_id) {
    return res.status(400).json({ error: 'Título e tipo são obrigatórios' });
  }

  const f = req.file;
  const result = db.prepare(`
    INSERT INTO documents (title, type_id, repo_id, doc_number, issuer, issue_date, expiry_date, description,
                           file_path, file_name, file_size, file_mime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(), type_id,
    repo_id ? Number(repo_id) : 1,
    doc_number || null, issuer || null,
    issue_date || null, expiry_date || null, description || null,
    f?.filename ?? null, f?.originalname ?? null, f?.size ?? null, f?.mimetype ?? null,
  );

  const doc = db.prepare(`
    SELECT d.*, t.label AS type_label, t.icon AS type_icon, t.color AS type_color
    FROM documents d LEFT JOIN document_types t ON d.type_id = t.id
    WHERE d.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(doc);
});

// ── Documentos — atualizar ─────────────────────────────────────────────────
app.put('/api/documents/:id', upload.single('file'), (req, res) => {
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Não encontrado' });

  const { title, type_id, repo_id, doc_number, issuer, issue_date, expiry_date, description, remove_file } = req.body;

  let { file_path, file_name, file_size, file_mime } = existing;

  if (req.file) {
    deleteUpload(file_path);
    file_path = req.file.filename;
    file_name = req.file.originalname;
    file_size = req.file.size;
    file_mime = req.file.mimetype;
  } else if (remove_file === 'true') {
    deleteUpload(file_path);
    file_path = file_name = file_size = file_mime = null;
  }

  db.prepare(`
    UPDATE documents SET
      title = ?, type_id = ?, repo_id = ?, doc_number = ?, issuer = ?,
      issue_date = ?, expiry_date = ?, description = ?,
      file_path = ?, file_name = ?, file_size = ?, file_mime = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? existing.title,
    type_id ?? existing.type_id,
    repo_id ? Number(repo_id) : (existing.repo_id ?? 1),
    doc_number !== undefined ? (doc_number || null) : existing.doc_number,
    issuer !== undefined ? (issuer || null) : existing.issuer,
    issue_date !== undefined ? (issue_date || null) : existing.issue_date,
    expiry_date !== undefined ? (expiry_date || null) : existing.expiry_date,
    description !== undefined ? (description || null) : existing.description,
    file_path, file_name, file_size, file_mime,
    req.params.id,
  );

  const doc = db.prepare(`
    SELECT d.*, t.label AS type_label, t.icon AS type_icon, t.color AS type_color
    FROM documents d LEFT JOIN document_types t ON d.type_id = t.id
    WHERE d.id = ?
  `).get(req.params.id);
  res.json(doc);
});

// ── Documentos — excluir ───────────────────────────────────────────────────
app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Não encontrado' });
  deleteUpload(doc.file_path);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Servir arquivo ─────────────────────────────────────────────────────────
app.get('/api/documents/:id/file', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc?.file_path) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const fp = path.join(UPLOADS_DIR, doc.file_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });

  res.setHeader('Content-Type', doc.file_mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
  res.sendFile(fp);
});

function deleteUpload(filename) {
  if (!filename) return;
  try {
    const fp = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {}
}

// Em produção, serve o frontend compilado
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  // Rota catch-all para SPA (não intercepta rotas /api/)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n✓  DocVault rodando em http://localhost:${PORT}\n`);
});
