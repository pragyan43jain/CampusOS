import React, { useState } from 'react';
import { Assignment } from '../types';

interface AssignmentsViewProps {
  assignments: Assignment[];
  onToggleStatus: (id: string, currentStatus: 'Pending' | 'Submitted') => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({ assignments, onToggleStatus }) => {
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Submitted'>('All');

  const filtered = assignments.filter((a) => {
    if (filter === 'All') return true;
    return a.status === filter;
  });

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Unified LMS & Microsoft Teams Assignments</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Consolidated view of coursework deadlines synchronized from campus portals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['All', 'Pending', 'Submitted'] as const).map((tab) => (
            <button
              key={tab}
              className={filter === tab ? 'btn-primary' : 'btn-outline'}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="assignments-container">
        {filtered.map((item) => {
          const isPending = item.status === 'Pending';
          return (
            <div key={item.id} className="assignment-item-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <input
                  type="checkbox"
                  checked={!isPending}
                  onChange={() => onToggleStatus(item.id, isPending ? 'Pending' : 'Submitted')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-blue)' }}
                />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`assignment-source-badge ${item.source.toLowerCase()}`}>
                      {item.source}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {item.courseCode}
                    </span>
                    {item.priority === 'Critical' && (
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--danger-bg)', color: 'var(--danger-crimson)', borderRadius: '4px', fontWeight: 700 }}>
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.02rem', fontWeight: 600, textDecoration: !isPending ? 'line-through' : 'none', color: !isPending ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {item.title}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {item.courseTitle}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isPending ? 'var(--warning-amber)' : 'var(--success-emerald)' }}>
                  Due {item.dueDate} at {item.dueTime}
                </div>
                {item.weightagePercentage && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Weightage: {item.weightagePercentage}%
                  </span>
                )}
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', marginTop: '6px' }}
                  onClick={() => alert(`Opening assignment portal for: ${item.title}`)}
                >
                  Open in {item.source} ↗
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
