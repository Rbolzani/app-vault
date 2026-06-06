import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DocumentCard from './components/DocumentCard';
import DocumentModal from './components/DocumentModal';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import Sidebar from './components/Sidebar';
import { supabase } from './supabase';
import * as api from './api';

export function getDocStatus(expiryDate) {
  if (!expiryDate) return { label: 'Sem vencimento', cls: 'status-none' };
  const days = Math.floor((new Date(expiryDate + 'T12:00:00') - new Date()) / 86_400_000);
  if (days < 0)  return { label: 'Vencido',            cls: 'status-expired',  days };
  if (days < 90) return { label: `Vence em ${days}d`,  cls: 'status-expiring', days };
  return                 { label: 'Válido',             cls: 'status-valid',    days };
}

export function formatDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export default function App() {
  const [repos, setRepos]             = useState([]);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [activeRepoId, setActiveRepoId] = useState(null);

  const [types, setTypes]       = useState([]);
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [view, setView]         = useState('docs');
  const [search, setSearch]     = useState('');
  const [activeType, setActiveType]     = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [modal, setModal]       = useState(null);
  const [actionDoc, setActionDoc] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const docsPageRef = useRef(null);

  const activeRepo = repos.find(r => r.id === activeRepoId) ?? null;

  const loadRepos = useCallback(async () => {
    try { const data = await api.fetchRepositories(); setRepos(data); } catch {}
    finally { setReposLoaded(true); }
  }, []);

  useEffect(() => { loadRepos(); }, [loadRepos]);
  useEffect(() => { api.fetchTypes().then(setTypes).catch(() => {}); }, []);

  // Resetar scroll ao trocar filtro (evita scroll preso além do conteúdo)
  useEffect(() => {
    if (docsPageRef.current) docsPageRef.current.scrollTop = 0;
  }, [activeType, activeStatus, search]);

  // Mobile: seleciona primeira categoria automaticamente ao entrar em docs
  useEffect(() => {
    if (view === 'docs' && activeType === '' && types.length > 0 && window.innerWidth <= 768) {
      setActiveType(types[0].id);
    }
  }, [view, types.length]); // eslint-disable-line

  const loadDocs = useCallback(async () => {
    if (!activeRepoId) return;
    try {
      setLoading(true);
      setDocs(await api.fetchDocuments(activeRepoId));
      setError(null);
    } catch (e) {
      setError('Erro ao carregar documentos: ' + e.message);
    } finally { setLoading(false); }
  }, [activeRepoId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const filteredDocs = useMemo(() => {
    let r = docs;
    if (activeType)   r = r.filter(d => d.type_id === activeType);
    if (activeStatus) r = r.filter(d => getDocStatus(d.expiry_date).cls === `status-${activeStatus}`);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.issuer || '').toLowerCase().includes(q) ||
        (d.doc_number || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [docs, activeType, activeStatus, search]);

  const typeCounts = useMemo(() => {
    const c = {};
    docs.forEach(d => { c[d.type_id] = (c[d.type_id] || 0) + 1; });
    return c;
  }, [docs]);

  const statusCounts = useMemo(() => {
    let base = activeType ? docs.filter(d => d.type_id === activeType) : docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.issuer || '').toLowerCase().includes(q) ||
        (d.doc_number || '').toLowerCase().includes(q)
      );
    }
    return {
      all:      base.length,
      valid:    base.filter(d => getDocStatus(d.expiry_date).cls === 'status-valid').length,
      expiring: base.filter(d => getDocStatus(d.expiry_date).cls === 'status-expiring').length,
      expired:  base.filter(d => getDocStatus(d.expiry_date).cls === 'status-expired').length,
    };
  }, [docs, activeType, search]);

  const handleSave = async (formData) => {
    modal.mode === 'new'
      ? await api.createDocument(formData)
      : await api.updateDocument(modal.doc.id, formData);
    setModal(null);
    loadDocs();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este documento?')) return;
    await api.deleteDocument(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleView = async (id, filePath) => {
    try {
      const url = await api.getFileUrl(id, filePath);
      if (url) window.open(url, '_blank');
    } catch (e) {
      alert('Erro ao abrir arquivo: ' + e.message);
    }
  };

  const handleSelectRepo = (repo) => {
    setActiveRepoId(repo.id);
    setDocs([]); setView('docs'); setActiveType(''); setActiveStatus(''); setSearch('');
  };

  const handleSwitchRepo = () => {
    loadRepos();
    setActiveRepoId(null);
  };

  const handleRenameRepo = async (id, name) => {
    const updated = await api.updateRepository(id, name);
    setRepos(prev => prev.map(r => r.id === updated.id ? { ...r, name: updated.name } : r));
  };

  const handleCreateRepo = async (name, color) => {
    await api.createRepository(name, color);
    await loadRepos();
  };

  const handleDeleteRepo = async (id) => {
    try {
      await api.deleteRepository(id);
      setRepos(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert('Erro ao excluir repositório: ' + e.message);
    }
  };

  const switchView = (v) => {
    setView(v); setActiveType(''); setActiveStatus(''); setSearch('');
    setMobileSearchOpen(false);
  };

  const handleLogout = async () => {
    if (!window.confirm('Deseja sair da conta?')) return;
    await supabase.auth.signOut();
  };

  if (!reposLoaded) return <div className="app-init"><div className="spinner" /></div>;

  if (!activeRepoId || !activeRepo) {
    return (
      <RepoSelector
        repos={repos}
        onSelect={handleSelectRepo}
        onRename={handleRenameRepo}
        onCreate={handleCreateRepo}
        onDelete={handleDeleteRepo}
        onLogout={handleLogout}
      />
    );
  }

  const hasFilters = activeType || activeStatus || search;

  return (
    <div className="app">

      {/* ── TOP NAV ── */}
      <nav className="topnav">
        <div className="tn-brand" onClick={handleSwitchRepo} title="Trocar repositório">
          <div className="tn-logo" style={{ background: activeRepo?.color ?? '#4f46e5' }}>
            {activeRepo.name.charAt(0).toUpperCase()}
          </div>
          <span className="tn-name">DocVault</span>
        </div>

        <div className="tn-links">
          <button className={`tn-link ${view === 'docs' ? 'active' : ''}`} onClick={() => switchView('docs')}>
            Documentos
          </button>
          <button className={`tn-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => switchView('dashboard')}>
            Painel
          </button>
        </div>

        <div className="tn-right">
          <div className="tn-search">
            <span className="tn-search-ico">⌕</span>
            <input
              type="text"
              placeholder="Buscar documentos…"
              value={search}
              onChange={e => { setSearch(e.target.value); if (view !== 'docs') setView('docs'); }}
            />
            {search && <button className="tn-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          {/* Search icon only on mobile */}
          <button
            className="tn-search-toggle"
            onClick={() => setMobileSearchOpen(v => !v)}
            title="Buscar"
          >
            <SearchIcon />
          </button>

          <button className="btn-primary" onClick={() => setModal({ mode: 'new' })}>
            + Adicionar
          </button>

          <div className="tn-avatar" onClick={handleSwitchRepo} title="Trocar repositório">
            {activeRepo.name.charAt(0).toUpperCase()}
          </div>

          {/* Logout — só mobile (desktop usa avatar) */}
          <button className="tn-logout-mobile" onClick={handleLogout} title="Sair">
            <LogoutIcon />
          </button>
        </div>
      </nav>

      {/* ── MOBILE SEARCH BAR ── */}
      {mobileSearchOpen && (
        <div className="mobile-searchbar">
          <SearchIcon />
          <input
            autoFocus
            type="text"
            placeholder="Buscar documentos…"
            value={search}
            onChange={e => { setSearch(e.target.value); if (view !== 'docs') setView('docs'); }}
          />
          <button onClick={() => { setMobileSearchOpen(false); setSearch(''); }}>✕</button>
        </div>
      )}

      {/* ── BARRA DE CATEGORIAS (mobile, docs) ── */}
      {view === 'docs' && types.length > 0 && (
        <div className="mob-cat-bar">
          {types.map(t => (
            <button
              key={t.id}
              className={`mob-cat-btn${activeType === t.id ? ' active' : ''}`}
              onClick={() => { setActiveType(t.id); setSearch(''); }}
            >
              <span className="mob-cat-icon">{t.icon}</span>
              <span className="mob-cat-label">{t.label}</span>
              {(typeCounts[t.id] ?? 0) > 0 && (
                <span className="mob-cat-count">{typeCounts[t.id]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── PAINEL ── */}
      {view === 'dashboard' ? (
        <Dashboard docs={docs} types={types} />
      ) : (

      /* ── DOCS PAGE ── */
      <div className="docs-layout">
      <Sidebar
        types={types}
        typeCounts={typeCounts}
        activeType={activeType}
        onTypeSelect={t => { setActiveType(t); setSearch(''); }}
      />
      <div className="docs-page" ref={docsPageRef}>
        <div className="docs-inner">

          {/* Page header */}
          <div className="docs-header">
            <div>
              <div className="docs-eyebrow">Acervo pessoal</div>
              <h1 className="docs-title">{activeRepo.name}</h1>
              <p className="docs-sub">Gerencie, acompanhe e renove seus documentos importantes.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="a-stats">
            {[
              { icon: '📋', bg: 'rgba(79,70,229,0.08)',  color: '#818cf8', n: statusCounts.all,      lbl: 'Total'    },
              { icon: '✅', bg: 'rgba(16,185,129,0.10)', color: '#10b981', n: statusCounts.valid,    lbl: 'Válidos'  },
              { icon: '⏳', bg: 'rgba(245,158,11,0.10)', color: '#f59e0b', n: statusCounts.expiring, lbl: 'A vencer' },
              { icon: '⚠️', bg: 'rgba(244,63,94,0.09)',  color: '#f43f5e', n: statusCounts.expired,  lbl: 'Vencidos' },
            ].map(s => (
              <div key={s.lbl} className="a-stat-card">
                <div className="a-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div>
                  <div className="a-stat-num" style={{ color: s.color }}>{s.n}</div>
                  <div className="a-stat-lbl">{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Table container */}
          <div className="a-table-container">
            {error ? (
              <div className="error-banner">⚠️ {error}</div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="a-toolbar">
                  <span className="a-toolbar-title">Documentos</span>
                  <span className="a-toolbar-count">{filteredDocs.length}</span>
                  <div style={{ flex: 1 }} />
                  <div className="a-seg">
                    {[
                      { key: '',         label: 'Todos'    },
                      { key: 'valid',    label: 'Válidos'  },
                      { key: 'expiring', label: 'A vencer' },
                      { key: 'expired',  label: 'Vencidos' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        className={`a-seg-btn ${activeStatus === key ? 'on' : ''}`}
                        onClick={() => setActiveStatus(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {hasFilters && (
                    <button className="a-clear-btn"
                      onClick={() => { setActiveType(''); setActiveStatus(''); setSearch(''); }}>
                      ✕ Limpar
                    </button>
                  )}
                </div>

                {/* Table */}
                {loading ? (
                  <div className="loading-state"><div className="spinner" /> Carregando documentos...</div>
                ) : (
                  <div className="a-table-wrap">
                    <table className="a-table">
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Categoria</th>
                          <th>Emitido em</th>
                          <th>Vencimento</th>
                          <th>Validade</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocs.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              <EmptyState search={search} activeType={activeType} activeStatus={activeStatus}
                                onNew={() => setModal({ mode: 'new' })} />
                            </td>
                          </tr>
                        ) : filteredDocs.map(doc => (
                          <DocumentCard
                            key={doc.id}
                            doc={doc}
                            onRowClick={() => setActionDoc(doc)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                {!loading && filteredDocs.length > 0 && (
                  <div className="a-table-footer">
                    <span>
                      Mostrando <strong>{filteredDocs.length}</strong> de <strong>{docs.length}</strong> documentos
                      {hasFilters && ' com filtros aplicados'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </div>
      )}

      {/* ── BOTTOM NAV (mobile only) ── */}
      <nav className="bottom-nav">
        <button
          className={`bn-btn ${view === 'docs' ? 'bn-active' : ''}`}
          onClick={() => switchView('docs')}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span>Documentos</span>
        </button>

        <button className="bn-fab" onClick={() => setModal({ mode: 'new' })}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          className={`bn-btn ${view === 'dashboard' ? 'bn-active' : ''}`}
          onClick={() => switchView('dashboard')}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
          </svg>
          <span>Painel</span>
        </button>
      </nav>

      {actionDoc && (
        <DocActionMenu
          doc={actionDoc}
          onEdit={() => { setModal({ mode: 'edit', doc: actionDoc }); setActionDoc(null); }}
          onDelete={() => { handleDelete(actionDoc.id); setActionDoc(null); }}
          onClose={() => setActionDoc(null)}
        />
      )}

      {modal && (
        <DocumentModal
          mode={modal.mode}
          doc={modal.doc}
          types={types}
          repos={repos}
          defaultRepoId={activeRepoId}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function DocActionMenu({ doc, onEdit, onDelete, onClose }) {
  const [loading, setLoading] = useState('');
  const files = doc.files ?? [];

  const openUrl = async (filePath, fileName, action) => {
    setLoading(action + filePath);
    try {
      const url = await api.getFileUrl(null, filePath);
      if (action === 'view') {
        window.open(url, '_blank');
      } else if (action === 'save') {
        const a = document.createElement('a');
        a.href = url; a.download = fileName || doc.title;
        a.rel  = 'noopener noreferrer';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else if (action === 'share') {
        if (navigator.share) {
          await navigator.share({ title: doc.title, url });
        } else {
          await navigator.clipboard?.writeText(url);
          alert('Link copiado!');
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') alert('Erro: ' + e.message);
    } finally { setLoading(''); }
  };

  const hasFiles = files.length > 0;
  const singleFile = files.length === 1 ? files[0] : null;

  return (
    <div className="dam-overlay" onClick={loading ? undefined : onClose}>
      <div className="dam-panel" onClick={e => e.stopPropagation()}>
        <div className="dam-title">
          <span className="dam-icon">{doc.type_icon}</span>
          <span className="dam-name">{doc.title}</span>
        </div>

        <div className="dam-actions">
          {/* Arquivo único — mostra ações diretas */}
          {singleFile && (
            <>
              <button className="dam-btn" disabled={!!loading}
                onClick={() => openUrl(singleFile.file_path, singleFile.file_name, 'view')}>
                <EyeIcon /> Visualizar arquivo
              </button>
              <button className="dam-btn" disabled={!!loading}
                onClick={() => openUrl(singleFile.file_path, singleFile.file_name, 'save')}>
                <DownloadIcon /> {loading.startsWith('save') ? 'Salvando...' : 'Salvar no dispositivo'}
              </button>
              <button className="dam-btn" disabled={!!loading}
                onClick={() => openUrl(singleFile.file_path, singleFile.file_name, 'share')}>
                <ShareIcon /> {loading.startsWith('share') ? 'Compartilhando...' : 'Compartilhar'}
              </button>
            </>
          )}

          {/* Múltiplos arquivos — lista cada um */}
          {files.length > 1 && (
            <div className="dam-files">
              <div className="dam-files-label">Arquivos ({files.length})</div>
              {files.map((f, i) => (
                <div key={f.id ?? i} className="dam-file-row">
                  <span className="dam-file-icon">
                    {f.file_mime?.includes('pdf') ? '📄' : '🖼️'}
                  </span>
                  <span className="dam-file-name" title={f.file_name}>
                    {f.file_name || `Arquivo ${i + 1}`}
                  </span>
                  <div className="dam-file-btns">
                    <button title="Visualizar" disabled={!!loading}
                      onClick={() => openUrl(f.file_path, f.file_name, 'view')}>
                      <EyeIcon />
                    </button>
                    <button title="Salvar" disabled={!!loading}
                      onClick={() => openUrl(f.file_path, f.file_name, 'save')}>
                      <DownloadIcon />
                    </button>
                    <button title="Compartilhar" disabled={!!loading}
                      onClick={() => openUrl(f.file_path, f.file_name, 'share')}>
                      <ShareIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasFiles && <div className="dam-sep" />}

          <button className="dam-btn" onClick={onEdit} disabled={!!loading}>
            <EditIcon /> Editar documento
          </button>
          <button className="dam-btn dam-danger" onClick={onDelete} disabled={!!loading}>
            <TrashIcon /> Excluir documento
          </button>
        </div>
        <button className="dam-cancel" onClick={onClose} disabled={!!loading}>Cancelar</button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function EmptyState({ search, activeType, activeStatus, onNew }) {
  const hasFilter = search || activeType || activeStatus;
  return (
    <div className="empty-state">
      <div className="empty-icon">🗄️</div>
      <h3 className="empty-title">{hasFilter ? 'Nenhum resultado encontrado' : 'Nenhum documento ainda'}</h3>
      <p className="empty-desc">
        {hasFilter
          ? 'Tente ajustar os filtros ou a busca.'
          : 'Adicione seu primeiro documento para começar a organizar seus arquivos pessoais.'}
      </p>
      {!hasFilter && (
        <button className="btn-primary" onClick={onNew} style={{ marginTop: 20 }}>
          + Adicionar primeiro documento
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
