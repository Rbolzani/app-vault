import { useState } from 'react';

const PALETTE = [
  '#f97316', '#8b5cf6', '#3b82f6', '#10b981',
  '#ef4444', '#f59e0b', '#ec4899', '#6366f1',
];

export default function RepoSelector({ repos, onSelect, onRename, onCreate, onLogout }) {
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
          <p className="repo-sel-sub">Selecione ou crie um repositório</p>
          {onLogout && (
            <button className="repo-logout-btn" onClick={onLogout}>Sair</button>
          )}
        </header>

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
                  <button className="repo-rename-btn" tabIndex={-1}
                    onClick={e => startEdit(repo, e)} title="Renomear repositório">
                    <PencilIcon />
                  </button>
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

          {/* Formulário de criação inline */}
          {creating ? (
            <div className="repo-new-form" onClick={e => e.stopPropagation()}>
              <div className="rnf-palette">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    className={`rnf-color${newColor === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                    title={c}
                  />
                ))}
              </div>
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
                style={{ fontSize: 16, marginBottom: 4 }}
              />
              {error && <p style={{ color: '#f43f5e', fontSize: 12, margin: '4px 0' }}>{error}</p>}
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
                  {saving ? 'Criando…' : 'Criar repositório'}
                </button>
              </div>
            </div>
          ) : (
            <button className="repo-new-btn" onClick={openCreate}>
              <span className="rnb-plus">+</span>
              <span>Novo repositório</span>
            </button>
          )}
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

function ArrowIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
    </svg>
  );
}
