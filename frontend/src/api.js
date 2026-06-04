/* Modo estático: lê data.json em vez de chamar a API Express */
export const IS_STATIC = import.meta.env.VITE_STATIC === '1';

const BASE = '/api';

// Cache dos dados estáticos (carregado uma vez)
let _cache = null;

async function staticData() {
  if (!_cache) {
    const res = await fetch('/data.json');
    if (!res.ok) throw new Error('data.json não encontrado');
    _cache = await res.json();
  }
  return _cache;
}

async function api(path, options = {}) {
  const res = await fetch(BASE + path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

// ── Repositórios ──────────────────────────────────────────

export const fetchRepositories = () => IS_STATIC
  ? staticData().then(d => d.repositories)
  : api('/repositories');

export const updateRepository = (id, name) =>
  api(`/repositories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

// ── Tipos ─────────────────────────────────────────────────

export const fetchTypes = () => IS_STATIC
  ? staticData().then(d => d.types)
  : api('/types');

// ── Documentos ────────────────────────────────────────────

export const fetchDocuments = (repoId) => IS_STATIC
  ? staticData().then(d =>
      repoId
        ? d.documents.filter(doc => String(doc.repo_id) === String(repoId))
        : d.documents
    )
  : api(`/documents${repoId ? `?repo_id=${repoId}` : ''}`);

export const getDocument = (id) => IS_STATIC
  ? staticData().then(d => d.documents.find(doc => String(doc.id) === String(id)))
  : api(`/documents/${id}`);

export const createDocument = (formData) =>
  api('/documents', { method: 'POST', body: formData });

export const updateDocument = (id, formData) =>
  api(`/documents/${id}`, { method: 'PUT', body: formData });

export const deleteDocument = (id) =>
  api(`/documents/${id}`, { method: 'DELETE' });

// ── Arquivo ───────────────────────────────────────────────

export const getFileUrl = (id) => `${BASE}/documents/${id}/file`;

// ── Data de exportação (modo estático) ───────────────────

export const getExportedAt = () => IS_STATIC
  ? staticData().then(d => d.exportedAt ?? null)
  : Promise.resolve(null);
