export default function Sidebar({ types, typeCounts, activeType, onTypeSelect }) {
  return (
    <aside className="painel-sidebar">
      <div className="psb-label">Categorias</div>
      {types.map(t => (
        <button
          key={t.id}
          className={`psb-item ${activeType === t.id ? 'active' : ''}`}
          onClick={() => onTypeSelect(t.id)}
        >
          <span className="psb-icon">{t.icon}</span>
          <span className="psb-name">{t.label}</span>
          <span className="psb-count">{typeCounts[t.id] ?? 0}</span>
        </button>
      ))}
    </aside>
  );
}
