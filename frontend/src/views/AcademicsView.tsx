import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Percent,
  Calendar,
  Award,
  FileText,
  Users,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Mail,
  MapPin,
  ExternalLink,
  Search,
  BookMarked,
  ShieldCheck,
} from 'lucide-react';
import {
  StudentProfile,
  Course,
  Attendance,
  Marks,
  Exam,
  Faculty,
  TimetableSlot,
  DayOfWeek,
} from '../types';
import { MetricCard } from '../components/MetricCard';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';
import { getStudyMaterialUrl } from '../services/studyMaterialService';

export type AcademicsSubTab =
  | 'profile'
  | 'attendance'
  | 'timetable'
  | 'marks'
  | 'exams'
  | 'faculty'
  | 'courses';

interface AcademicsViewProps {
  student: StudentProfile;
  courses?: Course[];
  attendance?: Attendance[];
  timetable?: TimetableSlot[];
  marks?: Marks[];
  exams?: Exam[];
  faculty?: Faculty[];
  onForceSync?: () => void;
  syncing?: boolean;
  initialSubTab?: AcademicsSubTab;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  student,
  courses = [],
  attendance = [],
  timetable = [],
  marks = [],
  exams = [],
  faculty = [],
  onForceSync,
  syncing = false,
  initialSubTab = 'profile',
}) => {
  const getSubTabFromUrl = (): AcademicsSubTab => {
    if (typeof window === 'undefined') return initialSubTab;
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/academics/profile')) return 'profile';
    if (path.includes('/academics/attendance')) return 'attendance';
    if (path.includes('/academics/timetable')) return 'timetable';
    if (path.includes('/academics/marks')) return 'marks';
    if (path.includes('/academics/exams')) return 'exams';
    if (path.includes('/academics/faculty')) return 'faculty';
    if (path.includes('/academics/courses')) return 'courses';
    return initialSubTab;
  };

  const [activeTab, setActiveTab] = useState<AcademicsSubTab>(getSubTabFromUrl());

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getSubTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleTabChange = (tab: AcademicsSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const targetUrl = tab === 'profile' ? '/academics' : `/academics/${tab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  };

  const getTodayDayOfWeek = (): DayOfWeek => {
    const dayIndex = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: 'MON',
      2: 'TUE',
      3: 'WED',
      4: 'THU',
      5: 'FRI',
      6: 'SAT',
    };
    return map[dayIndex] || 'MON';
  };

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const filteredSlots = timetable.filter((slot) => slot.day === selectedDay);

  const dayClassCounts: Record<DayOfWeek, number> = {
    MON: timetable.filter((s) => s.day === 'MON').length,
    TUE: timetable.filter((s) => s.day === 'TUE').length,
    WED: timetable.filter((s) => s.day === 'WED').length,
    THU: timetable.filter((s) => s.day === 'THU').length,
    FRI: timetable.filter((s) => s.day === 'FRI').length,
    SAT: timetable.filter((s) => s.day === 'SAT').length,
  };

  const dayTitles: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const [examFilter, setExamFilter] = useState<'ALL' | 'CAT 1' | 'CAT 2' | 'FAT' | 'LAB FAT'>('ALL');
  const filteredExams = useMemo(() => {
    if (examFilter === 'ALL') return exams;
    return exams.filter((ex) => {
      const type = (ex.examType || ex.title || '').toUpperCase();
      if (examFilter === 'CAT 1') return type.includes('CAT 1') || type.includes('CAT-1') || type.includes('CAT1');
      if (examFilter === 'CAT 2') return type.includes('CAT 2') || type.includes('CAT-2') || type.includes('CAT2');
      if (examFilter === 'FAT') return (type.includes('FAT') || type.includes('FINAL')) && !type.includes('LAB');
      if (examFilter === 'LAB FAT') return type.includes('LAB') && (type.includes('FAT') || type.includes('FINAL'));
      return true;
    });
  }, [exams, examFilter]);

  const [marksFilter, setMarksFilter] = useState<'ALL' | 'CAT 1' | 'CAT 2' | 'FAT' | 'DA'>('ALL');
  const [courseSearch, setCourseSearch] = useState('');

  const filteredMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    if (marksFilter === 'ALL') return marks;
    return marks.filter((m) => {
      if (m.components && m.components.length > 0) {
        return m.components.some((c) => {
          const t = (c.title || '').toUpperCase();
          if (marksFilter === 'CAT 1') return t.includes('CAT 1') || t.includes('CAT-1') || t.includes('TEST - I') || t.includes('TEST 1');
          if (marksFilter === 'CAT 2') return t.includes('CAT 2') || t.includes('CAT-2') || t.includes('TEST - II') || t.includes('TEST 2');
          if (marksFilter === 'FAT') return t.includes('FAT') || t.includes('FINAL');
          if (marksFilter === 'DA') return t.includes('ASSIGNMENT') || t.includes('DA') || t.includes('QUIZ');
          return true;
        });
      }
      if (marksFilter === 'CAT 1') return m.cat1 && m.cat1.scored !== null && m.cat1.scored !== undefined;
      if (marksFilter === 'CAT 2') return m.cat2 && m.cat2.scored !== null && m.cat2.scored !== undefined;
      if (marksFilter === 'FAT') return m.fat && m.fat.scored !== null && m.fat.scored !== undefined;
      if (marksFilter === 'DA') return Boolean(m.da1 || m.da2 || m.quiz || (m as any).quiz1 || (m as any).quiz2);
      return true;
    });
  }, [marks, marksFilter]);

  const navTabs: { id: AcademicsSubTab; label: string; icon: React.ComponentType<any>; count?: number | string }[] = [
    { id: 'profile', label: 'Profile', icon: User, count: student.regNo || undefined },
    { id: 'attendance', label: 'Attendance', icon: Percent, count: attendance.length ? `${attendance.length}` : undefined },
    { id: 'timetable', label: 'Timetable', icon: Calendar, count: timetable.length ? `${timetable.length} Slots` : undefined },
    { id: 'marks', label: 'Marks', icon: Award, count: marks.length ? `${marks.length}` : undefined },
    { id: 'exams', label: 'Exams', icon: FileText, count: exams.length ? `${exams.length}` : undefined },
    { id: 'faculty', label: 'Faculty', icon: Users, count: faculty.length ? `${faculty.length}` : undefined },
    { id: 'courses', label: 'Courses & Study', icon: BookOpen, count: courses.length ? `${courses.length}` : undefined },
  ];

  return (
    <div className="page-container">
      {/* 1. Academics Hero Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <ShieldCheck size={14} />
              <span>VTOP ACADEMIC SYSTEM</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>{student.program || 'VIT Chennai'}</span>
            </div>
            <h2 className="hero-heading">Academics Command Center</h2>
            <p className="hero-desc">
              Authoritative university ledger for attendance thresholds, continuous assessments, faculty directory, and exam schedules.
            </p>
          </div>

          <button
            onClick={onForceSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Academic Data'}</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Segmented Navigation Bar */}
      <nav className="academic-nav-bar" role="tablist" aria-label="Academics Sub-navigation">
        {navTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              className={`academic-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.count && <span className="academic-nav-badge">{t.count}</span>}
            </button>
          );
        })}
      </nav>

      {/* 3. Sub-View Content */}

      {/* === 3.1 PROFILE SUB-TAB === */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <div className="card">
            <div className="card-header-bar">
              <h3 className="card-title">
                <User size={19} color="var(--accent-cyan)" />
                <span>Student Identity</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Full Name</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.name || 'Student Name'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Registration Number</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '0.94rem' }}>
                  {student.regNo || 'Not available'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Degree &amp; Program</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.program || 'B.Tech CSE'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Branch / School</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.branch || 'School of Computer Science'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Academic Batch</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.batch || '2024 - 2028'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-bar">
              <h3 className="card-title">
                <Award size={19} color="var(--accent-blue)" />
                <span>Academic Progression</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Cumulative CGPA</span>
                <span style={{ fontWeight: 800, color: 'var(--success-emerald)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                  {student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Credits Completed</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem', fontFamily: 'var(--font-mono)' }}>
                  {student.creditsEarned || 0} / {student.totalCreditsRequired || 160}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Current Semester</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>Semester {student.semester || '1'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Proctor / Advisor</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.proctor?.name || 'Assigned by School'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Proctor Email</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.94rem' }}>{student.proctor?.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === 3.2 ATTENDANCE SUB-TAB === */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  <Percent size={19} color="var(--accent-cyan)" />
                  <span>75% Attendance Safety Engine &amp; Safe Bunk Calculator</span>
                </h3>
                <p className="card-description">
                  Continuous mathematical calculation of safe leave margins and recovery hours across all registered courses.
                </p>
              </div>
            </div>

            <div className="metrics-stat-grid" style={{ marginBottom: '16px' }}>
              <MetricCard
                label="Overall Attendance"
                value={student.overallAttendance?.percentage ? `${student.overallAttendance.percentage}%` : 'N/A'}
                subtext="Mandatory university threshold: 75.0%"
                icon={<Percent size={18} />}
                progressPercent={student.overallAttendance?.percentage || 0}
                variant={(student.overallAttendance?.percentage || 0) >= 80 ? 'emerald' : 'amber'}
              />
              <MetricCard
                label="Safe Status Courses"
                value={attendance.filter((a) => (a.percentage ?? a.attendancePercentage ?? 0) >= 75).length}
                subtext="Courses safely above 75%"
                icon={<ShieldCheck size={18} />}
                variant="emerald"
              />
              <MetricCard
                label="Critical Watchlist"
                value={attendance.filter((a) => (a.percentage ?? a.attendancePercentage ?? 0) < 75).length}
                subtext="Immediate recovery required"
                icon={<AlertTriangle size={18} />}
                variant={attendance.filter((a) => (a.percentage ?? a.attendancePercentage ?? 0) < 75).length > 0 ? 'crimson' : 'emerald'}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header-bar">
              <h3 className="card-title">
                <BookMarked size={19} color="var(--accent-blue)" />
                <span>Course-Wise Attendance Breakdown</span>
              </h3>
            </div>

            {attendance.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <Percent size={26} />
                </div>
                <div className="empty-state-title">No Attendance Records Synced</div>
                <p className="empty-state-desc">Click "Sync Academic Data" to fetch live attendance from VTOP.</p>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>Attended / Conducted</th>
                      <th>Percentage</th>
                      <th>Safe Bunks / Recovery</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((att, idx) => {
                      const conducted = att.conducted ?? att.classesConducted ?? att.total ?? 0;
                      const attended = att.attended ?? att.classesAttended ?? 0;
                      const pct = att.percentage ?? att.attendancePercentage ?? (conducted > 0 ? Math.round((attended / conducted) * 100) : 0);
                      const safeBunks = Math.max(0, Math.floor((attended - 0.75 * conducted) / 0.75));
                      const recoveryNeeded = pct < 75 ? Math.ceil((0.75 * conducted - attended) / 0.25) : 0;

                      return (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {att.courseCode || 'COURSE'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{att.courseTitle || att.courseName || 'Subject Title'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {attended} / {conducted}
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 800,
                                fontFamily: 'var(--font-mono)',
                                color: pct >= 80 ? 'var(--success-emerald)' : pct >= 75 ? 'var(--warning-amber)' : 'var(--danger-crimson)',
                              }}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            {pct >= 75 ? (
                              <span style={{ color: 'var(--success-emerald)', fontWeight: 600, fontSize: '0.86rem' }}>
                                +{safeBunks} classes safe to miss
                              </span>
                            ) : (
                              <span style={{ color: 'var(--danger-crimson)', fontWeight: 600, fontSize: '0.86rem' }}>
                                Attend next {recoveryNeeded} classes
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${pct >= 80 ? 'safe' : pct >= 75 ? 'warning' : 'critical'}`}>
                              {pct >= 80 ? 'Safe Buffer' : pct >= 75 ? 'Borderline' : 'Debarment Risk'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === 3.3 TIMETABLE SUB-TAB === */}
      {activeTab === 'timetable' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Calendar size={19} color="var(--accent-cyan)" />
                <span>Weekly Timetable Schedule ({dayTitles[selectedDay]})</span>
              </h3>
              <p className="card-description">Official VTOP slot allocations, classroom venues, and faculty assignments.</p>
            </div>

            <WeekSelector
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              dayClassCounts={dayClassCounts}
            />
          </div>

          {filteredSlots.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Calendar size={26} />
              </div>
              <div className="empty-state-title">No scheduled classes for {dayTitles[selectedDay]}</div>
              <p className="empty-state-desc">No academic routine scheduled on this day.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredSlots.map((slot, idx) => (
                <TimetableSlotCard key={slot.id || idx} slot={slot} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 3.4 MARKS SUB-TAB === */}
      {activeTab === 'marks' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Award size={19} color="var(--accent-cyan)" />
                <span>Continuous Assessment &amp; Marks Ledger</span>
              </h3>
              <p className="card-description">Internal assessment scores, CAT evaluations, quizzes, and digital assignments.</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['ALL', 'CAT 1', 'CAT 2', 'FAT', 'DA'] as const).map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${marksFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMarksFilter(f)}
                >
                  {f === 'ALL' ? 'All Assessments' : f}
                </button>
              ))}
            </div>
          </div>

          {filteredMarks.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Award size={26} />
              </div>
              <div className="empty-state-title">No Marks Records Available</div>
              <p className="empty-state-desc">No assessment marks matching "{marksFilter}" found for this semester.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>Faculty</th>
                      <th>CAT 1 Score</th>
                      <th>CAT 2 Score</th>
                      <th>FAT / Final</th>
                      <th>Weightage Scored</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMarks.map((m, idx) => {
                      const cat1Comp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('CAT 1') || t.includes('CAT-1') || t.includes('TEST - I') || t.includes('TEST 1');
                      });
                      const cat1Score = cat1Comp
                        ? `${cat1Comp.scored ?? '-'} / ${cat1Comp.max}`
                        : (m.cat1?.scored !== null && m.cat1?.scored !== undefined ? `${m.cat1.scored} / ${m.cat1.max}` : '-');
                      const cat1Wt = cat1Comp?.weightage !== undefined ? `(Wt: ${cat1Comp.weightage} / ${cat1Comp.maxWeightage || 15})` : '';

                      const cat2Comp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('CAT 2') || t.includes('CAT-2') || t.includes('TEST - II') || t.includes('TEST 2');
                      });
                      const cat2Score = cat2Comp
                        ? `${cat2Comp.scored ?? '-'} / ${cat2Comp.max}`
                        : (m.cat2?.scored !== null && m.cat2?.scored !== undefined ? `${m.cat2.scored} / ${m.cat2.max}` : '-');

                      const fatComp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('FAT') || t.includes('FINAL');
                      });
                      const fatScore = fatComp
                        ? `${fatComp.scored ?? '-'} / ${fatComp.max}`
                        : (m.fat?.scored !== null && m.fat?.scored !== undefined ? `${m.fat.scored} / ${m.fat.max || 100}` : '-');

                      const totalScore = m.weightageScored !== undefined
                        ? `${m.weightageScored} / ${m.weightageGraded || m.weightageTotal || 15}`
                        : (m.totalInternal?.scored !== undefined ? `${m.totalInternal.scored} / ${m.totalInternal.max}` : '-');

                      return (
                        <tr key={m.id || idx}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {m.courseCode || 'COURSE'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.courseTitle || m.courseName || 'Subject Title'}</td>
                          <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{m.faculty || 'Assigned Professor'}</td>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {cat1Score}
                            </div>
                            {cat1Wt && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                                {cat1Wt}
                              </div>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cat2Score}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fatScore}
                          </td>
                          <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald, #10b981)' }}>
                            {totalScore}
                          </td>
                          <td>
                            <span className="status-badge safe">Published</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assessment Components Breakdown Cards */}
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={16} color="var(--accent-cyan)" />
                  <span>Individual Evaluation Breakdown</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {filteredMarks.map((courseMark, cIdx) => (
                    <div
                      key={courseMark.id || cIdx}
                      style={{
                        backgroundColor: 'var(--surface-input)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                            {courseMark.courseCode}
                          </span>
                          <h5 style={{ margin: '2px 0 0 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {courseMark.courseTitle || courseMark.courseName}
                          </h5>
                          {courseMark.faculty && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Faculty: {courseMark.faculty}
                            </div>
                          )}
                        </div>

                        {courseMark.weightageScored !== undefined && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weightage</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald, #10b981)' }}>
                              {courseMark.weightageScored} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {courseMark.weightageGraded || courseMark.weightageTotal || 15}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {courseMark.components && courseMark.components.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                          {courseMark.components.map((comp, k) => {
                            const pct = comp.scored !== null && comp.max ? Math.round((comp.scored / comp.max) * 100) : 0;
                            return (
                              <div
                                key={k}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  border: '1px solid rgba(255, 255, 255, 0.04)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {comp.title}
                                  </span>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                                    {comp.scored !== null ? comp.scored : '-'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {comp.max}</span>
                                  </span>
                                </div>

                                <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--surface-input)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      backgroundColor: pct >= 80 ? 'var(--accent-emerald, #10b981)' : pct >= 60 ? 'var(--accent-cyan)' : 'var(--accent-orange, #f59e0b)',
                                      borderRadius: '3px',
                                    }}
                                  />
                                </div>

                                {comp.weightage !== undefined && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                    <span>Weightage: {comp.weightage} / {comp.maxWeightage || 15}</span>
                                    <span>{comp.status || 'Graded'}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                          No individual component evaluations published yet.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === 3.5 EXAMS SUB-TAB === */}
      {activeTab === 'exams' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <FileText size={19} color="var(--accent-purple)" />
                <span>Examination Schedule</span>
              </h3>
              <p className="card-description">Official university examination timetables, seat venues, and reporting timings.</p>
            </div>

            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value as any)}
              className="custom-select-control"
              style={{ minWidth: '180px' }}
            >
              <option value="ALL">All Examinations</option>
              <option value="CAT 1">CAT 1 Exams</option>
              <option value="CAT 2">CAT 2 Exams</option>
              <option value="FAT">FAT (Finals)</option>
              <option value="LAB FAT">Lab FATs</option>
            </select>
          </div>

          {filteredExams.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <FileText size={26} />
              </div>
              <div className="empty-state-title">No Exams Found</div>
              <p className="empty-state-desc">No examination schedules published under the selected filter.</p>
            </div>
          ) : (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table">
                <thead>
                  <tr>
                    <th>Exam Type</th>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Exam Date</th>
                    <th>Time</th>
                    <th>Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((ex, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="status-badge info">{ex.examType || 'CAT 1'}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {ex.courseCode}
                      </td>
                      <td style={{ fontWeight: 600 }}>{ex.courseTitle || ex.title}</td>
                      <td style={{ fontWeight: 700 }}>{ex.date}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{ex.time || '9:30 AM'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} color="var(--accent-orange)" />
                          <span>{ex.venue || 'Academic Block'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === 3.6 FACULTY SUB-TAB === */}
      {activeTab === 'faculty' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Users size={19} color="var(--accent-cyan)" />
                <span>Course Faculty &amp; Instructors Directory</span>
              </h3>
              <p className="card-description">Faculty contact details, office cabins, and assigned course subjects.</p>
            </div>
          </div>

          {faculty.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Users size={26} />
              </div>
              <div className="empty-state-title">No Faculty Directory Synced</div>
              <p className="empty-state-desc">Sync your VTOP profile to extract instructors assigned to your registered courses.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {faculty.map((fac, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-input)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {fac.name}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        {fac.courseCode || 'COURSE'} • {fac.designation || 'Faculty Instructor'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {fac.courseTitle || 'Assigned Subject'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    {fac.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <Mail size={13} color="var(--accent-blue)" />
                        <a href={`mailto:${fac.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                          {fac.email}
                        </a>
                      </div>
                    )}
                    {fac.cabin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <MapPin size={13} color="var(--accent-orange)" />
                        <span>Cabin: {fac.cabin}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 3.7 COURSES & STUDY MATERIAL SUB-TAB === */}
      {activeTab === 'courses' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <BookOpen size={19} color="var(--accent-cyan)" />
                <span>Registered Courses &amp; Study Repository</span>
              </h3>
              <p className="card-description">Official course syllabus, reference textbooks, lecture slides, and question banks.</p>
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search course code..."
                className="input-field"
                style={{ paddingLeft: '36px', height: '40px', fontSize: '0.86rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <BookOpen size={26} />
              </div>
              <div className="empty-state-title">No Enrolled Courses Found</div>
              <p className="empty-state-desc">Synchronize with VTOP to load all semester curriculum courses.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {courses
                .filter(
                  (c) =>
                    !courseSearch ||
                    (c.code || '').toLowerCase().includes(courseSearch.toLowerCase()) ||
                    (c.title || '').toLowerCase().includes(courseSearch.toLowerCase())
                )
                .map((course, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--surface-input)',
                      border: '1px solid var(--border-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {course.code}
                        </span>
                        <span className="status-badge info">{course.credits ? `${course.credits} Credits` : '3 Credits'}</span>
                      </div>

                      <h4 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                        {course.title}
                      </h4>

                      <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                        Slot: {course.slot || 'Regular'} • Faculty: {course.faculty || 'Assigned Professor'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                      <a
                        href={getStudyMaterialUrl({ code: course.code, title: course.title })}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <ExternalLink size={13} />
                        <span>Study Materials</span>
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
