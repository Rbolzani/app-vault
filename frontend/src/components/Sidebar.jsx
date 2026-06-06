export default function Sidebar({ types, typeCounts, activeType, onTypeSelect }) {
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <aside className="docs-sidebar">
      <div className="psb-label">Categorias</div>

      <button
        className={`psb-item ${activeType === '' ? 'active' : ''}`}
        onClick={() => onTypeSelect('')}
      >
        <span className="psb-icon">📂</span>
        <span className="psb-name">Todos</span>
        <span className="psb-count">{total}</span>
      </button>

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
