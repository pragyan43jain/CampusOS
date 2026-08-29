import React, { useState } from 'react';
import {
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  GraduationCap,
  Calendar,
  Percent,
  Award,
  Clock,
  FileText,
  Users,
  ShieldCheck,
  Mail,
  MapPin,
  BookOpen,
  LayoutDashboard,
} from 'lucide-react';
import {
  StudentProfile,
  Course,
  Attendance,
  Marks,
  OD,
  Exam,
  Faculty,
  TimetableSlot,
} from '../types';
import { MetricCard } from '../components/MetricCard';
import { CampusAPI } from '../services/api';

interface VtopSyncViewProps {
  student: StudentProfile;
  courses?: Course[];
  attendance: Attendance[];
  marks: Marks[];
  od: OD;
  exams: Exam[];
  faculty: Faculty[];
  timetable: TimetableSlot[];
  onOpenSyncModal: () => void;
  onForceSync: () => void;
  syncing: boolean;
}

export const VtopSyncView: React.FC<VtopSyncViewProps> = ({
  student,
  attendance,
  marks,
  od,
  exams,
  faculty,
  timetable,
  onOpenSyncModal,
  onForceSync,
  syncing,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'exams' | 'faculty' | 'od'>('overview');

  // Live OD Fetch from VTOP CC
  const [odSyncing, setOdSyncing] = useState(false);
  const [odActionMessage, setOdActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // StudentCC OD Attendance Simulator

  const handleFetchOdFromVtop = async () => {
    setOdSyncing(true);
    setOdActionMessage({ text: 'Connecting to VTOP portal to query On-Duty records...', type: 'info' });
    try {
      const res = await CampusAPI.syncOD();
      if (res.success) {
        setOdActionMessage({ text: res.message || 'Successfully fetched OD hours from VTOP!', type: 'success' });
        onForceSync();
      } else if (res.sessionExpired) {
        setOdActionMessage({ text: 'VTOP session expired. Opening authentication modal...', type: 'info' });
        setTimeout(() => {
          onOpenSyncModal();
        }, 800);
      } else {
        setOdActionMessage({ text: res.message || 'Failed to fetch OD from VTOP.', type: 'error' });
      }
    } catch (err: any) {
      setOdActionMessage({ text: err.message || 'Error communicating with VTOP backend.', type: 'error' });
    } finally {
      setOdSyncing(false);
    }
  };

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

  const odRecordsList = od?.records || od?.odRecords || [];
  const hasValidOD = Boolean(
    od &&
      od.hasValidData &&
      (od.usedHours !== null && od.usedHours !== undefined ||
        od.odHours !== null && od.odHours !== undefined ||
        od.totalOdHours !== null && od.totalOdHours !== undefined ||
        od.state === 'success_with_records' ||
        od.state === 'success_with_no_records')
  );
  const odHoursCount = od?.usedHours ?? od?.odHours ?? od?.totalOdHours ?? (hasValidOD ? 0 : null);

  const verificationChips = [
    { label: 'Profile', count: isAuth ? student.regNo : null, ok: isAuth, icon: User, tab: 'overview' as const },
    { label: 'Attendance', count: attendance.length > 0 ? `${attendance.length} Courses` : null, ok: attendance.length > 0, icon: Percent, tab: 'attendance' as const },
    { label: 'Timetable', count: timetable.length > 0 ? `${timetable.length} Slots` : null, ok: timetable.length > 0, icon: Calendar, tab: 'overview' as const },
    { label: 'Marks', count: marks.length > 0 ? `${marks.length} Subjects` : null, ok: marks.length > 0, icon: Award, tab: 'marks' as const },
    { label: 'On-Duty', count: hasValidOD ? `${odHoursCount ?? 0}h Logged` : null, ok: hasValidOD, icon: Clock, tab: 'od' as const },
    { label: 'Exams', count: exams.length > 0 ? `${exams.length} Schedules` : null, ok: exams.length > 0, icon: FileText, tab: 'exams' as const },
    { label: 'Faculty', count: faculty.length > 0 ? `${faculty.length} Faculty` : null, ok: faculty.length > 0, icon: Users, tab: 'faculty' as const },
  ];

  return (
    <div className="page-container">
      {/* Top Header Section */}
      <div
        className="card"
        style={{
          background: 'var(--brand-gradient-soft)',
          border: '1px solid var(--border-medium)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="brand-icon-box" style={{ width: '44px', height: '44px' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  VTOP Integration Protocol
                </h2>
                <span className={`status-badge ${isAuth ? 'safe' : 'neutral'}`}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isAuth ? 'var(--success-emerald)' : 'var(--text-muted)' }} />
                  {isAuth ? 'Authoritative VTOP Connection' : 'Disconnected'}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Student: <b>{student.name || 'Not logged in'}</b> ({student.regNo || 'No Reg No'}) • {student.program || 'VIT Chennai'} • Semester {student.semester || 'N/A'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Last Synchronized:</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {student.lastSynced || 'Never'}
              </span>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={onForceSync}
              disabled={syncing}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenSyncModal}
            >
              <span>Connect Account</span>
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
          { id: 'od', label: `On-Duty (${hasValidOD ? `${odHoursCount}/40h` : 'OD'})`, icon: Clock },
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
          <div className="metrics-stat-grid">
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
              variant={hasAttendance && overallAtt ? (overallAtt.percentage >= 80 ? 'emerald' : overallAtt.percentage >= 75 ? 'amber' : 'crimson') : 'blue'}
            />
            <MetricCard
              label="Degree Credits"
              value={creditsDisplay}
              subtext="Degree requirements"
              icon={<Award size={18} />}
              progressPercent={student.creditsEarned && student.totalCreditsRequired ? (student.creditsEarned / student.totalCreditsRequired) * 100 : 0}
              variant="blue"
            />
            <MetricCard
              label="On-Duty (OD) Hours"
              value={hasValidOD ? `${odHoursCount ?? 0} Hours` : 'Data unavailable'}
              subtext="40h institutional limit"
              icon={<Clock size={18} />}
              progressPercent={hasValidOD ? Math.min(100, ((odHoursCount || 0) / 40) * 100) : 0}
              variant="blue"
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
              variant={hasAttendance && overallAtt ? (overallAtt.percentage >= 80 ? 'emerald' : overallAtt.percentage >= 75 ? 'amber' : 'crimson') : 'blue'}
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
              variant="blue"
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
                          <td style={{ fontWeight: 600 }}>{row.courseName || row.courseTitle}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.slot || '-'}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{row.faculty || row.facultyName || '-'}</td>
                          <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {row.classesAttended ?? row.attended ?? '-'} / {row.classesConducted ?? row.conducted ?? row.total ?? '-'}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {isCrit ? (
                              <span style={{ color: 'var(--danger-crimson)', fontWeight: 600 }}>
                                Need {row.needToAttend || Math.ceil(((0.75 * (row.total || 0)) - (row.attended || 0)) / 0.25)} to 75%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--success-emerald)', fontWeight: 600 }}>
                                Safe: {row.safeToMiss || Math.floor(((row.attended || 0) - (0.75 * (row.total || 0))) / 0.75)} classes
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 800, fontSize: '0.92rem' }}>{pct}%</td>
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
                <h4 className="empty-state-title">No Attendance Records</h4>
                <p className="empty-state-desc">Synchronize with your VTOP credentials to load registered subject attendance records.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB: ON-DUTY (OD) ===================== */}
      {activeTab === 'od' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {odActionMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: odActionMessage.type === 'success' ? 'var(--success-bg)' : odActionMessage.type === 'error' ? 'var(--danger-bg)' : 'var(--brand-bg)',
                border: `1px solid ${odActionMessage.type === 'success' ? 'var(--success-border)' : odActionMessage.type === 'error' ? 'var(--danger-border)' : 'var(--brand-border)'}`,
                color: odActionMessage.type === 'success' ? 'var(--success-emerald)' : odActionMessage.type === 'error' ? 'var(--danger-crimson)' : 'var(--brand-color)',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {odActionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{odActionMessage.text}</span>
              </div>
              <button onClick={() => setOdActionMessage(null)} style={{ color: 'inherit', padding: '2px' }}>
                <X size={15} />
              </button>
            </div>
          )}

          <div className="metrics-stat-grid">
            <MetricCard
              label="Utilized OD Hours"
              value={hasValidOD ? `${odHoursCount ?? 0} Hours` : 'Data unavailable'}
              subtext="40h maximum institutional limit"
              icon={<Clock size={18} />}
              progressPercent={hasValidOD ? Math.min(100, ((odHoursCount || 0) / 40) * 100) : 0}
              variant="blue"
            />
            <MetricCard
              label="Remaining Safe Buffer"
              value={hasValidOD ? `${od?.remainingHours ?? Math.max(0, 40 - (odHoursCount || 0))} Hours` : '40 Hours'}
              subtext="Buffer before limit threshold"
              icon={<CheckCircle2 size={18} />}
              variant="emerald"
            />
            <MetricCard
              label="Sanctioned OD Records"
              value={odRecordsList.length}
              subtext="Approved leave entries"
              icon={<FileText size={18} />}
              variant="blue"
            />
          </div>

          {/* Itemized OD Records */}
          <div className="card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  <Clock size={18} color="var(--brand-color)" />
                  <span>Sanctioned On-Duty Records</span>
                </h3>
                <p className="card-description">Extracted directly from VTOP leave modules and subject attendance logs</p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleFetchOdFromVtop}
                disabled={odSyncing}
              >
                <RefreshCw size={13} className={odSyncing ? 'animate-spin' : ''} />
                <span>Fetch Live VTOP OD</span>
              </button>
            </div>

            {odRecordsList.length > 0 ? (
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Hours</th>
                      <th>Reason / Activity</th>
                      <th>Approved By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odRecordsList.map((rec, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{rec.date || rec.fromDate || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{rec.subjectCode ? `${rec.subjectCode} - ${rec.subjectTitle}` : 'Institutional Representation'}</td>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-color)' }}>{rec.hours}h</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{rec.reason || 'On-Duty Leave'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{rec.approvedBy || 'Academic Office'}</td>
                        <td>
                          <span className="status-badge safe">
                            {rec.status || 'Approved'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="empty-state-icon-box">
                  <Clock size={24} />
                </div>
                <h4 className="empty-state-title">No OD Records for Active Semester</h4>
                <p className="empty-state-desc">
                  No sanctioned On-Duty leave records found on VTOP for this semester. Click &quot;Fetch Live VTOP OD&quot; to probe leave modules.
                </p>
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
              <p className="card-description">Internal evaluation scores for CAT-1, CAT-2, Digital Assignments, and Quizzes</p>
            </div>
          </div>

          {marks.length > 0 ? (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>CAT-1</th>
                    <th>CAT-2</th>
                    <th>DA-1</th>
                    <th>DA-2</th>
                    <th>Quiz</th>
                    <th>Total Internal</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-color)' }}>{m.courseCode}</td>
                      <td style={{ fontWeight: 600 }}>{m.courseName || m.courseTitle}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.cat1?.scored !== null && m.cat1?.scored !== undefined ? `${m.cat1.scored}/${m.cat1.max}` : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.cat2?.scored !== null && m.cat2?.scored !== undefined ? `${m.cat2.scored}/${m.cat2.max}` : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.da1?.scored !== null && m.da1?.scored !== undefined ? `${m.da1.scored}/${m.da1.max}` : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.da2?.scored !== null && m.da2?.scored !== undefined ? `${m.da2.scored}/${m.da2.max}` : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.quiz?.scored !== null && m.quiz?.scored !== undefined ? `${m.quiz.scored}/${m.quiz.max}` : '-'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--brand-color)', fontFamily: 'var(--font-mono)' }}>
                        {m.totalInternal?.percentage ? `${m.totalInternal.percentage}%` : m.weightageScored ? `${m.weightageScored}%` : 'Grading in progress'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state-card">
              <div className="empty-state-icon-box">
                <Award size={24} />
              </div>
              <h4 className="empty-state-title">No Continuous Marks Published</h4>
              <p className="empty-state-desc">Marks will populate once uploaded by course instructors to the VTOP evaluation portal.</p>
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
                <span>Examination Schedule & Hall Tickets</span>
              </h3>
              <p className="card-description">Official examination dates, reporting times, hall venues, and seat allocations</p>
            </div>
          </div>

          {exams.length > 0 ? (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Exam Type</th>
                    <th>Date</th>
                    <th>Session & Time</th>
                    <th>Hall / Venue</th>
                    <th>Seat Number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-color)' }}>{ex.courseCode || ex.subjectCode}</td>
                      <td style={{ fontWeight: 600 }}>{ex.examType || ex.title}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ex.date}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{ex.time || `${ex.startTime} - ${ex.endTime}`}</td>
                      <td>{ex.venue || ex.room || 'Academic Block'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ex.seatNumber || '-'}</td>
                      <td>
                        <span className="status-badge info">
                          {ex.status || 'Scheduled'}
                        </span>
                      </td>
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
              <h4 className="empty-state-title">No Exam Schedules Published</h4>
              <p className="empty-state-desc">Examination timetables are published by the Controller of Examinations prior to CAT and FAT cycles.</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: FACULTY ===================== */}
      {activeTab === 'faculty' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Users size={18} color="var(--brand-color)" />
                <span>Faculty Directory & Course Instructors</span>
              </h3>
              <p className="card-description">Contact details, department affiliations, and cabin office locations</p>
            </div>
          </div>

          {faculty.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {faculty.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="user-avatar-circle" style={{ width: '36px', height: '36px' }}>
                      {f.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{f.name}</h4>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{f.designation || 'Faculty Member'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    {f.courseCode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={13} color="var(--brand-color)" />
                        <span>Course: <b>{f.courseCode}</b></span>
                      </div>
                    )}
                    {f.venue && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="var(--text-muted)" />
                        <span>Venue: {f.venue}</span>
                      </div>
                    )}
                    {f.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={13} color="var(--text-muted)" />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{f.email}</span>
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
              <h4 className="empty-state-title">No Faculty Directory Data</h4>
              <p className="empty-state-desc">Synchronize with VTOP to populate faculty instructor details for active registered courses.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VtopSyncView;
