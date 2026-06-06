import { useState, useEffect, useMemo, useCallback } from 'react';
import DocumentCard from './components/DocumentCard';
import DocumentModal from './components/DocumentModal';
import Dashboard from './components/Dashboard';
import RepoSelector from './components/RepoSelector';
import Sidebar from './components/Sidebar';
import * as api from './api';

const IS_STATIC = api.IS_STATIC;

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
  const [activeRepoId, setActiveRepoId] = useState(() => {
    const saved = localStorage.getItem('docvault_repo_id');
    return saved ? Number(saved) : null;
  });

  const [types, setTypes]       = useState([]);
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [view, setView]         = useState('docs');
  const [search, setSearch]     = useState('');
  const [activeType, setActiveType]     = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [modal, setModal]       = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [exportedAt, setExportedAt] = useState(null);

  useEffect(() => {
    if (IS_STATIC) api.getExportedAt().then(setExportedAt).catch(() => {});
  }, []);

  const activeRepo = repos.find(r => r.id === activeRepoId) ?? null;

  const loadRepos = useCallback(async () => {
    try { const data = await api.fetchRepositories(); setRepos(data); } catch {}
    finally { setReposLoaded(true); }
  }, []);

  useEffect(() => { loadRepos(); }, [loadRepos]);
  useEffect(() => { api.fetchTypes().then(setTypes).catch(() => {}); }, []);

  const loadDocs = useCallback(async () => {
    if (!activeRepoId) return;
    try {
      setLoading(true);
      setDocs(await api.fetchDocuments(activeRepoId));
      setError(null);
    } catch {
      setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 3001.');
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
    modal.mode === 'new' ? await api.createDocument(formData) : await api.updateDocument(modal.doc.id, formData);
    setModal(null);
    loadDocs();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este documento?')) return;
    await api.deleteDocument(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleSelectRepo = (repo) => {
    localStorage.setItem('docvault_repo_id', repo.id);
    setActiveRepoId(repo.id);
    setDocs([]); setView('docs'); setActiveType(''); setActiveStatus(''); setSearch('');
  };

  const handleSwitchRepo = () => {
    loadRepos();
    setActiveRepoId(null);
    localStorage.removeItem('docvault_repo_id');
  };

  const handleRenameRepo = async (id, name) => {
    const updated = await api.updateRepository(id, name);
    setRepos(prev => prev.map(r => r.id === updated.id ? { ...r, name: updated.name } : r));
  };

  const switchView = (v) => {
    setView(v); setActiveType(''); setActiveStatus(''); setSearch('');
    setMobileSearchOpen(false); setDrawerOpen(false);
  };

  if (!reposLoaded) return <div className="app-init"><div className="spinner" /></div>;

  if (!activeRepoId || !activeRepo) {
    return (
      <RepoSelector repos={repos} onSelect={handleSelectRepo} onRename={handleRenameRepo} />
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
          {/* Hambúrguer — só mobile */}
          <button className="tn-hamburger" onClick={() => setDrawerOpen(v => !v)} aria-label="Menu">
            <HamburgerIcon />
          </button>

          {/* Banner modo leitura */}
          {IS_STATIC && (
            <div className="static-badge">
              🔒 Leitura
              {exportedAt && (
                <span className="static-date">
                  {' '}· {new Date(exportedAt).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          )}

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

          {!IS_STATIC && (
            <button className="btn-primary" onClick={() => setModal({ mode: 'new' })}>
              + Adicionar
            </button>
          )}
          <div className="tn-avatar" onClick={!IS_STATIC ? handleSwitchRepo : undefined}
            title={IS_STATIC ? activeRepo.name : undefined}
            style={IS_STATIC ? { cursor: 'default' } : {}}>
            {activeRepo.name.charAt(0).toUpperCase()}
          </div>
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

      {/* ── MOBILE DRAWER ── */}
      <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
        <div className="drawer-panel">
          <div className="drawer-header">
            <div className="drawer-logo" style={{ background: activeRepo.color }}>
              {activeRepo.name.charAt(0).toUpperCase()}
            </div>
            <div className="drawer-title">
              <div className="drawer-app">DocVault</div>
              <div className="drawer-repo">{activeRepo.name}</div>
            </div>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>

          <div className="drawer-nav">
            <button className={`drawer-nav-btn${view === 'docs' ? ' active' : ''}`}
              onClick={() => switchView('docs')}>
              <DocsIcon /> Documentos
            </button>
            <button className={`drawer-nav-btn${view === 'dashboard' ? ' active' : ''}`}
              onClick={() => switchView('dashboard')}>
              <DashIcon /> Painel
            </button>
            {!IS_STATIC && (
              <button className="drawer-nav-btn drawer-add"
                onClick={() => { setDrawerOpen(false); setModal({ mode: 'new' }); }}>
                <PlusIcon /> Novo documento
              </button>
            )}
          </div>

          <div className="drawer-cats">
            <Sidebar
              types={types}
              typeCounts={typeCounts}
              activeType={activeType}
              onTypeSelect={t => {
                setActiveType(t); setSearch('');
                if (view !== 'docs') setView('docs');
                setDrawerOpen(false);
              }}
            />
          </div>
        </div>
      </div>

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
      <div className="docs-page">
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
              { icon: '📋', bg: 'rgba(79,70,229,0.08)',  color: '#818cf8', n: statusCounts.all,      lbl: 'Total'         },
              { icon: '✅', bg: 'rgba(16,185,129,0.10)', color: '#10b981', n: statusCounts.valid,    lbl: 'Válidos'       },
              { icon: '⏳', bg: 'rgba(245,158,11,0.10)', color: '#f59e0b', n: statusCounts.expiring, lbl: 'A vencer'      },
              { icon: '⚠️', bg: 'rgba(244,63,94,0.09)',  color: '#f43f5e', n: statusCounts.expired,  lbl: 'Vencidos'      },
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
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocs.length === 0 ? (
                          <tr>
                            <td colSpan={7}>
                              <EmptyState search={search} activeType={activeType} activeStatus={activeStatus}
                                onNew={() => setModal({ mode: 'new' })} />
                            </td>
                          </tr>
                        ) : filteredDocs.map(doc => (
                          <DocumentCard
                            key={doc.id}
                            doc={doc}
                            onEdit={() => setModal({ mode: 'edit', doc })}
                            onDelete={() => handleDelete(doc.id)}
                            onView={() => window.open(api.getFileUrl(doc.id, doc.file_path), '_blank')}
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
