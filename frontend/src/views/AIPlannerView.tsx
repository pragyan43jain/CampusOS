import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { AIStudyTask } from '../types';
import { MetricCard } from '../components/MetricCard';

interface AIPlannerViewProps {
  tasks: AIStudyTask[];
}

export const AIPlannerView: React.FC<AIPlannerViewProps> = ({ tasks }) => {
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'OPTIMAL'>('ALL');
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    return t.urgency.toUpperCase() === filter;
  });

  const toggleTaskDone = (id: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const highUrgencyCount = tasks.filter((t) => t.urgency.toUpperCase() === 'HIGH').length;
  const activeCount = tasks.length - completedTaskIds.length;
  const totalHours = tasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div
        className="card"
        style={{
          background: 'var(--brand-gradient-soft)',
          border: '1px solid var(--border-medium)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge info" style={{ fontSize: '0.7rem' }}>
                Automated Intelligence
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Continuous assessment & attendance buffer prioritization
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              AI Adaptive Study Planner
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '640px' }}>
              Dynamic academic recovery and revision schedules calibrated against your verified VTOP attendance thresholds, deadlines, and internal scores.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ALL', 'HIGH', 'MEDIUM'] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? `All Targets (${tasks.length})` : f === 'HIGH' ? `High Priority (${highUrgencyCount})` : 'Medium Priority'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Active Targets"
          value={activeCount}
          subtext={`${completedTaskIds.length} completed this cycle`}
          icon={<BrainCircuit size={18} />}
          variant="blue"
        />
        <MetricCard
          label="Critical Priority"
          value={highUrgencyCount}
          subtext={highUrgencyCount === 0 ? 'All subjects in safe buffer' : 'Attendance or marks deficit'}
          icon={<AlertTriangle size={18} />}
          variant={highUrgencyCount === 0 ? 'emerald' : 'crimson'}
        />
        <MetricCard
          label="Projected Study Hours"
          value={`${totalHours.toFixed(1)}h`}
          subtext="Optimal weekly revision load"
          icon={<Clock size={18} />}
          variant="emerald"
        />
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Recommended Academic Actions
        </h3>

        {filteredTasks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredTasks.map((task) => {
              const isDone = completedTaskIds.includes(task.id);
              const courseCode = task.courseCode || task.subjectCode || 'ACADEMIC';
              const courseTitle = task.courseTitle || task.subjectTitle || '';
              const reason = task.reason || task.actionReason || '';
              const taskType = task.type || task.category || 'Study Task';
              const isHigh = task.urgency.toUpperCase() === 'HIGH';

              return (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    border: `1px solid ${isHigh ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                    background: isDone ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    opacity: isDone ? 0.75 : 1,
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleTaskDone(task.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--brand-color)',
                          marginTop: '3px',
                          cursor: 'pointer',
                        }}
                      />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: 'var(--brand-color)',
                              background: 'var(--brand-bg)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-xs)',
                              border: '1px solid var(--brand-border)',
                            }}
                          >
                            {courseCode}
                          </span>
                          <span className="status-badge neutral" style={{ fontSize: '0.7rem' }}>
                            {taskType}
                          </span>
                          <span className={`status-badge ${isHigh ? 'critical' : 'warning'}`} style={{ fontSize: '0.7rem' }}>
                            {task.urgency} Priority
                          </span>
                        </div>

                        <h4
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {task.headline}
                        </h4>

                        {courseTitle && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Course: <b>{courseTitle}</b>
                          </div>
                        )}

                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                          {reason}
                        </p>
                      </div>
                    </div>

                    {/* Slot Recommendation */}
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Suggested Slot:</span>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: 'var(--brand-color)',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-medium)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {task.suggestedSlot}
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Est. Duration: <b>{task.estimatedHours}h</b>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <Sparkles size={24} />
            </div>
            <h4 className="empty-state-title">No Pending Study Tasks</h4>
            <p className="empty-state-desc">
              All courses have adequate attendance margins and no critical assessment deficits are detected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPlannerView;
