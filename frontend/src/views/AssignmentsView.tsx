import React, { useState } from 'react';
import { Assignment } from '../types';

interface AssignmentsViewProps {
  assignments: Assignment[];
  onToggleStatus: (id: string, currentStatus: 'Pending' | 'Submitted') => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  onToggleStatus,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'LMS' | 'TEAMS' | 'PENDING' | 'SUBMITTED'>('ALL');

  const filteredAssignments = assignments.filter((a) => {
    if (filter === 'LMS') return a.source === 'LMS';
    if (filter === 'TEAMS') return a.source === 'Teams';
    if (filter === 'PENDING') return a.status === 'Pending';
    if (filter === 'SUBMITTED') return a.status === 'Submitted';
    return true;
  });

  const pendingCount = assignments.filter((a) => a.status === 'Pending').length;
  const lmsCount = assignments.filter((a) => a.source === 'LMS' && a.status === 'Pending').length;
  const teamsCount = assignments.filter((a) => a.source === 'Teams' && a.status === 'Pending').length;

  return (
    <div className="page-content">
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Assignments & Submissions</h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Unified live sync from <b>VIT Moodle LMS</b> & <b>Microsoft Teams</b>.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={filter === 'ALL' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('ALL')}
          >
            All ({assignments.length})
          </button>
          <button
            className={filter === 'PENDING' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('PENDING')}
          >
            ⏳ Pending ({pendingCount})
          </button>
          <button
            className={filter === 'LMS' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('LMS')}
          >
            🌐 VIT LMS ({lmsCount})
          </button>
          <button
            className={filter === 'TEAMS' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('TEAMS')}
          >
            💜 MS Teams ({teamsCount})
          </button>
          <button
            className={filter === 'SUBMITTED' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('SUBMITTED')}
          >
            ✓ Submitted
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div style={{ background: 'var(--card-banner-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active LMS Uploads</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-color)', marginTop: '2px' }}>{lmsCount} Pending</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Moodle Digital Assignments</span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Teams Uploads</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{teamsCount} Pending</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Class Teams Channel Tasks</span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Weightage at Stake</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-amber)', marginTop: '2px' }}>
            {assignments.filter(a => a.status === 'Pending').reduce((acc, a) => acc + (a.weightage ?? a.weightagePercentage ?? 0), 0)}% Internal
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Marks towards continuous evaluation</span>
        </div>
      </div>

      {/* Assignments List */}
      <div className="assignments-container">
        {filteredAssignments.map((assignment) => {
          const isPending = assignment.status === 'Pending';
          const isLms = assignment.source === 'LMS';

          return (
            <div
              key={assignment.id}
              className="assignment-item-card"
              style={{
                borderColor: isPending && assignment.priority === 'Critical' ? 'var(--danger-border)' : 'var(--border-subtle)',
                background: isPending ? 'var(--bg-surface)' : 'rgba(0, 0, 0, 0.05)',
                opacity: isPending ? 1 : 0.75,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '16px',
                padding: '22px 24px',
              }}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={assignment.status === 'Submitted'}
                    onChange={() => onToggleStatus(assignment.id, assignment.status)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--brand-color)', marginTop: '4px', cursor: 'pointer' }}
                    title="Mark as Submitted / Pending"
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Platform Tag */}
                      <span
                        className={`assignment-source-badge ${assignment.source.toLowerCase()}`}
                        style={{
                          background: isLms ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                          color: isLms ? 'var(--brand-color)' : '#c084fc',
                          border: `1px solid ${isLms ? 'rgba(56, 189, 248, 0.3)' : 'rgba(192, 132, 252, 0.3)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 9px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                        }}
                      >
                        <span>{isLms ? '🌐' : '💜'}</span>
                        <span>Uploaded on {assignment.platformName}</span>
                      </span>

                      {/* Course Code */}
                      <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {assignment.courseCode}
                      </span>

                      {/* Priority Tag */}
                      {isPending && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: assignment.priority === 'Critical' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                            color: assignment.priority === 'Critical' ? 'var(--danger-crimson)' : 'var(--warning-amber)',
                          }}
                        >
                          {assignment.priority} Priority
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        fontSize: '1.12rem',
                        fontWeight: 700,
                        textDecoration: assignment.status === 'Submitted' ? 'line-through' : 'none',
                        color: assignment.status === 'Submitted' ? 'var(--text-muted)' : 'var(--text-primary)',
                      }}
                    >
                      {assignment.title}
                    </h3>

                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Course: <b>{assignment.courseTitle}</b> • Uploaded by <b>{assignment.faculty}</b>
                    </p>

                    {assignment.instructions && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                        📋 <b>Professor Instructions:</b> {assignment.instructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Meta Column */}
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isPending ? 'var(--warning-amber)' : 'var(--success-emerald)' }}>
                    {isPending ? `Due: ${assignment.dueDate} at ${assignment.dueTime}` : '✓ Submitted'}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Weightage: <b style={{ color: 'var(--text-primary)' }}>{assignment.weightage ?? assignment.weightagePercentage ?? 10}% of Grade</b>
                  </span>

                  {/* Direct Platform Submission Link Button */}
                  <a
                    href={assignment.platformUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                    style={{
                      fontSize: '0.78rem',
                      padding: '6px 12px',
                      textDecoration: 'none',
                      marginTop: '4px',
                      background: isLms ? 'var(--btn-primary-bg)' : '#9333ea',
                      color: isLms ? 'var(--btn-primary-text)' : '#ffffff',
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`Redirecting to submission portal on ${assignment.platformName}:\nURL: ${assignment.platformUrl}`);
                    }}
                  >
                    <span>{isLms ? '🌐 Open on VIT LMS' : '💜 Open on Teams'}</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
