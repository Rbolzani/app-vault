-- ══════════════════════════════════════════════════════════════
--  DocVault — Schema para Supabase
--  Execute este arquivo no SQL Editor do painel do Supabase.
-- ══════════════════════════════════════════════════════════════

-- ── Tabelas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repositories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#f97316',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_types (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug       TEXT,
  label      TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📄',
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_id     BIGINT REFERENCES repositories(id) ON DELETE SET NULL,
  type_id     BIGINT REFERENCES document_types(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  doc_number  TEXT,
  issuer      TEXT,
  issue_date  DATE,
  expiry_date DATE,
  description TEXT,
  file_path   TEXT,
  file_name   TEXT,
  file_size   BIGINT,
  file_mime   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (cada usuário vê só os próprios dados) ──

ALTER TABLE repositories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON repositories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own" ON document_types
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own" ON documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Storage: bucket "documents" ────────────────────────────────
-- Crie manualmente no painel: Storage → New bucket → "documents" → Private
-- Depois adicione as policies abaixo:

CREATE POLICY "User reads own files"
ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "User uploads own files"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "User updates own files"
ON storage.objects FOR UPDATE USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "User deletes own files"
ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
