import { supabase } from './supabase';

export const IS_STATIC = false;
export const getExportedAt = () => Promise.resolve(null);

// ── Helpers ───────────────────────────────────────────────

function flattenDoc(doc) {
  // Arquivos da nova tabela document_files
  const files = (doc.document_files || [])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Backward compat: se não tem document_files mas tem file_path legado
  const legacyFile = (!files.length && doc.file_path)
    ? [{ id: null, file_path: doc.file_path, file_name: doc.file_name, file_size: doc.file_size, file_mime: doc.file_mime }]
    : [];

  return {
    ...doc,
    type_id:    String(doc.type_id ?? ''),
    type_label: doc.document_types?.label ?? '',
    type_icon:  doc.document_types?.icon  ?? '📄',
    type_color: doc.document_types?.color ?? '#6366f1',
    document_types: undefined,
    document_files: undefined,
    files: files.length ? files : legacyFile,
    // Mantém file_path legado para compatibilidade
    file_path: doc.file_path,
  };
}

function normalizeType(t) { return { ...t, id: String(t.id) }; }

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function uploadFile(file, userId, index = 0) {
  const ext  = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}.${ext}`;
  const { error } = await supabase.storage.from('documents').upload(path, file);
  if (error) throw new Error(error.message);
  return { path, name: file.name, size: file.size, mime: file.type };
}

// ── Repositórios ──────────────────────────────────────────

export const fetchRepositories = async () => {
  const [reposRes, docsRes] = await Promise.all([
    supabase.from('repositories').select('*').order('sort_order'),
    supabase.from('documents').select('repo_id, expiry_date'),
  ]);
  if (reposRes.error) throw new Error(reposRes.error.message);
  if (docsRes.error)  throw new Error(docsRes.error.message);

  const now = new Date();
  return reposRes.data.map(r => {
    const rDocs = docsRes.data.filter(d => d.repo_id === r.id);
    let validCount = 0, expiringCount = 0, expiredCount = 0;
    rDocs.forEach(d => {
      if (!d.expiry_date) { validCount++; return; }
      const days = Math.floor((new Date(d.expiry_date + 'T12:00:00') - now) / 86_400_000);
      if (days < 0)       expiredCount++;
      else if (days < 90) expiringCount++;
      else                validCount++;
    });
    return { ...r, docCount: rDocs.length, validCount, expiringCount, expiredCount };
  });
};

export const createRepository = async (name, color = '#f97316') => {
  const user = await getUser();
  const { data, error } = await supabase
    .from('repositories')
    .insert({ user_id: user.id, name, color, sort_order: 0 })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteRepository = async (id) => {
  const { data: docs } = await supabase
    .from('documents').select('file_path').eq('repo_id', id);
  const paths = (docs ?? []).map(d => d.file_path).filter(Boolean);
  if (paths.length) await supabase.storage.from('documents').remove(paths);
  await supabase.from('documents').delete().eq('repo_id', id);
  const { error } = await supabase.from('repositories').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const updateRepository = async (id, name) => {
  const { data, error } = await supabase
    .from('repositories').update({ name }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
};

// ── Tipos ─────────────────────────────────────────────────

export const fetchTypes = async () => {
  const { data, error } = await supabase
    .from('document_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return data.map(normalizeType);
};

// ── Documentos ────────────────────────────────────────────

const WITH_FILES    = '*, document_types(label,icon,color), document_files(id,file_path,file_name,file_size,file_mime,sort_order)';
const WITHOUT_FILES = '*, document_types(label,icon,color)';

async function selectDocs(query) {
  // Tenta com document_files; se a tabela não existir ainda, usa fallback
  const { data, error } = await query(WITH_FILES);
  if (error) {
    if (error.message?.includes('document_files') || error.code === '42P01') {
      const res = await query(WITHOUT_FILES);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    }
    throw new Error(error.message);
  }
  return data;
}

export const fetchDocuments = async (repoId) => {
  const data = await selectDocs(sel => {
    let q = supabase.from('documents').select(sel).order('updated_at', { ascending: false });
    if (repoId) q = q.eq('repo_id', repoId);
    return q;
  });
  return data.map(flattenDoc);
};

export const getDocument = async (id) => {
  const data = await selectDocs(sel =>
    supabase.from('documents').select(sel).eq('id', id).single()
  );
  return flattenDoc(Array.isArray(data) ? data[0] : data);
};

// Recebe { metadata, newFiles, removeFileIds } em vez de FormData
export const createDocument = async ({ metadata, newFiles = [] }) => {
  const user = await getUser();

  const docData = {
    user_id:     user.id,
    title:       metadata.title       || null,
    type_id:     Number(metadata.type_id) || null,
    repo_id:     Number(metadata.repo_id) || null,
    doc_number:  metadata.doc_number  || null,
    issuer:      metadata.issuer      || null,
    issue_date:  metadata.issue_date  || null,
    expiry_date: metadata.expiry_date || null,
    description: metadata.description || null,
  };

  const { data: doc, error } = await supabase
    .from('documents').insert(docData).select().single();
  if (error) throw new Error(error.message);

  await _uploadAndInsertFiles(newFiles, doc.id, user.id, 0);
  return getDocument(doc.id);
};

export const updateDocument = async (id, { metadata, newFiles = [], removeFileIds = [] }) => {
  const user = await getUser();

  // Remove arquivos marcados
  if (removeFileIds.length) {
    const { data: toRm } = await supabase
      .from('document_files').select('file_path').in('id', removeFileIds);
    const paths = (toRm || []).map(f => f.file_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('documents').remove(paths);
    await supabase.from('document_files').delete().in('id', removeFileIds);
  }

  // Conta arquivos existentes para sort_order
  const { count: existing } = await supabase
    .from('document_files').select('*', { count: 'exact', head: true }).eq('document_id', id);

  await _uploadAndInsertFiles(newFiles, id, user.id, existing || 0);

  const docData = {
    updated_at:  new Date().toISOString(),
    title:       metadata.title       || null,
    type_id:     Number(metadata.type_id) || null,
    repo_id:     Number(metadata.repo_id) || null,
    doc_number:  metadata.doc_number  || null,
    issuer:      metadata.issuer      || null,
    issue_date:  metadata.issue_date  || null,
    expiry_date: metadata.expiry_date || null,
    description: metadata.description || null,
  };

  const { error } = await supabase.from('documents').update(docData).eq('id', id);
  if (error) throw new Error(error.message);

  return getDocument(id);
};

// Faz upload de todos os arquivos e insere em lote na document_files
async function _uploadAndInsertFiles(files, documentId, userId, startOrder) {
  const validFiles = files.filter(f => f instanceof File && f.size > 0);
  if (!validFiles.length) return;

  // Upload paralelo (mais rápido; Storage do Supabase suporta concorrência)
  const results = await Promise.allSettled(
    validFiles.map((file, i) => uploadFile(file, userId, startOrder + i))
  );

  const rows = results
    .map((res, i) => res.status === 'fulfilled' ? {
      document_id: documentId,
      user_id:     userId,
      file_path:   res.value.path,
      file_name:   res.value.name,
      file_size:   res.value.size,
      file_mime:   res.value.mime,
      sort_order:  startOrder + i,
    } : null)
    .filter(Boolean);

  if (!rows.length) return;

  // Insert em lote (uma única chamada ao banco)
  const { error } = await supabase.from('document_files').insert(rows);
  if (error) console.error('document_files insert:', error.message);
}

export const deleteDocument = async (id) => {
  const { data: files } = await supabase
    .from('document_files').select('file_path').eq('document_id', id);
  const paths = (files || []).map(f => f.file_path).filter(Boolean);
  const { data: doc }  = await supabase.from('documents').select('file_path').eq('id', id).single();
  if (doc?.file_path && !paths.includes(doc.file_path)) paths.push(doc.file_path);
  if (paths.length) await supabase.storage.from('documents').remove(paths);
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// ── Arquivo ───────────────────────────────────────────────

export const getFileUrl = async (_id, filePath) => {
  if (!filePath) return null;
  const { data, error } = await supabase.storage
    .from('documents').createSignedUrl(filePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
};
