import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon?: React.ReactNode;
  progressPercent?: number;
  variant?: 'emerald' | 'amber' | 'crimson' | 'blue' | 'cyan';
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  progressPercent,
  variant = 'blue',
  loading = false,
}) => {
  const colorClass = variant === 'cyan' ? 'blue' : variant;
  const pct = typeof progressPercent === 'number' ? Math.min(100, Math.max(0, progressPercent)) : 0;

  return (
    <div className="stat-card">
      <div className="stat-top-row">
        <span className="stat-label-text">{label}</span>
        {icon && <div className="stat-icon-wrapper">{icon}</div>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div className="skeleton-box" style={{ height: '32px', width: '60%' }} />
          <div className="skeleton-box" style={{ height: '14px', width: '85%' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="stat-main-value">{value}</div>
          <div className="stat-subtext-detail">{subtext}</div>
        </div>
      )}

      {typeof progressPercent === 'number' && !loading && (
        <div className="stat-progress-track">
          <div
            className={`stat-progress-fill ${colorClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};
