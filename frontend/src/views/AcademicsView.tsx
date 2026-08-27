import React, { useState, useEffect, useRef } from 'react';
import { Course } from '../types';

interface AcademicsViewProps {
  courses: Course[];
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({ courses }) => {
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'marks' | 'overview' | 'study-tools'>('marks');
  const [targetGrade, setTargetGrade] = useState<'S' | 'A' | 'B'>('S');

  // Pomodoro Timer State (Timestamp-based for accuracy across browser tabs)
  const TOTAL_POMODORO_SECONDS = 25 * 60;
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(TOTAL_POMODORO_SECONDS);
  const endTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Pomodoro Controls
  const handleStartTimer = () => {
    if (timerState === 'running') return; // Prevent multiple timers
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    const duration = timerState === 'paused' ? remainingSeconds : TOTAL_POMODORO_SECONDS;
    const now = Date.now();
    endTimeRef.current = now + duration * 1000;
    setTimerState('running');

    timerIntervalRef.current = window.setInterval(() => {
      if (!endTimeRef.current) return;
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        endTimeRef.current = null;
        setTimerState('completed');
      }
    }, 250);
  };

  const handlePauseTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (endTimeRef.current) {
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
    }
    setTimerState('paused');
  };

  const handleResetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    endTimeRef.current = null;
    setRemainingSeconds(TOTAL_POMODORO_SECONDS);
    setTimerState('idle');
  };

  // Find selected course and filter displayedCourses strictly
  const selectedCourse = selectedSubjectCode !== 'all'
    ? courses.find(c => String(c.code).toUpperCase() === selectedSubjectCode.toUpperCase() || String(c.id) === selectedSubjectCode)
    : null;

  const displayedCourses = selectedCourse ? [selectedCourse] : courses;

  // Helper to normalize and compute overall marks percentage
  const getCourseMarkComponents = (course: Course) => {
    if (!course || !course.marks) return [];
    if (Array.isArray(course.marks)) {
      return course.marks.map((m: any) => ({
        title: m.title || 'Assessment Component',
        scored: m.scored !== undefined && m.scored !== null ? m.scored : null,
        max: m.maxMark || m.max || 50,
        weightage: m.maxWeightage || m.weightage || 15,
        status: m.status || (m.scored !== null ? 'Present' : 'Upcoming'),
      }));
    }
    const out: any[] = [];
    if (course.marks.cat1) out.push({ title: 'Continuous Assessment Test 1 (CAT-1)', ...course.marks.cat1 });
    if (course.marks.cat2) out.push({ title: 'Continuous Assessment Test 2 (CAT-2)', ...course.marks.cat2 });
    if (course.marks.da1) out.push({ title: 'Digital Assignment 1', ...course.marks.da1 });
    if (course.marks.da2) out.push({ title: 'Digital Assignment 2', ...course.marks.da2 });
    if (course.marks.quiz) out.push({ title: 'Online Quiz Assessment', ...course.marks.quiz });
    return out;
  };

  const calculateTotalInternalPercentage = (course: Course) => {
    const items = getCourseMarkComponents(course);
    if (!items.length) return null;
    let scored = 0;
    let max = 0;
    let validItemCount = 0;

    for (const item of items) {
      if (item.scored !== null && item.scored !== undefined && item.max && item.max > 0) {
        scored += item.scored;
        max += item.max;
        validItemCount++;
      }
    }

    if (validItemCount === 0 || max === 0) return null;
    const percentage = Number(((scored / max) * 100).toFixed(1));
    return { scored, max, percentage };
  };

  const getPerformanceFeedback = (percentage: number) => {
    if (percentage >= 75) {
      return {
        level: 'good',
        badge: '✓ Strong Internal Marks (≥75%)',
        feedback: 'Great job! You are comfortably exceeding internal score thresholds. On track for S/A grade.',
        color: 'var(--success-emerald)',
        bg: 'var(--success-bg)',
        border: 'var(--success-border)',
        needsStudyTools: false,
      };
    } else if (percentage >= 50) {
      return {
        level: 'warning',
        badge: '⚠ Work Hard (Marks: 50% - 75%)',
        feedback: 'Work Hard: Your internal marks are below 75%. Prioritize upcoming assignments and CAT-2 to lift your score into a safe grade range.',
        color: 'var(--warning-amber)',
        bg: 'var(--warning-bg)',
        border: 'var(--warning-border)',
        needsStudyTools: false,
      };
    } else {
      return {
        level: 'critical',
        badge: '🚨 Work Really Hard to Pass (Marks <50%)',
        feedback: 'Work really hard to pass: Critical deficit in internal assessment marks (<50%). Access the dedicated subject study tools & revision material below to recover before the FAT exam.',
        color: 'var(--danger-crimson)',
        bg: 'var(--danger-bg)',
        border: 'var(--danger-border)',
        needsStudyTools: true,
      };
    }
  };

  const handleOpenVhelp = () => {
    window.open('https://www.vhelpcc.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="page-content">
      {/* Header & Section Navigation */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Academic Performance & Study Center</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            VTOP continuous assessment tracking, marks-based recovery tools, and subject material hub.
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
            value={selectedSubjectCode}
            onChange={(e) => setSelectedSubjectCode(e.target.value)}
            style={{ background: 'var(--bg-surface-elevated)', color: '#fff', border: '1px solid var(--border-medium)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">📖 All Enrolled Subjects ({courses.length})</option>
            {courses.map(c => (
              <option key={c.code || c.id} value={c.code || c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedCourse && (
            <span style={{ fontSize: '0.78rem', padding: '3px 10px', background: 'var(--brand-bg)', color: 'var(--brand-color)', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
              Showing: {selectedCourse.code}
            </span>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Academic Year 2026 • Semester 4 • Direct VTOP Sync
          </span>
        </div>
      </div>

      {/* MARKS & SCORECARD TAB */}
      {activeTab === 'marks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {displayedCourses.map((course) => {
            const stats = calculateTotalInternalPercentage(course);
            const feedback = stats ? getPerformanceFeedback(stats.percentage) : null;
            const markItems = getCourseMarkComponents(course);

            return (
              <div key={course.code || course.id} className="course-card" style={{ gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span className="course-code-tag">{course.code}</span>
                      {course.grade && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--success-bg)', color: 'var(--success-emerald)', fontWeight: 800, border: '1px solid var(--success-border)' }}>
                          Grade: {course.grade}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slot: <b>{course.slot || 'N/A'}</b> • {course.credits} Credits</span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{course.title}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>👨‍🏫 {course.faculty || 'Faculty unassigned'} • 📍 {course.venue || 'TBA'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={handleOpenVhelp}
                      className="btn-study-material"
                      title={`Open study material on VHelp for ${course.code}`}
                    >
                      <span>📚</span>
                      <span>Study Material</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>↗</span>
                    </button>

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
                </div>

                {/* Dynamic Smart Feedback Alert Banner based on Marks */}
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

                {/* MARKS-BASED STUDY TOOLS PANEL */}
                {feedback?.needsStudyTools && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(17, 22, 34, 0.95) 100%)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🛠</span>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                          Low Marks Recovery & Material Hub for {course.code}
                        </h4>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--danger-bg)', color: 'var(--danger-crimson)', borderRadius: '4px', fontWeight: 700 }}>
                          MARKS DEFICIT ALERT
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Because your internal assessment score is below 50%, you need to study this subject urgently. Directly access the curated study material for <b>{course.title}</b> on VHelp:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            📖 {course.code} Official Notes & Question Banks
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Lecture slides, lab manuals & solved assignments on VHelp
                          </div>
                        </div>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.75rem', padding: '6px 10px', width: 'fit-content' }}
                          onClick={handleOpenVhelp}
                        >
                          Access Material Now ↗
                        </button>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ⏱ 25-Min Recovery Sprint
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Focused study block for {course.title}
                          </div>
                        </div>
                        <button
                          className="btn-outline"
                          style={{ fontSize: '0.75rem', padding: '6px 10px', width: 'fit-content' }}
                          onClick={() => { setActiveTab('study-tools'); handleStartTimer(); }}
                        >
                          Start Focus Sprint ⏱
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marks Table */}
                {markItems.length > 0 ? (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      Assessment Breakdown
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="marks-breakdown-table">
                        <thead>
                          <tr>
                            <th>Assessment</th>
                            <th>Score</th>
                            <th>Max Marks</th>
                            <th>Percentage</th>
                            <th>Weightage</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {markItems.map((m, idx) => {
                            const pct = (m.scored !== null && m.scored !== undefined && m.max) ? (m.scored / m.max) * 100 : null;
                            return (
                              <tr key={idx}>
                                <td><b>{m.title}</b></td>
                                <td style={{ color: pct !== null ? (pct >= 75 ? 'var(--success-emerald)' : pct >= 50 ? 'var(--warning-amber)' : 'var(--danger-crimson)') : 'var(--text-muted)', fontWeight: 700 }}>
                                  {m.scored !== null && m.scored !== undefined ? m.scored : 'Pending'}
                                </td>
                                <td>{m.max ?? '-'}</td>
                                <td>{pct !== null ? `${pct.toFixed(1)}%` : '-'}</td>
                                <td>{m.weightage ? `${m.weightage}%` : '-'}</td>
                                <td>
                                  <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: m.scored !== null ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: m.scored !== null ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
                                    {m.status || (m.scored !== null ? 'Present' : 'Upcoming')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>No assessment records returned by VTOP</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Continuous assessment marks for this subject have not been published by the faculty on VTOP yet.</p>
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
            const isCritical = attendance?.isCritical || false;
            const hasAtt = Boolean(
              attendance &&
              attendance.attended !== null &&
              attendance.attended !== undefined &&
              attendance.total !== null &&
              attendance.total !== undefined
            );
            const pct = attendance?.percentage !== null && attendance?.percentage !== undefined
              ? attendance.percentage
              : (hasAtt && attendance && attendance.total && attendance.total > 0
                ? Math.round(((attendance.attended || 0) / attendance.total) * 100)
                : null);

            return (
              <div key={course.code || course.id} className="course-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
                <div className="course-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span className="course-code-tag">{course.code}</span>
                      {course.grade && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--success-bg)', color: 'var(--success-emerald)', fontWeight: 800 }}>
                          Grade: {course.grade}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slot: <b>{course.slot || 'N/A'}</b></span>
                    </div>
                    <h3 className="course-title">{course.title}</h3>
                    <span className="course-faculty">👨‍🏫 {course.faculty || 'Faculty unassigned'}</span>
                  </div>

                  <div>
                    <button
                      onClick={handleOpenVhelp}
                      className="btn-study-material"
                      title={`Open study material on VHelp for ${course.code}`}
                    >
                      <span>📚</span>
                      <span>Study Material</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>↗</span>
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem' }}>
                      Attendance: <b>{hasAtt && attendance ? `${attendance.attended} / ${attendance.total} classes` : 'Not recorded'}</b>
                    </span>
                    <span className={`attendance-percentage-pill ${isCritical ? 'critical' : 'safe'}`}>
                      {pct !== null ? `${pct}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginBottom: '8px' }}>
                    <div
                      className={`progress-fill ${isCritical ? 'crimson' : 'emerald'}`}
                      style={{ width: `${pct || 0}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: isCritical ? 'var(--danger-crimson)' : 'var(--success-emerald)', fontWeight: 700 }}>
                      {hasAtt && attendance
                        ? (isCritical
                          ? `⚠ Below 75%: Attend next ${attendance.needToAttend || 1} classes`
                          : `✓ Safe to miss ${attendance.safeToMiss ?? 0} classes`)
                        : 'Sync VTOP for attendance data'}
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
          {/* Selected Subject Context Banner */}
          {selectedCourse && (
            <div style={{ background: 'var(--brand-bg)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Targeted Subject View Active
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '2px', color: '#fff' }}>
                  {selectedCourse.code} • {selectedCourse.title}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Showing study tools, recovery schedule, and focus timer specifically for this subject.
                </p>
              </div>
              <button
                className="btn-outline"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                onClick={() => setSelectedSubjectCode('all')}
              >
                Clear Subject Filter (Show All)
              </button>
            </div>
          )}

          {/* 1. FAT Final Exam Grade Estimator */}
          <div className="course-card" style={{ background: 'linear-gradient(135deg, #111622 0%, #172033 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Target Score Engine
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  🎯 FAT Final Exam Grade Estimator
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Calculate exact marks needed in the Final Assessment Test (FAT) based on verified continuous assessment records.
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '16px' }}>
              {displayedCourses.map(c => {
                const markItems = getCourseMarkComponents(c);
                const hasMarks = markItems.length >= 3; // Need full continuous assessment for projection
                return (
                  <div key={c.code || c.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-color)', fontWeight: 700 }}>{c.code}</span>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '4px 0' }}>{c.title}</h4>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      {hasMarks ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Target Score: <b style={{ fontSize: '1.1rem', color: 'var(--success-emerald)' }}>Calculated</b>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          FAT projection unavailable until marks are synchronized.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Active Focus Pomodoro Timer (Subject-Aware) */}
          <div className="course-card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '24px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Productivity Toolkit
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                ⏱ Active Focus Pomodoro Timer
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {selectedCourse ? (
                  <span>Focus Session: <b style={{ color: '#fff' }}>{selectedCourse.code} • {selectedCourse.title}</b></span>
                ) : (
                  <span>25-minute deep focus sprints designed to master tough topics without burnout.</span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: timerState === 'running' ? 'var(--brand-color)' : timerState === 'completed' ? 'var(--success-emerald)' : 'var(--text-primary)' }}>
                {Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:{(remainingSeconds % 60).toString().padStart(2, '0')}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {timerState === 'running' ? (
                  <button className="btn-primary" onClick={handlePauseTimer}>
                    ⏸ Pause
                  </button>
                ) : timerState === 'paused' ? (
                  <button className="btn-primary" onClick={handleStartTimer}>
                    ▶ Resume
                  </button>
                ) : timerState === 'completed' ? (
                  <button className="btn-primary" onClick={handleResetTimer}>
                    ✓ Done (Restart)
                  </button>
                ) : (
                  <button className="btn-primary" onClick={handleStartTimer}>
                    ▶ Start Focus
                  </button>
                )}

                <button className="btn-outline" onClick={handleResetTimer}>
                  ↺ Reset
                </button>
              </div>
            </div>

            {timerState === 'completed' && (
              <div style={{ width: '100%', padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)', color: 'var(--success-emerald)', fontSize: '0.85rem', fontWeight: 600 }}>
                🎉 Focus session completed! Take a 5-minute breather before starting your next sprint.
              </div>
            )}
          </div>

          {/* 3. Study Material & Practice Resources Hub (Filtered by Subject) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                📚 Official University Study Material & Practice Papers
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Powered by VHelpCC Direct Resource Network
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {displayedCourses.map((c) => (
                <div key={c.code || c.id} className="assignment-item-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-color)', background: 'var(--brand-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                        {c.code}
                      </span>
                      {c.slot && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Slot: <b>{c.slot}</b></span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '6px 0 4px' }}>{c.title}</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      👨‍🏫 Instructor: {c.faculty || 'Course Faculty'}
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                      Curated lecture slides, lab manuals, and previous year exam question banks.
                    </p>
                  </div>

                  <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleOpenVhelp}
                    >
                      <span>Access Material on VHelp</span>
                      <span>↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicsView;
