import { useState, useRef, useEffect } from 'react';

const EMPTY = {
  title: '', type_id: '', repo_id: '', doc_number: '', issuer: '',
  issue_date: '', expiry_date: '', description: '',
};

function fileIcon(mime) { return mime?.includes('pdf') ? '📄' : '🖼️'; }
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024)         return b + ' B';
  if (b < 1024 * 1024)  return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DocumentModal({ mode, doc, types, repos, defaultRepoId, onSave, onClose }) {
  const [form, setForm]                 = useState(EMPTY);
  const [existingFiles, setExisting]    = useState([]); // files from DB (edit mode)
  const [removeFileIds, setRemoveIds]   = useState([]); // existing file IDs to remove
  const [newFiles, setNewFiles]         = useState([]); // newly selected files
  const [dragActive, setDrag]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');
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
      setExisting(doc.files ?? []);
    } else {
      setForm({ ...EMPTY, type_id: types[0]?.id ?? '', repo_id: String(defaultRepoId ?? '') });
      setExisting([]);
    }
    setRemoveIds([]);
    setNewFiles([]);
    setSaveError('');
  }, [doc, types, defaultRepoId]);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const addFiles = (picked) => {
    const arr = Array.from(picked).filter(f => f.size <= 20 * 1024 * 1024);
    setNewFiles(prev => [...prev, ...arr]);
  };

  const removeExisting = (fileId) => {
    if (fileId !== null) setRemoveIds(prev => [...prev, fileId]);
    setExisting(prev => prev.filter(f => f.id !== fileId && f.file_path !== fileId));
  };

  const removeNew = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    addFiles(e.dataTransfer?.files ?? []);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim() || !form.type_id) return;
    setSaving(true); setSaveError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      newFiles.forEach(f => fd.append('files[]', f));
      removeFileIds.forEach(id => fd.append('remove_file_ids[]', String(id)));
      await onSave(fd);
    } catch (err) {
      setSaveError(err.message || 'Erro ao salvar.');
      setSaving(false);
    }
  };

  const hasFiles = existingFiles.length > 0 || newFiles.length > 0;

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
              <input ref={titleRef} className="form-input"
                placeholder="Ex: RG, Contrato de Aluguel, Apólice..."
                value={form.title} onChange={set('title')} required />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo <span className="required">*</span></label>
              <select className="form-select" value={form.type_id} onChange={set('type_id')} required>
                <option value="">Selecione...</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Repositório</label>
              <select className="form-select" value={form.repo_id} onChange={set('repo_id')}>
                {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Número / Código</label>
              <input className="form-input" placeholder="Número identificador"
                value={form.doc_number} onChange={set('doc_number')} />
            </div>

            <div className="form-group">
              <label className="form-label">Emissor / Órgão</label>
              <input className="form-input" placeholder="Ex: SSP-SP, Receita Federal..."
                value={form.issuer} onChange={set('issuer')} />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Emissão</label>
              <input className="form-input" type="date"
                value={form.issue_date} onChange={set('issue_date')} />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Validade</label>
              <input className="form-input" type="date"
                value={form.expiry_date} onChange={set('expiry_date')} />
            </div>

            <div className="form-group form-span2">
              <label className="form-label">Descrição / Observações</label>
              <textarea className="form-textarea" rows={3}
                placeholder="Informações adicionais..."
                value={form.description} onChange={set('description')} />
            </div>

            {/* ── Arquivos ── */}
            <div className="form-group form-span2">
              <label className="form-label">
                Arquivos
                {hasFiles && (
                  <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>
                    ({existingFiles.length + newFiles.length})
                  </span>
                )}
              </label>

              {/* Arquivos existentes (modo edição) */}
              {existingFiles.map(ef => (
                <div key={ef.id ?? ef.file_path} className="file-preview">
                  <span className="file-preview-icon">{fileIcon(ef.file_mime)}</span>
                  <span className="file-preview-name">{ef.file_name || 'arquivo'}</span>
                  {ef.file_size > 0 && (
                    <span className="file-preview-size">{fmtBytes(ef.file_size)}</span>
                  )}
                  <button type="button" className="file-preview-remove"
                    onClick={() => removeExisting(ef.id ?? ef.file_path)}>
                    <CloseIcon />
                  </button>
                </div>
              ))}

              {/* Novos arquivos selecionados */}
              {newFiles.map((f, i) => (
                <div key={i} className="file-preview file-preview-new">
                  <span className="file-preview-icon">{fileIcon(f.type)}</span>
                  <span className="file-preview-name">{f.name}</span>
                  <span className="file-preview-size">{fmtBytes(f.size)}</span>
                  <button type="button" className="file-preview-remove" onClick={() => removeNew(i)}>
                    <CloseIcon />
                  </button>
                </div>
              ))}

              {/* Dropzone para adicionar mais */}
              <div
                className={`dropzone ${dragActive ? 'dropzone-active' : ''} ${hasFiles ? 'dropzone-compact' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
              >
                <div className="dropzone-icon">{hasFiles ? '+' : '📂'}</div>
                <p className="dropzone-text">
                  <span className="dropzone-link">
                    {hasFiles ? 'Adicionar mais arquivos' : 'Clique para selecionar'}
                  </span>
                  {!hasFiles && ' ou arraste aqui'}
                </p>
                {!hasFiles && <p className="dropzone-hint">PDF, JPG ou PNG — máx. 20 MB por arquivo</p>}
                <input ref={fileInputRef} type="file" multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  onChange={e => addFiles(e.target.files)}
                />
              </div>
            </div>

          </div>

          {saveError && (
            <div className="error-banner" style={{ marginTop: 12, borderRadius: 6 }}>
              ⚠️ {saveError}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary"
              disabled={!form.title.trim() || !form.type_id || saving} style={{ display: 'flex' }}>
              {saving ? 'Salvando...' : mode === 'new' ? 'Adicionar Documento' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
