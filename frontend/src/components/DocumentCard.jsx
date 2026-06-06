import { getDocStatus, formatDate } from '../App';

function getValidityInfo(issueDate, expiryDate) {
  if (!expiryDate) return { pct: null, color: '#10b981', label: '—' };
  const now    = new Date();
  const expiry = new Date(expiryDate + 'T12:00:00');
  const days   = Math.floor((expiry - now) / 86_400_000);
  if (days < 0) return { pct: 0, color: '#f43f5e', label: '0%' };
  if (issueDate) {
    const issue = new Date(issueDate + 'T12:00:00');
    const total = expiry - issue;
    if (total > 0) {
      const pct   = Math.max(0, Math.min(100, Math.round(((expiry - now) / total) * 100)));
      const color = pct > 40 ? '#10b981' : pct > 15 ? '#f59e0b' : '#f43f5e';
      return { pct, color, label: `${pct}%` };
    }
  }
  const pct   = Math.min(100, Math.max(0, Math.round((days / 365) * 100)));
  const color = days > 90 ? '#10b981' : days > 30 ? '#f59e0b' : '#f43f5e';
  return { pct, color, label: `${pct}%` };
}

function getUrgencyPill(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.floor((new Date(expiryDate + 'T12:00:00') - new Date()) / 86_400_000);
  if (days < 0)  return { label: 'Vencido',    cls: 'u-dead' };
  if (days < 90) return { label: `${days}d`,   cls: 'u-warn' };
  return null;
}

export default function DocumentCard({ doc, onRowClick }) {
  const status   = getDocStatus(doc.expiry_date);
  const validity = getValidityInfo(doc.issue_date, doc.expiry_date);
  const urgency  = getUrgencyPill(doc.expiry_date);

  const sCls   = status.cls === 'status-valid' ? 's-ok' : status.cls === 'status-expiring' ? 's-warn' : status.cls === 'status-expired' ? 's-dead' : 's-none';
  const sLabel = status.cls === 'status-valid' ? 'Válido' : status.cls === 'status-expiring' ? 'A vencer' : status.cls === 'status-expired' ? 'Vencido' : 'Sem data';
  const expCls = status.cls === 'status-expired' ? 'exp-dead' : status.cls === 'status-expiring' ? 'exp-warn' : 'exp-ok';

  return (
    <tr className="doc-row" onClick={onRowClick} title="Clique para opções">

      {/* Documento */}
      <td>
        <div className="doc-cell">
          <div className="doc-thumb">{doc.type_icon}</div>
          <div>
            <div className="doc-name">{doc.title}</div>
            {(doc.doc_number || doc.issuer) && (
              <div className="doc-meta">
                {[doc.doc_number, doc.issuer].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Categoria */}
      <td>
        <span className="cat-badge" style={{
          background: doc.type_color + '18',
          color:      doc.type_color,
          border:     `1px solid ${doc.type_color}38`,
        }}>
          <span className="cat-dot" style={{ background: doc.type_color }} />
          {doc.type_label}
        </span>
      </td>

      {/* Emitido em */}
      <td><span className="date-mono">{formatDate(doc.issue_date)}</span></td>

      {/* Vencimento */}
      <td>
        <div className={`exp-cell ${expCls}`}>
          <span>{doc.expiry_date ? formatDate(doc.expiry_date) : 'Indeterminado'}</span>
          {urgency && <span className={`urgency-pill ${urgency.cls}`}>{urgency.label}</span>}
        </div>
      </td>

      {/* Validade */}
      <td>
        <div className="validity-cell">
          <div className="v-bar">
            <div className="v-fill" style={{
              width:      validity.pct !== null ? `${validity.pct}%` : '100%',
              background: validity.color,
            }} />
          </div>
          <span className="v-pct" style={{
            color: validity.pct !== null && validity.pct < 40 ? validity.color : '#9ca3af',
          }}>
            {validity.label}
          </span>
        </div>
      </td>

      {/* Status */}
      <td>
        <span className={`status-pill ${sCls}`}>
          <span className="s-pulse" />
          {sLabel}
        </span>
      </td>

    </tr>
  );
}
