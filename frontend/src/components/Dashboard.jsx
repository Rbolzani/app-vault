import { useMemo } from 'react';
import { getDocStatus, formatDate } from '../App';

export default function Dashboard({ docs, types }) {
  const stats = useMemo(() => {
    let valid = 0, expiring = 0, expired = 0, withFile = 0;
    docs.forEach(d => {
      const s = getDocStatus(d.expiry_date);
      if (s.cls === 'status-valid')    valid++;
      if (s.cls === 'status-expiring') expiring++;
      if (s.cls === 'status-expired')  expired++;
      if (d.file_path) withFile++;
    });
    return { total: docs.length, valid, expiring, expired, withFile };
  }, [docs]);

  const byType = useMemo(() =>
    types.map(t => ({ ...t, count: docs.filter(d => d.type_id === t.id).length })),
    [docs, types]
  );

  /* Alertas: vencidos primeiro, depois a vencer (ordenados por urgência) */
  const alertDocs = useMemo(() =>
    docs
      .filter(d => {
        const s = getDocStatus(d.expiry_date);
        return s.cls === 'status-expired' || s.cls === 'status-expiring';
      })
      .sort((a, b) => {
        const sa = getDocStatus(a.expiry_date);
        const sb = getDocStatus(b.expiry_date);
        if (sa.cls !== sb.cls)
          return sa.cls === 'status-expired' ? -1 : 1;
        return (sa.days ?? -999) - (sb.days ?? -999);
      }),
    [docs]
  );

  const recentDocs = useMemo(() =>
    [...docs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6),
    [docs]
  );

  const STATS = [
    { icon: '📁', label: 'Total',       value: stats.total,    color: '#c9a84c' },
    { icon: '✅', label: 'Válidos',     value: stats.valid,    color: '#22c55e' },
    { icon: '⏳', label: 'A vencer',    value: stats.expiring, color: '#f59e0b' },
    { icon: '❌', label: 'Vencidos',    value: stats.expired,  color: '#f43f5e' },
    { icon: '📎', label: 'Com arquivo', value: stats.withFile, color: '#a78bfa' },
  ];

  return (
    <div className="dashboard">
      <div className="dash-header">
        <p className="dash-subtitle">Visão geral dos seus documentos pessoais</p>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        {STATS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {alertDocs.length > 0 && (
        <div className="dash-alerts-section">
          <div className="dash-alerts-header">
            <span className="dash-alerts-icon">⚠</span>
            <h2 className="dash-alerts-title">Alertas</h2>
            <span className="dash-alerts-badge">{alertDocs.length}</span>
          </div>
          <div className="dash-alerts-list">
            {alertDocs.map(doc => {
              const s = getDocStatus(doc.expiry_date);
              const isExpired = s.cls === 'status-expired';
              return (
                <div key={doc.id} className={`dash-alert-item ${isExpired ? 'alert-expired' : 'alert-expiring'}`}>
                  <span className="dash-alert-icon">{doc.type_icon}</span>
                  <div className="dash-alert-info">
                    <span className="dash-alert-name">{doc.title}</span>
                    <span className="dash-alert-meta">{doc.type_label}</span>
                  </div>
                  <div className="dash-alert-right">
                    <span className="dash-alert-date">{formatDate(doc.expiry_date)}</span>
                    <span className={`status-badge ${s.cls}`}>
                      <span className="status-dot" />
                      {isExpired ? 'Vencido' : `${s.days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dash-body">
        {/* Documentos por tipo */}
        <div className="dash-section">
          <h2 className="dash-section-title">Documentos por tipo</h2>
          {stats.total === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum documento cadastrado ainda.</p>
          ) : (
            <div className="type-bars">
              {byType.map(t => (
                <div key={t.id} className="type-bar-row">
                  <div className="type-bar-label">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </div>
                  <div className="type-bar-track">
                    <div
                      className="type-bar-fill"
                      style={{
                        width: stats.total > 0 ? `${(t.count / stats.total) * 100}%` : '0%',
                        background: t.color,
                      }}
                    />
                  </div>
                  <span className="type-bar-count">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adicionados recentemente */}
        <div className="dash-section">
          <h2 className="dash-section-title">Adicionados recentemente</h2>
          {recentDocs.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum documento cadastrado ainda.</p>
          ) : (
            <div className="recent-list">
              {recentDocs.map(doc => {
                const rawDate = (doc.created_at || '').split('T')[0] || (doc.created_at || '').split(' ')[0];
                return (
                  <div key={doc.id} className="recent-item">
                    <span className="recent-type-dot" style={{ background: doc.type_color }} />
                    <span className="recent-title">{doc.title}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text2)', marginRight: 8 }}>
                      {doc.type_label}
                    </span>
                    <span className="recent-date">{formatDate(rawDate)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
