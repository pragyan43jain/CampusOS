import React, { useState } from 'react';
import { AIStudyTask } from '../types';

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

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧠</span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>AI Adaptive Study Planner</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Autonomous academic task prioritization powered by live VTOP attendance, assignment deadlines, and exam schedules.
          </p>
        </div>

        {/* Urgency Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={filter === 'ALL' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('ALL')}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            className={filter === 'HIGH' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('HIGH')}
          >
            🚨 High Priority ({highUrgencyCount})
          </button>
          <button
            className={filter === 'MEDIUM' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setFilter('MEDIUM')}
          >
            ⚡ Medium Priority
          </button>
        </div>
      </div>

      {/* Hero Intelligence Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #111622 0%, #172033 100%)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 26px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
        }}
      >
        <div>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Target Focus Engine
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
            {tasks.length - completedTaskIds.length} Active Targets
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {completedTaskIds.length} completed this cycle
          </p>
        </div>

        <div>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--danger-crimson)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Urgent Attention
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-crimson)', marginTop: '4px' }}>
            {highUrgencyCount} Critical
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Low attendance & close deadlines
          </p>
        </div>

        <div>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--success-emerald)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Study Time Projected
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-emerald)', marginTop: '4px' }}>
            {tasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0).toFixed(1)} Hours
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Optimal weekly recovery schedule
          </p>
        </div>
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              className="course-card"
              style={{
                borderColor: isHigh ? 'var(--danger-border)' : 'var(--border-subtle)',
                background: isDone ? 'rgba(0,0,0,0.1)' : 'var(--bg-surface)',
                opacity: isDone ? 0.7 : 1,
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleTaskDone(task.id)}
                    style={{
                      width: '20px',
                      height: '20px',
                      accentColor: 'var(--brand-color)',
                      marginTop: '4px',
                      cursor: 'pointer',
                    }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span className="course-code-tag">{courseCode}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: isHigh ? 'var(--danger-bg)' : 'var(--brand-bg)',
                          color: isHigh ? 'var(--danger-crimson)' : 'var(--brand-color)',
                        }}
                      >
                        {taskType}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: isHigh ? 'var(--danger-bg)' : 'rgba(255,255,255,0.06)',
                          color: isHigh ? 'var(--danger-crimson)' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {task.urgency} Priority
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        textDecoration: isDone ? 'line-through' : 'none',
                        color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                      }}
                    >
                      {task.headline}
                    </h3>

                    {courseTitle && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Course: <b>{courseTitle}</b>
                      </div>
                    )}

                    <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                      {reason}
                    </p>
                  </div>
                </div>

                {/* Slot Recommendation */}
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Suggested Study Slot:</span>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--brand-color)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    ⏰ {task.suggestedSlot}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Est. Duration: <b>{task.estimatedHours}h</b>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIPlannerView;
