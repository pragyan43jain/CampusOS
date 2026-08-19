import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon: string;
  progressPercent?: number;
  variant?: 'emerald' | 'amber' | 'crimson' | 'blue';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  progressPercent,
  variant = 'blue',
}) => {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <span className="metric-label">{label}</span>
        <div className="metric-icon-wrap">{icon}</div>
      </div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        <span className="metric-subtext">{subtext}</span>
      </div>
      {typeof progressPercent === 'number' && (
        <div className="progress-track">
          <div
            className={`progress-fill ${variant}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
};
