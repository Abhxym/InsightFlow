// Shared building blocks for the dashboard UI
import { BarChart3, Inbox } from 'lucide-react';

export const CHART_COLORS = ['#e2622f', '#f2a679', '#8e8e8e', '#5a5a5a', '#c9c9c9', '#b5451b'];
export const SENTIMENT_COLORS = { Positive: '#7bc67e', Neutral: '#9a9a9a', Negative: '#e5604f' };

export const axisProps = {
  stroke: '#5f5f5f',
  fontSize: 11,
  tickLine: false,
  axisLine: false
};

export const BrandMark = ({ size = 30 }) => (
  <span className="brand-mark" style={{ width: size, height: size }}>
    <BarChart3 size={size * 0.55} strokeWidth={2.5} />
  </span>
);

export const Card = ({ title, sub, action, className = '', children, style }) => (
  <div className={`card fade-up ${className}`} style={style}>
    {(title || action) && (
      <div className="card-head">
        <div>
          {title && <div className="card-title">{title}</div>}
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, unit, hint, delta, accent }) => (
  <div className={`card stat-card fade-up ${accent ? 'accent' : ''}`}>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="stat-icon">{Icon && <Icon size={17} />}</span>
      {delta !== undefined && delta !== null && (
        <span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}{typeof delta === 'number' ? '%' : ''}
        </span>
      )}
    </div>
    <div>
      <div className="metric">
        {value ?? '—'}
        {unit && value !== null && value !== undefined && <small>{unit}</small>}
      </div>
      <div className="metric-label" style={{ marginTop: 8 }}>{label}{hint && <> · {hint}</>}</div>
    </div>
  </div>
);

export const Segmented = ({ options, value, onChange }) => (
  <div className="segmented" role="tablist">
    {options.map(o => (
      <button
        key={o.value}
        role="tab"
        aria-selected={value === o.value}
        className={value === o.value ? 'active' : ''}
        onClick={() => onChange(o.value)}
      >
        {o.icon && <o.icon size={14} />}{o.label}
      </button>
    ))}
  </div>
);

export const ChartTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <div className="tip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tip-row">
          <span className="dot" style={{ background: p.color || p.payload?.fill || '#e2622f' }} />
          {p.name}: {p.value}{unit}
        </div>
      ))}
    </div>
  );
};

/** Circular progress ring — used for NPS/CSAT style scores */
export const Ring = ({ value, max = 100, size = 150, stroke = 12, color = '#e2622f', children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, (value ?? 0) / max));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2b2b2b" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
};

export const ProgressBar = ({ value, muted, thin }) => (
  <div className={`bar-track ${thin ? 'bar-thin' : ''}`}>
    <div className={`bar-fill ${muted ? 'muted' : ''}`} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </div>
);

export const Empty = ({ icon: Icon = Inbox, title, children }) => (
  <div className="empty">
    <Icon size={30} />
    <div style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>{title}</div>
    {children && <div style={{ fontSize: '0.84rem' }}>{children}</div>}
  </div>
);

/** Escape HTML, then render **bold** / *italic* / line breaks. Safe for LLM output. */
export const renderRichText = (text = '') =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

export const initials = (name = '') =>
  name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'U';

export const timeAgo = (date) => {
  if (!date) return 'No responses yet';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
