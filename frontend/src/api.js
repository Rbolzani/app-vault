import { supabase } from './supabase';

// Mantido para compatibilidade (sempre false agora)
export const IS_STATIC = false;
export const getExportedAt = () => Promise.resolve(null);

// ── Helpers ───────────────────────────────────────────────

function flattenDoc(doc) {
  return {
    ...doc,
    type_id:    String(doc.type_id ?? ''),
    type_label: doc.document_types?.label ?? '',
    type_icon:  doc.document_types?.icon  ?? '📄',
    type_color: doc.document_types?.color ?? '#6366f1',
    document_types: undefined,
  };
}

function normalizeType(t) {
  return { ...t, id: String(t.id) };
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Repositórios ──────────────────────────────────────────

export const fetchRepositories = async () => {
  const [reposRes, docsRes] = await Promise.all([
    supabase.from('repositories').select('*').order('sort_order'),
    supabase.from('documents').select('repo_id, expiry_date'),
  ]);
  if (reposRes.error) throw new Error(reposRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

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
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateRepository = async (id, name) => {
  const { data, error } = await supabase
    .from('repositories')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ── Tipos ─────────────────────────────────────────────────

export const fetchTypes = async () => {
  const { data, error } = await supabase
    .from('document_types')
    .select('*')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data.map(normalizeType);
};

// ── Documentos ────────────────────────────────────────────

export const fetchDocuments = async (repoId) => {
  let q = supabase
    .from('documents')
    .select('*, document_types(label, icon, color)')
    .order('updated_at', { ascending: false });
  if (repoId) q = q.eq('repo_id', repoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data.map(flattenDoc);
};

export const getDocument = async (id) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_types(label, icon, color)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return flattenDoc(data);
};

export const createDocument = async (formData) => {
  const user = await getUser();
  const file = formData.get('file');

  const docData = { user_id: user.id };
  for (const [k, v] of formData.entries()) {
    if (k === 'file') continue;
    if (k === 'type_id') { docData.type_id = Number(v) || null; continue; }
    if (k === 'repo_id') { docData.repo_id = Number(v) || null; continue; }
    docData[k] = v || null;
  }

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) throw new Error(upErr.message);
    docData.file_path = path;
    docData.file_name = file.name;
    docData.file_size = file.size;
    docData.file_mime = file.type;
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(docData)
    .select('*, document_types(label, icon, color)')
    .single();
  if (error) throw new Error(error.message);
  return flattenDoc(data);
};

export const updateDocument = async (id, formData) => {
  const user = await getUser();
  const file       = formData.get('file');
  const removeFile = formData.get('remove_file') === 'true';

  const docData = { updated_at: new Date().toISOString() };
  for (const [k, v] of formData.entries()) {
    if (k === 'file' || k === 'remove_file') continue;
    if (k === 'type_id') { docData.type_id = Number(v) || null; continue; }
    if (k === 'repo_id') { docData.repo_id = Number(v) || null; continue; }
    docData[k] = v || null;
  }

  const { data: existing } = await supabase
    .from('documents').select('file_path').eq('id', id).single();

  if (removeFile && existing?.file_path) {
    await supabase.storage.from('documents').remove([existing.file_path]);
    docData.file_path = docData.file_name = docData.file_size = docData.file_mime = null;
  }

  if (file && file.size > 0) {
    if (existing?.file_path) {
      await supabase.storage.from('documents').remove([existing.file_path]);
    }
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) throw new Error(upErr.message);
    docData.file_path = path;
    docData.file_name = file.name;
    docData.file_size = file.size;
    docData.file_mime = file.type;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(docData)
    .eq('id', id)
    .select('*, document_types(label, icon, color)')
    .single();
  if (error) throw new Error(error.message);
  return flattenDoc(data);
};

export const deleteDocument = async (id) => {
  const { data: doc } = await supabase
    .from('documents').select('file_path').eq('id', id).single();
  if (doc?.file_path) {
    await supabase.storage.from('documents').remove([doc.file_path]);
  }
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// ── Arquivo ───────────────────────────────────────────────

export const getFileUrl = async (_id, filePath) => {
  if (!filePath) return null;
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
};
