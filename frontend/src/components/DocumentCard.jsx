import { getDocStatus, formatDate } from '../App';
import { IS_STATIC } from '../api';

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

export default function DocumentCard({ doc, onEdit, onDelete, onView }) {
  const status   = getDocStatus(doc.expiry_date);
  const validity = getValidityInfo(doc.issue_date, doc.expiry_date);
  const urgency  = getUrgencyPill(doc.expiry_date);

  const sCls   = status.cls === 'status-valid' ? 's-ok' : status.cls === 'status-expiring' ? 's-warn' : status.cls === 'status-expired' ? 's-dead' : 's-none';
  const sLabel = status.cls === 'status-valid' ? 'Válido' : status.cls === 'status-expiring' ? 'A vencer' : status.cls === 'status-expired' ? 'Vencido' : 'Sem data';

  const expCls = status.cls === 'status-expired' ? 'exp-dead' : status.cls === 'status-expiring' ? 'exp-warn' : 'exp-ok';

  return (
    <tr>
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
      <td>
        <span className="date-mono">{formatDate(doc.issue_date)}</span>
      </td>

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

      {/* Ações */}
      <td>
        <div className="row-actions" style={IS_STATIC ? { opacity: 1 } : {}}>
          {doc.file_path && (
            <button className="action-btn" title="Abrir arquivo" onClick={onView}><EyeIcon /></button>
          )}
          {!IS_STATIC && (
            <>
              <button className="action-btn" title="Editar" onClick={onEdit}><EditIcon /></button>
              <button className="action-btn action-btn-danger" title="Remover" onClick={onDelete}><TrashIcon /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
