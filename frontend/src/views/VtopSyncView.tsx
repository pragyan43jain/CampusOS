import React, { useState } from 'react';
import {
  RefreshCw,
  User,
  GraduationCap,
  Calendar,
  Percent,
  Award,
  FileText,
  Users,
  ShieldCheck,
  Mail,
  MapPin,
  BookOpen,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';
import {
  StudentProfile,
  Course,
  Attendance,
  Marks,
  Exam,
  Faculty,
  TimetableSlot,
} from '../types';
import { MetricCard } from '../components/MetricCard';

interface VtopSyncViewProps {
  student: StudentProfile;
  courses?: Course[];
  attendance: Attendance[];
  marks: Marks[];
  exams: Exam[];
  faculty: Faculty[];
  timetable: TimetableSlot[];
  onForceSync: () => void;
  syncing: boolean;
}

export const VtopSyncView: React.FC<VtopSyncViewProps> = ({
  student,
  attendance,
  marks,
  exams,
  faculty,
  timetable,
  onForceSync,
  syncing,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'exams' | 'faculty'>('overview');

  const isAuth = Boolean(student?.regNo && student.regNo !== 'Not available');
  const overallAtt = student.overallAttendance;
  const hasAttendance = overallAtt && overallAtt.percentage !== null && overallAtt.percentage !== undefined;

  const criticalSubjects = attendance.filter(
    (a) => a.attendancePercentage !== null && a.attendancePercentage !== undefined && a.attendancePercentage < 75
  );

  const cgpaDisplay = student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'Data unavailable';
  const creditsDisplay =
    student.creditsEarned !== null && student.creditsEarned !== undefined
      ? `${student.creditsEarned} / ${student.totalCreditsRequired || 160}`
      : 'Data unavailable';

  const verificationChips = [
    { label: 'Profile', count: isAuth ? student.regNo : null, ok: isAuth, icon: User, tab: 'overview' as const },
    { label: 'Attendance', count: attendance.length > 0 ? `${attendance.length} Courses` : null, ok: attendance.length > 0, icon: Percent, tab: 'attendance' as const },
    { label: 'Timetable', count: timetable.length > 0 ? `${timetable.length} Slots` : null, ok: timetable.length > 0, icon: Calendar, tab: 'overview' as const },
    { label: 'Marks', count: marks.length > 0 ? `${marks.length} Subjects` : null, ok: marks.length > 0, icon: Award, tab: 'marks' as const },
    { label: 'Exams', count: exams.length > 0 ? `${exams.length} Schedules` : null, ok: exams.length > 0, icon: FileText, tab: 'exams' as const },
    { label: 'Faculty', count: faculty.length > 0 ? `${faculty.length} Faculty` : null, ok: faculty.length > 0, icon: Users, tab: 'faculty' as const },
  ];

  return (
    <div className="page-container">
      {/* Top Hero Section */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <ShieldCheck size={13} />
              <span>VTOP LIVE HUB</span>
              <span>•</span>
              <span style={{ color: isAuth ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                {isAuth ? 'Verified Session Active' : 'Disconnected'}
              </span>
            </div>

            <h2 className="hero-heading">VTOP Integration</h2>
            <p className="hero-desc">
              Synchronize and manage authoritative academic records, attendance logs, continuous assessments, and degree progression directly from the student portal.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Last Sync:</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {student.lastSynced || 'Never'}
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={onForceSync}
              disabled={syncing}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync VTOP'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VTOP Data Source Verification Section */}
      <div className="card" style={{ padding: '16px 20px', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            VTOP Data Source Verification
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Real-time validation against institutional schemas
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {verificationChips.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(chip.tab)}
                className={`status-badge ${chip.ok ? 'safe' : 'neutral'}`}
                style={{ padding: '6px 12px', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                <Icon size={13} />
                <span>{chip.label}</span>
                {chip.count && (
                  <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.85 }}>({chip.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="segmented-tabs-bar">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
          { id: 'attendance', label: `Attendance (${attendance.length})`, icon: Percent },
          { id: 'marks', label: `Continuous Marks (${marks.length})`, icon: Award },
          { id: 'exams', label: `Exams Schedule (${exams.length})`, icon: Calendar },
          { id: 'faculty', label: `Faculty (${faculty.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`segmented-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================== TAB: OVERVIEW ===================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="metrics-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <MetricCard
              label="Cumulative CGPA"
              value={cgpaDisplay}
              subtext={student.rank ? `Class Rank #${student.rank} • Semester ${student.semester || 'N/A'}` : 'Cumulative performance'}
              icon={<GraduationCap size={18} />}
              progressPercent={student.cgpa ? (student.cgpa / 10) * 100 : 0}
              variant="emerald"
            />
            <MetricCard
              label="Overall Attendance"
              value={hasAttendance && overallAtt ? `${overallAtt.percentage}%` : 'Data unavailable'}
              subtext={overallAtt && overallAtt.attended !== null ? `${overallAtt.attended}/${overallAtt.total} classes attended` : 'VTOP sync required'}
              icon={<Percent size={18} />}
              progressPercent={hasAttendance && overallAtt ? overallAtt.percentage : 0}
              variant={hasAttendance && overallAtt ? (overallAtt.percentage >= 80 ? 'emerald' : overallAtt.percentage >= 75 ? 'amber' : 'crimson') : 'cyan'}
            />
            <MetricCard
              label="Degree Credits"
              value={creditsDisplay}
              subtext="Degree requirements"
              icon={<Award size={18} />}
              progressPercent={student.creditsEarned && student.totalCreditsRequired ? (student.creditsEarned / student.totalCreditsRequired) * 100 : 0}
              variant="cyan"
            />
            <MetricCard
              label="Enrolled Subjects"
              value={attendance.length > 0 ? `${attendance.length} Courses` : 'Data unavailable'}
              subtext="Active academic workload"
              icon={<BookOpen size={18} />}
              progressPercent={attendance.length > 0 ? 100 : 0}
              variant="cyan"
            />
          </div>

          {/* Student Academic Identity Card */}
          <div className="card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  <User size={18} color="var(--brand-color)" />
                  <span>Student Academic Identity</span>
                </h3>
                <p className="card-description">Authoritative student record from VTOP profile registry</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{student.name || 'Not Available'}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registration Number</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-color)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{student.regNo || 'Not Available'}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Program</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{student.program || 'VIT Chennai'}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enrolled Semester</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{student.semester ? `Semester ${student.semester}` : 'Active Session'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: ATTENDANCE ===================== */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="metrics-stat-grid">
            <MetricCard
              label="Aggregate Attendance"
              value={hasAttendance && overallAtt ? `${overallAtt.percentage}%` : 'Data unavailable'}
              subtext={overallAtt && overallAtt.attended !== null ? `${overallAtt.attended} of ${overallAtt.total} lectures attended` : 'VTOP sync required'}
              icon={<Percent size={18} />}
              progressPercent={hasAttendance && overallAtt ? overallAtt.percentage : 0}
              variant={hasAttendance && overallAtt ? (overallAtt.percentage >= 80 ? 'emerald' : overallAtt.percentage >= 75 ? 'amber' : 'crimson') : 'cyan'}
            />
            <MetricCard
              label="Critical Subjects (<75%)"
              value={criticalSubjects.length}
              subtext={criticalSubjects.length === 0 ? 'All subjects meet 75% threshold' : 'Attendance debarment risk'}
              icon={<AlertTriangle size={18} />}
              variant={criticalSubjects.length === 0 ? 'emerald' : 'crimson'}
            />
            <MetricCard
              label="Total Enrolled Courses"
              value={attendance.length}
              subtext="Theory, lab & embedded courses"
              icon={<BookOpen size={18} />}
              variant="cyan"
            />
          </div>

          <div className="card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  <Percent size={18} color="var(--brand-color)" />
                  <span>Subject-Wise Attendance Table</span>
                </h3>
                <p className="card-description">Exact attended/conducted counts, thresholds, and safe bunk calculations</p>
              </div>
            </div>

            {attendance.length > 0 ? (
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>Slot</th>
                      <th>Faculty</th>
                      <th>Attended / Total</th>
                      <th>Buffer / Needed</th>
                      <th>Percentage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((row, idx) => {
                      const pct = row.attendancePercentage ?? row.percentage ?? 0;
                      const isCrit = pct < 75;
                      const isBorder = pct >= 75 && pct < 80;
                      const statusVariant = isCrit ? 'critical' : isBorder ? 'warning' : 'safe';
                      const statusLabel = isCrit ? 'Below 75%' : isBorder ? 'Borderline' : 'Safe';

                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-color)' }}>
                            {row.courseCode}
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.courseTitle || (row as any).courseName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.slot || '-'}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{row.faculty || '-'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {row.classesAttended ?? row.attended ?? '-'} / {row.classesConducted ?? row.conducted ?? row.total ?? '-'}
                          </td>
                          <td>
                            {row.safeToMiss !== undefined && row.safeToMiss > 0 ? (
                              <span style={{ color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: 600 }}>
                                +{row.safeToMiss} safe bunks
                              </span>
                            ) : row.needToAttend !== undefined && row.needToAttend > 0 ? (
                              <span style={{ color: 'var(--accent-crimson)', fontSize: '0.82rem', fontWeight: 600 }}>
                                Attend {row.needToAttend} classes
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>On Track</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{pct}%</td>
                          <td>
                            <span className={`status-badge ${statusVariant}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="empty-state-icon-box">
                  <Percent size={24} />
                </div>
                <h4 className="empty-state-title">No Attendance Records Found</h4>
                <p className="empty-state-desc">Synchronize with VTOP to view registered course attendance statistics.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB: CONTINUOUS MARKS ===================== */}
      {activeTab === 'marks' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Award size={18} color="var(--brand-color)" />
                <span>Continuous Assessment Marks</span>
              </h3>
              <p className="card-description">Internal assessments, CAT-1, CAT-2, DA, quizzes, and lab scores</p>
            </div>
          </div>

          {marks.length > 0 ? (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Assessments Log</th>
                    <th>Scored Weightage</th>
                    <th>Max Weightage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m, idx) => {
                    const components = m.components || [];
                    const scored = m.weightageScored ?? m.totalInternal?.scored ?? '-';
                    const max = m.weightageTotal ?? m.totalInternal?.max ?? '100';
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-color)' }}>
                          {m.courseCode}
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.courseTitle || m.courseName}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {components.length > 0 ? (
                              components.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--surface-sunken)',
                                    border: '1px solid var(--border-subtle)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {c.title}: {c.scored !== null ? `${c.scored}/${c.max}` : '-'}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Evaluations in progress</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{scored}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{max}</td>
                        <td>
                          <span className="status-badge safe">
                            {m.statusMessage || 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state-card">
              <div className="empty-state-icon-box">
                <Award size={24} />
              </div>
              <h4 className="empty-state-title">No Assessment Marks Published</h4>
              <p className="empty-state-desc">Marks will populate once uploaded by faculty on the institutional portal.</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: EXAMS SCHEDULE ===================== */}
      {activeTab === 'exams' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Calendar size={18} color="var(--brand-color)" />
                <span>Examination Schedule</span>
              </h3>
              <p className="card-description">FAT, CAT, and laboratory exam schedules, session slots, and seating venues</p>
            </div>
          </div>

          {exams.length > 0 ? (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time / Session</th>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Slot</th>
                    <th>Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ex.date || '-'}</td>
                      <td style={{ color: 'var(--brand-color)', fontWeight: 600 }}>{ex.time || '-'}</td>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{ex.courseCode || ex.subjectCode}</td>
                      <td style={{ fontWeight: 600 }}>{ex.courseTitle || ex.courseName || ex.subject}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{ex.slot || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{ex.venue || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state-card">
              <div className="empty-state-icon-box">
                <Calendar size={24} />
              </div>
              <h4 className="empty-state-title">No Exam Schedules Released</h4>
              <p className="empty-state-desc">Examination dates and venues will appear after official timetable notification.</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: FACULTY DIRECTORY ===================== */}
      {activeTab === 'faculty' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Users size={18} color="var(--brand-color)" />
                <span>Faculty Directory</span>
              </h3>
              <p className="card-description">Course instructors, cabin locations, and academic email contacts</p>
            </div>
          </div>

          {faculty.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {faculty.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-card)',
                    backgroundColor: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-color)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {f.name ? f.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'FAC'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {f.name}
                      </h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{f.designation || 'Faculty Member'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', marginTop: '4px' }}>
                    {f.cabin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <MapPin size={14} color="var(--text-muted)" />
                        <span>Cabin: {f.cabin}</span>
                      </div>
                    )}
                    {f.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-color)' }}>
                        <Mail size={14} />
                        <a href={`mailto:${f.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {f.email}
                        </a>
                      </div>
                    )}
                    {f.department && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {f.department}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-card">
              <div className="empty-state-icon-box">
                <Users size={24} />
              </div>
              <h4 className="empty-state-title">No Faculty Records Available</h4>
              <p className="empty-state-desc">Synchronize with VTOP to view registered faculty details.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VtopSyncView;
