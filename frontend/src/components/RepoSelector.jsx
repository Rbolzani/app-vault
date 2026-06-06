import { useState } from 'react';

const PALETTE = [
  '#f97316', '#8b5cf6', '#3b82f6', '#10b981',
  '#ef4444', '#f59e0b', '#ec4899', '#6366f1',
];

export default function RepoSelector({ repos, onSelect, onRename, onCreate, onDelete, onLogout }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState('');

  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(PALETTE[0]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const startEdit = (repo, e) => {
    e.stopPropagation(); e.preventDefault();
    setEditingId(repo.id); setEditName(repo.name);
  };

  const commitEdit = (id) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };

  const openCreate = () => {
    setNewName(''); setNewColor(PALETTE[0]); setError(''); setCreating(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true); setError('');
    try {
      await onCreate(newName.trim(), newColor);
      setCreating(false);
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="repo-selector">
      <div className="repo-sel-inner">

        <header className="repo-sel-header">
          <div className="repo-sel-logo">DV</div>
          <h1 className="repo-sel-title">DocVault</h1>
          <p className="repo-sel-sub">Selecione o repositório para acessar</p>

          {/* Botão sempre visível no cabeçalho */}
          <button className="repo-new-header-btn" onClick={openCreate}>
            <span>+</span> Novo repositório
          </button>

          {onLogout && (
            <button className="repo-logout-btn" onClick={onLogout}>Sair</button>
          )}
        </header>

        {/* Formulário de criação — aparece entre o cabeçalho e os cards */}
        {creating && (
          <div className="repo-new-form">
            <div className="rnf-row">
              <div className="rnf-preview" style={{ background: newColor }}>
                {newName ? newName.charAt(0).toUpperCase() : '?'}
              </div>
              <input
                className="repo-name-edit"
                placeholder="Nome do repositório"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
                autoFocus
                style={{ flex: 1, fontSize: 16 }}
              />
            </div>
            <div className="rnf-palette">
              {PALETTE.map(c => (
                <button
                  key={c}
                  className={`rnf-color${newColor === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            {error && <p style={{ color: '#f43f5e', fontSize: 12, margin: 0 }}>{error}</p>}
            <div className="rnf-btns">
              <button className="btn-secondary" onClick={() => setCreating(false)} disabled={saving}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                style={{ display: 'flex' }}
              >
                {saving ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        )}

        <div className="repo-cards">
          {repos.map((repo, i) => (
            <div
              key={repo.id}
              className="repo-card"
              style={{ '--rc': repo.color, animationDelay: `${i * 0.12 + 0.05}s` }}
              onClick={() => editingId !== repo.id && onSelect(repo)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && editingId !== repo.id && onSelect(repo)}
            >
              <div className="repo-card-bar" />
              <div className="repo-card-content">
                <div className="repo-card-head">
                  <div className="repo-avatar" style={{ background: repo.color }}>
                    {repo.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="repo-rename-btn" tabIndex={-1}
                      onClick={e => startEdit(repo, e)} title="Renomear repositório">
                      <PencilIcon />
                    </button>
                    <button className="repo-delete-btn" tabIndex={-1}
                      onClick={e => {
                        e.stopPropagation(); e.preventDefault();
                        if (window.confirm(`Excluir o repositório "${repo.name}"?\n\nTodos os documentos e arquivos deste repositório serão excluídos permanentemente.`)) {
                          onDelete(repo.id);
                        }
                      }}
                      title="Excluir repositório">
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {editingId === repo.id ? (
                  <input
                    className="repo-name-edit" value={editName} autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => commitEdit(repo.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(repo.id); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <h2 className="repo-name">{repo.name}</h2>
                )}

                <div className="repo-meta">
                  <span className="repo-doc-count">
                    {repo.docCount === 0
                      ? 'Nenhum documento ainda'
                      : `${repo.docCount} ${repo.docCount === 1 ? 'documento' : 'documentos'}`}
                  </span>
                  {repo.docCount > 0 && (
                    <div className="repo-status-row">
                      <span className="repo-badge repo-badge-green">✓ {repo.validCount}</span>
                      <span className="repo-badge repo-badge-amber">⚠ {repo.expiringCount}</span>
                      <span className="repo-badge repo-badge-red">✕ {repo.expiredCount}</span>
                    </div>
                  )}
                </div>

                <div className="repo-card-cta">
                  <span>Acessar</span>
                  <ArrowIcon />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
    </svg>
  );
}
