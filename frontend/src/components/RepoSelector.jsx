import { useState } from 'react';

export default function RepoSelector({ repos, onSelect, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState('');

  const startEdit = (repo, e) => {
    e.stopPropagation(); e.preventDefault();
    setEditingId(repo.id); setEditName(repo.name);
  };

  const commitEdit = (id) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="repo-selector">

      <div className="repo-sel-inner">
        <header className="repo-sel-header">
          <div className="repo-sel-logo">DV</div>
          <h1 className="repo-sel-title">DocVault</h1>
          <p className="repo-sel-sub">Selecione o repositório para acessar</p>
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
