import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon?: React.ReactNode;
  progressPercent?: number;
  variant?: 'emerald' | 'amber' | 'crimson' | 'blue' | 'cyan' | 'purple';
  loading?: boolean;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  progressPercent,
  variant = 'cyan',
  loading = false,
  onClick,
}) => {
  const pct = typeof progressPercent === 'number' ? Math.min(100, Math.max(0, progressPercent)) : 0;
  const fillVariant = variant === 'emerald' ? 'emerald' : variant === 'amber' ? 'amber' : variant === 'crimson' ? 'crimson' : '';

  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <div className="stat-card-icon-wrap">{icon}</div>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
          <div className="skeleton-shimmer" style={{ height: '32px', width: '55%' }} />
          <div className="skeleton-shimmer" style={{ height: '14px', width: '80%' }} />
        </div>
      ) : (
        <div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-subtext">{subtext}</div>
        </div>
      )}

      {typeof progressPercent === 'number' && !loading && (
        <div className="progress-track" style={{ marginTop: '10px' }}>
          <div
            className={`progress-fill ${fillVariant}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};
