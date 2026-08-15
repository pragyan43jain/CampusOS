import React, { useState } from 'react';
import { Course } from '../types';

interface AcademicsViewProps {
  courses: Course[];
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({ courses }) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'marks' | 'overview' | 'study-tools'>('marks');
  const [pomodoroRunning, setPomodoroRunning] = useState<boolean>(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(25 * 60);
  const [targetGrade, setTargetGrade] = useState<'S' | 'A' | 'B'>('S');

  // Filter courses based on dropdown
  const displayedCourses = selectedSubjectId === 'all' 
    ? courses 
    : courses.filter(c => c.id === selectedSubjectId);

  // Helper to compute overall marks percentage
  const calculateTotalInternalPercentage = (course: Course) => {
    if (!course.marks) return null;
    let scored = 0;
    let max = 0;
    if (course.marks.cat1) { scored += course.marks.cat1.scored; max += course.marks.cat1.max; }
    if (course.marks.cat2) { scored += course.marks.cat2.scored; max += course.marks.cat2.max; }
    if (course.marks.da1) { scored += course.marks.da1.scored; max += course.marks.da1.max; }
    if (course.marks.da2) { scored += course.marks.da2.scored; max += course.marks.da2.max; }
    if (course.marks.quiz) { scored += course.marks.quiz.scored; max += course.marks.quiz.max; }

    if (max === 0) return null;
    const percentage = Number(((scored / max) * 100).toFixed(1));
    return { scored, max, percentage };
  };

  // Performance feedback logic
  const getPerformanceFeedback = (percentage: number) => {
    if (percentage >= 75) {
      return {
        level: 'good',
        badge: '✓ Strong Performance (≥75%)',
        feedback: 'Great job! You are comfortably exceeding internal thresholds. On track for S/A grade.',
        color: 'var(--success-emerald)',
        bg: 'var(--success-bg)',
        border: 'var(--success-border)',
        needsStudyTools: false,
      };
    } else if (percentage >= 50) {
      return {
        level: 'warning',
        badge: '⚠ Do Better (50% - 75%)',
        feedback: 'Do better: Your marks are currently below 75%. Prioritize upcoming assignments and CAT-2 to lift your internal score into the A/S range.',
        color: 'var(--warning-amber)',
        bg: 'var(--warning-bg)',
        border: 'var(--warning-border)',
        needsStudyTools: false,
      };
    } else {
      return {
        level: 'critical',
        badge: '🚨 You Need to Work Hard (<50%)',
        feedback: 'You need to work hard: Critical deficit in internal assessments (<50%). Access the dedicated study tools & revision material below to recover your grade before the FAT final exam.',
        color: 'var(--danger-crimson)',
        bg: 'var(--danger-bg)',
        border: 'var(--danger-border)',
        needsStudyTools: true,
      };
    }
  };

  return (
    <div className="page-content">
      {/* Header & Section Navigation */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Academic Performance & Study Center</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            VTOP continuous assessment tracking, automatic grade recommendations, and contextual study tools.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className={activeTab === 'marks' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('marks')}
          >
            📊 Marks & Scores
          </button>
          <button
            className={activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('overview')}
          >
            📚 Courses & Attendance
          </button>
          <button
            className={activeTab === 'study-tools' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('study-tools')}
          >
            🛠 Study Tools Hub
          </button>
        </div>
      </div>

      {/* Subject Filter Dropdown Bar */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Select Subject:</span>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            style={{ background: 'var(--bg-surface-elevated)', color: '#fff', border: '1px solid var(--border-medium)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">📖 All Enrolled Subjects ({courses.length})</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Academic Year 2026 • Semester 4 • Direct VTOP Sync
        </span>
      </div>

      {/* MARKS & SCORECARD TAB */}
      {activeTab === 'marks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {displayedCourses.map((course) => {
            const stats = calculateTotalInternalPercentage(course);
            const feedback = stats ? getPerformanceFeedback(stats.percentage) : null;

            return (
              <div key={course.id} className="course-card" style={{ gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="course-code-tag">{course.code}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slot: <b>{course.slot}</b> • {course.credits} Credits</span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{course.title}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>👨‍🏫 {course.faculty} • 📍 {course.venue}</span>
                  </div>

                  {stats && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: feedback?.color }}>
                        {stats.percentage}%
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Internal Score: {stats.scored} / {stats.max} marks
                      </span>
                    </div>
                  )}
                </div>

                {/* Dynamic Smart Feedback Alert Banner */}
                {feedback && (
                  <div style={{ background: feedback.bg, border: `1px solid ${feedback.border}`, borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: feedback.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {feedback.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {feedback.feedback}
                      </p>
                    </div>
                  </div>
                )}

                {/* CONTEXTUAL STUDY TOOLS PANEL (SHOWN AUTOMATICALLY IF MARKS < 50%) */}
                {feedback?.needsStudyTools && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(17, 22, 34, 0.95) 100%)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🛠</span>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                          Recommended Remedial Study Tools for {course.code}
                        </h4>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--danger-bg)', color: 'var(--danger-crimson)', borderRadius: '4px', fontWeight: 700 }}>
                          HIGH PRIORITY RECOVERY
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Backend Integration Endpoint: <code>/api/academics/courses/{course.code}/materials</code>
                      </span>
                    </div>

                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Since your score is below 50%, utilize these course-specific study tools and preparation materials to target a safe pass and grade recovery in the FAT exam:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {/* Tool Item 1 */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            📖 {course.code} High-Yield Concept Sheets
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Core definitions, formulas & 2-mark question bank
                          </div>
                        </div>
                        <button
                          className="btn-outline"
                          style={{ fontSize: '0.75rem', padding: '6px 10px', width: 'fit-content' }}
                          onClick={() => alert(`[Backend Placeholder] Fetching study material PDF for ${course.code} from Spring Boot Backend!`)}
                        >
                          Access Study Material 📄
                        </button>
                      </div>

                      {/* Tool Item 2 */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            🎯 FAT Minimum Passing Marks
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Need <b style={{ color: 'var(--warning-amber)' }}>62+ / 100</b> in FAT to secure B Grade
                          </div>
                        </div>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.75rem', padding: '6px 10px', width: 'fit-content' }}
                          onClick={() => { setActiveTab('study-tools'); setTargetGrade('B'); }}
                        >
                          Open FAT Calculator ⚡
                        </button>
                      </div>

                      {/* Tool Item 3 */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ⏱ 25-Min Recovery Sprint
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Dedicated focus session for {course.title}
                          </div>
                        </div>
                        <button
                          className="btn-outline"
                          style={{ fontSize: '0.75rem', padding: '6px 10px', width: 'fit-content' }}
                          onClick={() => { setActiveTab('study-tools'); setPomodoroRunning(true); }}
                        >
                          Start Study Timer ⏱
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marks Table */}
                {course.marks ? (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      Assessment Breakdown
                    </h4>
                    <table className="marks-breakdown-table">
                      <thead>
                        <tr>
                          <th>Assessment</th>
                          <th>Score</th>
                          <th>Max Marks</th>
                          <th>Percentage</th>
                          <th>Weightage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.marks.cat1 && (
                          <tr>
                            <td><b>Continuous Assessment Test 1 (CAT-1)</b></td>
                            <td style={{ color: (course.marks.cat1.scored / course.marks.cat1.max) >= 0.75 ? 'var(--success-emerald)' : (course.marks.cat1.scored / course.marks.cat1.max) >= 0.5 ? 'var(--warning-amber)' : 'var(--danger-crimson)', fontWeight: 700 }}>
                              {course.marks.cat1.scored}
                            </td>
                            <td>{course.marks.cat1.max}</td>
                            <td>{((course.marks.cat1.scored / course.marks.cat1.max) * 100).toFixed(0)}%</td>
                            <td>{course.marks.cat1.weightage}%</td>
                          </tr>
                        )}
                        {course.marks.cat2 && (
                          <tr>
                            <td><b>Continuous Assessment Test 2 (CAT-2)</b></td>
                            <td style={{ color: (course.marks.cat2.scored / course.marks.cat2.max) >= 0.75 ? 'var(--success-emerald)' : (course.marks.cat2.scored / course.marks.cat2.max) >= 0.5 ? 'var(--warning-amber)' : 'var(--danger-crimson)', fontWeight: 700 }}>
                              {course.marks.cat2.scored}
                            </td>
                            <td>{course.marks.cat2.max}</td>
                            <td>{((course.marks.cat2.scored / course.marks.cat2.max) * 100).toFixed(0)}%</td>
                            <td>{course.marks.cat2.weightage}%</td>
                          </tr>
                        )}
                        {course.marks.da1 && (
                          <tr>
                            <td><b>Digital Assignment 1</b></td>
                            <td style={{ color: (course.marks.da1.scored / course.marks.da1.max) >= 0.75 ? 'var(--success-emerald)' : 'var(--warning-amber)', fontWeight: 700 }}>{course.marks.da1.scored}</td>
                            <td>{course.marks.da1.max}</td>
                            <td>{((course.marks.da1.scored / course.marks.da1.max) * 100).toFixed(0)}%</td>
                            <td>{course.marks.da1.weightage}%</td>
                          </tr>
                        )}
                        {course.marks.quiz && (
                          <tr>
                            <td><b>Online Quiz Assessment</b></td>
                            <td style={{ color: (course.marks.quiz.scored / course.marks.quiz.max) >= 0.75 ? 'var(--success-emerald)' : 'var(--warning-amber)', fontWeight: 700 }}>{course.marks.quiz.scored}</td>
                            <td>{course.marks.quiz.max}</td>
                            <td>{((course.marks.quiz.scored / course.marks.quiz.max) * 100).toFixed(0)}%</td>
                            <td>{course.marks.quiz.weightage}%</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    Continuous lab evaluation in progress. Grade assigned upon end-term practical FAT.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* COURSES & ATTENDANCE OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="courses-grid">
          {displayedCourses.map((course) => {
            const { attendance } = course;
            const isCritical = attendance.isCritical;

            return (
              <div key={course.id} className="course-card">
                <div className="course-header">
                  <div>
                    <span className="course-code-tag">{course.code}</span>
                    <h3 className="course-title">{course.title}</h3>
                    <span className="course-faculty">👨‍🏫 {course.faculty}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slot: <b>{course.slot}</b></span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem' }}>Attendance: <b>{attendance.attended} / {attendance.total} classes</b></span>
                    <span className={`attendance-percentage-pill ${isCritical ? 'critical' : 'safe'}`}>{attendance.percentage}%</span>
                  </div>
                  <div className="progress-track" style={{ marginBottom: '8px' }}>
                    <div className={`progress-fill ${isCritical ? 'crimson' : 'emerald'}`} style={{ width: `${attendance.percentage}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: isCritical ? 'var(--danger-crimson)' : 'var(--success-emerald)', fontWeight: 700 }}>
                      {isCritical ? `⚠ Below 75%: Attend next ${attendance.needToAttend} classes` : `✓ Safe to miss ${attendance.safeToMiss} classes`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STUDY TOOLS FEATURE TAB */}
      {activeTab === 'study-tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Tool 1: FAT Target Grade Estimator */}
          <div className="course-card" style={{ background: 'linear-gradient(135deg, #111622 0%, #172033 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Target Score Engine
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  🎯 FAT Final Exam Grade Estimator
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Calculate exact marks needed out of 100 in the Final Assessment Test (FAT) to achieve your target grade.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {(['S', 'A', 'B'] as const).map(g => (
                  <button
                    key={g}
                    className={targetGrade === g ? 'btn-primary' : 'btn-outline'}
                    style={{ fontSize: '0.85rem', padding: '6px 16px', fontWeight: 700 }}
                    onClick={() => setTargetGrade(g)}
                  >
                    Grade {g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '10px' }}>
              {courses.filter(c => c.marks).map(c => {
                const minFat = targetGrade === 'S' ? c.marks?.fatProjected?.minNeededForS || 80 : targetGrade === 'A' ? c.marks?.fatProjected?.minNeededForA || 68 : 55;
                return (
                  <div key={c.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-blue)', fontWeight: 700 }}>{c.code}</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '4px 0' }}>{c.title}</h4>
                    <div style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
                      Need in FAT (100M): <b style={{ fontSize: '1.1rem', color: 'var(--success-emerald)' }}>{minFat}+</b>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tool 2: Pomodoro Focus Timer */}
          <div className="course-card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Productivity Toolkit
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px' }}>
                ⏱ Active Focus Pomodoro Timer
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                25-minute deep focus sprints designed to master tough topics without burnout.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: pomodoroRunning ? 'var(--brand-blue)' : 'var(--text-primary)' }}>
                {Math.floor(pomodoroSeconds / 60)}:{(pomodoroSeconds % 60).toString().padStart(2, '0')}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-primary"
                  onClick={() => setPomodoroRunning(!pomodoroRunning)}
                >
                  {pomodoroRunning ? '⏸ Pause' : '▶ Start Focus'}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => { setPomodoroRunning(false); setPomodoroSeconds(25 * 60); }}
                >
                  ↺ Reset
                </button>
              </div>
            </div>
          </div>

          {/* Tool 3: Formula Sheets & Previous Year Questions */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px' }}>
              📚 Quick Formula Sheets & PYQ Question Banks
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[
                { title: 'DBMS Relational Algebra & Normalization Cheatsheet', code: 'CSE2004', type: 'PDF Formula Sheet', size: '2.4 MB' },
                { title: 'DAA Master Theorem & DP State Recurrence Guide', code: 'CSE2005', type: 'Formula Summary', size: '1.8 MB' },
                { title: 'Computer Networks IP Subnetting & Socket Cheatsheet', code: 'CSE2003', type: 'Quick Sheet', size: '1.2 MB' },
                { title: 'Linear Algebra Eigenvalues & Vector Spaces PYQs', code: 'MAT2001', type: '5-Year Solved PYQ', size: '4.5 MB' },
              ].map((doc, idx) => (
                <div key={idx} className="assignment-item-card" style={{ padding: '16px 20px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)', background: 'var(--brand-blue-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                      {doc.code}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '6px' }}>{doc.title}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.type} • {doc.size}</span>
                  </div>
                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    onClick={() => alert(`Opening Study Resource: ${doc.title}`)}
                  >
                    Open ↗
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
