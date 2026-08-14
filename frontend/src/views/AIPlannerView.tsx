import React from 'react';
import { AIStudyTask } from '../types';

interface AIPlannerViewProps {
  tasks: AIStudyTask[];
}

export const AIPlannerView: React.FC<AIPlannerViewProps> = ({ tasks }) => {
  return (
    <div className="page-content">
      {/* AI Header Box */}
      <div style={{ background: 'linear-gradient(135deg, #182030 0%, #0f172a 100%)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🧠</span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>CampusOS AI Priority Engine</h2>
          <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--brand-blue)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
            NEURAL TIMETABLE ANALYZER
          </span>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          Our Priority Engine analyzes your attendance thresholds, LMS deadlines, and CAT/FAT marks projections to generate an optimal daily focus plan so you never miss an attendance debarment cutoff or assignment deadline.
        </p>
      </div>

      {/* Task Recommendations List */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Prioritized Action Items for Today</h3>
        <div className="assignments-container">
          {tasks.map((task) => {
            const isHigh = task.urgency === 'HIGH';
            return (
              <div key={task.id} className="assignment-item-card" style={{ borderColor: isHigh ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: isHigh ? 'var(--danger-bg)' : 'var(--brand-blue-bg)', color: isHigh ? 'var(--danger-crimson)' : 'var(--brand-blue)' }}>
                      {task.category}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {task.subjectCode}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {task.headline}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '750px' }}>
                    {task.actionReason}
                  </p>

                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                    <span>⏱ Recommended Time: <b>{task.estimatedHours} Hours</b></span>
                    <span>📍 Suggested Slot: <b>{task.suggestedSlot}</b></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '8px 16px' }}
                    onClick={() => alert(`Starting focused study session for: ${task.headline}`)}
                  >
                    Start Focus Session ⚡
                  </button>
                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => alert(`Added ${task.estimatedHours}h block to Google Calendar / Outlook`)}
                  >
                    Add to Calendar 📅
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
