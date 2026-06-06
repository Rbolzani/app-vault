-- ══════════════════════════════════════════════════════════════
--  DocVault — Migração: suporte a múltiplos arquivos por documento
--  Execute no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════

-- Nova tabela de arquivos
CREATE TABLE IF NOT EXISTS document_files (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path   TEXT   NOT NULL,
  file_name   TEXT,
  file_size   BIGINT,
  file_mime   TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON document_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Migra arquivos já existentes nos documentos para a nova tabela
INSERT INTO document_files (document_id, user_id, file_path, file_name, file_size, file_mime, sort_order)
SELECT id, user_id, file_path, file_name, file_size, file_mime, 0
FROM documents
WHERE file_path IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;
