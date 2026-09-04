export function StatCard({ label, value, suffix = '', decimals = 0, accent = false }) {
  const displayValue = typeof value === 'number' 
    ? value.toFixed(decimals)
    : value;

  return (
    <div className={`metric-card ${accent ? 'is-accent' : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value mono-text tabular-nums">
        {displayValue}
        {suffix && <span className="metric-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
