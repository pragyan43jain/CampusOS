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
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>CampusOS AI Marks & Study Engine</h2>
          <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--brand-blue)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
            MARKS DEFICIT & MATERIAL ANALYZER
          </span>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          Our AI engine continuously evaluates your CAT and internal assessment marks. If your score drops below thresholds, it flags the course and provides instant access to study materials so you can work hard or work really hard to pass before the FAT exam.
        </p>
      </div>

      {/* Task Recommendations List */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Prioritized Marks Recovery & Study Actions</h3>
        <div className="assignments-container">
          {tasks.map((task) => {
            // Remap any old attendance categories to marks recovery
            const displayCategory = task.category === 'Attendance Risk' ? 'Marks Deficit Recovery' : task.category;
            const isHigh = task.urgency === 'HIGH' || task.category === 'Attendance Risk';
            
            // Rewrite headline / reason if it mentioned attendance
            const headline = task.headline.includes('Attendance') 
              ? task.headline.replace(/Critical Attendance Recovery.*?(?=\(|<|$)/i, 'Critical Internal Marks Recovery: Below 50% ')
              : task.headline;

            const reason = task.actionReason.includes('attend')
              ? 'Your internal score is critically low. You need to study this subject thoroughly and access the official revision notes to pass the FAT exam.'
              : task.actionReason;

            return (
              <div key={task.id} className="assignment-item-card" style={{ borderColor: isHigh ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: isHigh ? 'var(--danger-bg)' : 'var(--brand-blue-bg)', color: isHigh ? 'var(--danger-crimson)' : 'var(--brand-blue)' }}>
                      {displayCategory}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {task.subjectCode}
                    </span>
                    {isHigh && (
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--danger-bg)', color: 'var(--danger-crimson)', borderRadius: '4px', fontWeight: 700 }}>
                        WORK REALLY HARD TO PASS
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {headline}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '750px' }}>
                    {reason}
                  </p>

                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>⏱ Recommended Study Time: <b>{task.estimatedHours} Hours</b></span>
                    <span>📍 Suggested Slot: <b>{task.suggestedSlot}</b></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '8px 16px' }}
                    onClick={() => alert(`[Material Access] Opening downloadable lecture notes and solved PYQs for ${task.subjectCode} - ${task.subjectTitle}`)}
                  >
                    Access Study Material 📥
                  </button>
                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => alert(`Added ${task.estimatedHours}h marks recovery study block to your schedule`)}
                  >
                    Add Study Block 📅
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

export default AIPlannerView;
