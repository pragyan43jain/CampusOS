import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Square,
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
      {/* 1. Header Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <Sparkles size={14} />
              <span>AUTOMATED ACADEMIC RADAR</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>BABY AI COPILOT</span>
            </div>
            <h2 className="hero-heading">AI Adaptive Study Planner</h2>
            <p className="hero-desc">
              Dynamic academic recovery and revision schedules calibrated against your verified VTOP attendance thresholds, deadlines, and internal scores.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ALL', 'HIGH', 'MEDIUM'] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL'
                  ? `All Targets (${tasks.length})`
                  : f === 'HIGH'
                  ? `High Priority (${highUrgencyCount})`
                  : 'Medium Priority'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Metrics Row */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Active Study Targets"
          value={activeCount}
          subtext={`${completedTaskIds.length} completed this cycle`}
          icon={<BrainCircuit size={18} />}
          variant="purple"
        />
        <MetricCard
          label="Critical Priority Deficit"
          value={highUrgencyCount}
          subtext={highUrgencyCount === 0 ? 'All subjects safely buffered' : 'Attendance or marks recovery'}
          icon={<AlertTriangle size={18} />}
          variant={highUrgencyCount === 0 ? 'emerald' : 'crimson'}
        />
        <MetricCard
          label="Projected Study Load"
          value={`${totalHours.toFixed(1)}h`}
          subtext="Optimal weekly revision load"
          icon={<Clock size={18} />}
          variant="cyan"
        />
      </div>

      {/* 3. AI Study Tasks Roadmap */}
      <div className="card">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <BrainCircuit size={19} color="var(--accent-purple)" />
              <span>Calibrated Study Roadmap &amp; Tasks ({filteredTasks.length})</span>
            </h3>
            <p className="card-description">
              Prioritized by impending CAT/FAT exam dates, assignment weights, and attendance recovery needs.
            </p>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <CheckCircle2 size={26} color="var(--success-emerald)" />
            </div>
            <div className="empty-state-title">No Pending Study Tasks</div>
            <p className="empty-state-desc">All current academic targets are completed and up to date.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredTasks.map((task) => {
              const isDone = completedTaskIds.includes(task.id);
              const isHigh = task.urgency.toUpperCase() === 'HIGH';

              return (
                <div
                  key={task.id}
                  style={{
                    padding: '20px 24px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-input)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
                    <button
                      onClick={() => toggleTaskDone(task.id)}
                      style={{ color: isDone ? 'var(--success-emerald)' : 'var(--text-muted)', cursor: 'pointer' }}
                      title={isDone ? 'Mark as active' : 'Mark as completed'}
                      aria-label="Toggle task status"
                    >
                      {isDone ? <CheckSquare size={22} /> : <Square size={22} />}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-purple)' }}>
                          {task.courseCode || task.subjectCode || 'SUBJECT'}
                        </span>
                        <span className={`status-badge ${isHigh ? 'critical' : 'warning'}`}>
                          {task.urgency} Priority
                        </span>
                        {(task.courseTitle || task.subjectTitle) && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            • {task.courseTitle || task.subjectTitle}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {task.headline}
                      </div>

                      <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                        {task.reason || task.actionReason || 'Academic priority task'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <Clock size={14} />
                      <span>{task.estimatedHours || 1.5}h estimated</span>
                    </div>

                    <span className={`status-badge ${isDone ? 'safe' : 'neutral'}`}>
                      {isDone ? 'Target Reached ✓' : 'In Progress'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
