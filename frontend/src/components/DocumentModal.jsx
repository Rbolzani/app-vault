import { useState, useRef, useEffect } from 'react';

const EMPTY = {
  title: '', type_id: '', repo_id: '', doc_number: '', issuer: '',
  issue_date: '', expiry_date: '', description: '',
};

export default function DocumentModal({ mode, doc, types, repos, defaultRepoId, onSave, onClose }) {
  const [form, setForm]           = useState(EMPTY);
  const [file, setFile]           = useState(null);
  const [removeFile, setRemove]   = useState(false);
  const [dragActive, setDrag]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef();
  const titleRef     = useRef();

  useEffect(() => {
    if (doc) {
      setForm({
        title:       doc.title       ?? '',
        type_id:     doc.type_id     ?? '',
        repo_id:     String(doc.repo_id ?? defaultRepoId ?? ''),
        doc_number:  doc.doc_number  ?? '',
        issuer:      doc.issuer      ?? '',
        issue_date:  doc.issue_date  ?? '',
        expiry_date: doc.expiry_date ?? '',
        description: doc.description ?? '',
      });
    } else {
      setForm({ ...EMPTY, type_id: types[0]?.id ?? '', repo_id: String(defaultRepoId ?? '') });
    }
    setFile(null);
    setRemove(false);
    setSaveError('');
  }, [doc, types, defaultRepoId]);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const pickFile = f => {
    if (!f) return;
    setFile(f);
    setRemove(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    setDrag(false);
    pickFile(e.dataTransfer?.files?.[0]);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim() || !form.type_id) return;
    setSaving(true);
    setSaveError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);
      if (removeFile) fd.append('remove_file', 'true');
      await onSave(fd);
    } catch (err) {
      setSaveError(err.message || 'Erro ao salvar o documento.');
      setSaving(false);
    }
  };

  const showExisting = doc?.file_path && !removeFile && !file;
  const showNew      = !!file;
  const showFile     = showExisting || showNew;
  const displayName  = file?.name ?? doc?.file_name ?? '';
  const displaySize  = file ? file.size : (doc?.file_size ?? 0);
  const displayMime  = file ? file.type : (doc?.file_mime ?? '');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">
            {mode === 'new' ? 'Novo Documento' : 'Editar Documento'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-grid">

            <div className="form-group form-span2">
              <label className="form-label">Título <span className="required">*</span></label>
              <input
                ref={titleRef}
                className="form-input"
                placeholder="Ex: RG, Contrato de Aluguel, Apólice de Vida..."
                value={form.title}
                onChange={set('title')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo <span className="required">*</span></label>
              <select className="form-select" value={form.type_id} onChange={set('type_id')} required>
                <option value="">Selecione...</option>
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Repositório</label>
              <select className="form-select" value={form.repo_id} onChange={set('repo_id')}>
                {repos.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Número / Código</label>
              <input
                className="form-input"
                placeholder="Número identificador do documento"
                value={form.doc_number}
                onChange={set('doc_number')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Emissor / Órgão</label>
              <input
                className="form-input"
                placeholder="Ex: SSP-SP, Receita Federal..."
                value={form.issuer}
                onChange={set('issuer')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Emissão</label>
              <input className="form-input" type="date" value={form.issue_date} onChange={set('issue_date')} />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Validade</label>
              <input className="form-input" type="date" value={form.expiry_date} onChange={set('expiry_date')} />
            </div>

            <div className="form-group form-span2">
              <label className="form-label">Descrição / Observações</label>
              <textarea
                className="form-textarea"
                placeholder="Informações adicionais sobre este documento..."
                value={form.description}
                onChange={set('description')}
                rows={3}
              />
            </div>

            <div className="form-group form-span2">
              <label className="form-label">Arquivo (PDF, JPG, PNG)</label>
              {showFile ? (
                <div className="file-preview">
                  <span className="file-preview-icon">
                    {displayMime.includes('pdf') ? '📄' : '🖼️'}
                  </span>
                  <span className="file-preview-name">{displayName}</span>
                  {displaySize > 0 && (
                    <span className="file-preview-size">{fmtBytes(displaySize)}</span>
                  )}
                  <button
                    type="button"
                    className="file-preview-remove"
                    onClick={() => { setFile(null); setRemove(true); }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ) : (
                <div
                  className={`dropzone ${dragActive ? 'dropzone-active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={handleDrop}
                >
                  <div className="dropzone-icon">📂</div>
                  <p className="dropzone-text">
                    <span className="dropzone-link">Clique para selecionar</span> ou arraste aqui
                  </p>
                  <p className="dropzone-hint">PDF, JPG ou PNG — máx. 20 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={e => pickFile(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>

          </div>

          {saveError && (
            <div className="error-banner" style={{ marginTop: 12, borderRadius: 6 }}>
              ⚠️ {saveError}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!form.title.trim() || !form.type_id || saving}
            >
              {saving
                ? 'Salvando...'
                : mode === 'new'
                  ? 'Adicionar Documento'
                  : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fmtBytes(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function CloseIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
