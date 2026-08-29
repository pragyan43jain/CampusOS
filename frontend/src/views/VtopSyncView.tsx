import React, { useState } from 'react';
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
import { RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  courses = [],
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
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [loadingDebug, setLoadingDebug] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<any>(null);

  // Live OD Fetch from VTOP CC
  const [odSyncing, setOdSyncing] = useState(false);
  const [odActionMessage, setOdActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // StudentCC OD Attendance Simulator
  const [calcCourseCode, setCalcCourseCode] = useState<string>('');
  const [calcOdHours, setCalcOdHours] = useState<number>(2);

  const handleFetchOdFromVtop = async () => {
    setOdSyncing(true);
    setOdActionMessage({ text: 'Connecting to VTOP CC to query On-Duty records...', type: 'info' });
    try {
      const res = await CampusAPI.syncOD();
      if (res.success) {
        setOdActionMessage({ text: res.message || 'Successfully fetched OD hours from VTOP CC!', type: 'success' });
        onForceSync();
      } else if (res.sessionExpired) {
        setOdActionMessage({ text: 'VTOP CC session has expired. Opening authentication modal...', type: 'info' });
        setTimeout(() => {
          onOpenSyncModal();
        }, 800);
      } else {
        setOdActionMessage({ text: res.message || 'Failed to fetch OD from VTOP CC.', type: 'error' });
      }
    } catch (err: any) {
      setOdActionMessage({ text: err.message || 'Error communicating with VTOP CC.', type: 'error' });
    } finally {
      setOdSyncing(false);
    }
  };

  const todayDay = 'MON';
  const todaysSlots = timetable.filter((s) => s.day === todayDay);

  const overallAtt = student.overallAttendance;
  const hasAttendance = overallAtt && overallAtt.percentage !== null && overallAtt.percentage !== undefined;

  const criticalSubjects = attendance.filter((a) => a.attendancePercentage !== null && a.attendancePercentage !== undefined && a.attendancePercentage < 75);

  const cgpaDisplay = student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : "Not available";
  const creditsDisplay = student.creditsEarned !== null && student.creditsEarned !== undefined ? `${student.creditsEarned} / ${student.totalCreditsRequired || 160}` : "Not available";
  
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
  const odValueDisplay = odHoursCount !== null && odHoursCount !== undefined ? `${odHoursCount}` : "Not available";
  const odCardSubtext = "40h Max Allowed";

  return (
    <div className="page-content">
      {/* VTOP Sync Control Header Bar */}
      <div
        style={{
          background: 'var(--card-banner-bg)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          boxShadow: 'var(--glow-card)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #28efce 0%, #6a59e5 50%, #fb7c4f 100%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="brand-logo-badge" style={{ width: '48px', height: '48px', fontSize: '1.4rem' }}>
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.3px' }}>VTOP Integration Protocol</h2>
              <span className="badge-chaingpt" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                <span className="pulse-dot" />
                {(student?.regNo && student.regNo !== 'Not available') ? 'AUTHORITATIVE VTOP CC' : 'DISCONNECTED'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Student: <b>{student?.name || 'Not logged in'}</b> ({student?.regNo || 'No Reg No'}) • {student?.program || 'VIT Chennai'} • Semester {student?.semester || 'N/A'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right', marginRight: '8px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Last Synchronized:</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {student?.lastSynced || 'Never'}
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={onForceSync}
            disabled={syncing}
            style={{ fontWeight: 700, fontSize: '0.85rem' }}
          >
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
              🔄
            </span>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            className="btn-outline"
            onClick={onOpenSyncModal}
            style={{ fontWeight: 700, fontSize: '0.85rem' }}
          >
            🔐 Connect VTOP
          </button>
        </div>
      </div>

      {/* Sync Health Audit Badges */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          VTOP Data Source Verification:
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('overview')}
            title="Student Profile"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: student.regNo !== 'Not available' ? 'var(--success-bg)' : 'var(--danger-bg)', color: student.regNo !== 'Not available' ? 'var(--success-emerald)' : 'var(--danger-crimson)', fontWeight: 700 }}
          >
            {student.regNo !== 'Not available' ? `✓ Profile (${student.regNo})` : '✕ Profile'}
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            title="View Attendance Records"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: attendance.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: attendance.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {attendance.length > 0 ? `✓ Attendance (${attendance.length})` : '✕ Attendance'}
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            title="View Today's Timetable"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: timetable.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: timetable.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {timetable.length > 0 ? `✓ Timetable (${timetable.length})` : '✕ Timetable'}
          </button>
          <button
            onClick={() => setActiveTab('marks')}
            title="View Continuous Assessment Marks"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: marks.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: marks.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {marks.length > 0 ? `✓ Marks (${marks.length})` : '⚠ Marks (0)'}
          </button>
          <button
            onClick={() => setActiveTab('od')}
            title="View On-Duty Records"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: hasValidOD ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: hasValidOD ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {hasValidOD ? `✓ OD (${odHoursCount}/40h)` : (od?.records?.length ? '✓ OD (0h / 40h)' : '⚠ OD unavailable')}
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            title="View Examination Hall Tickets"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: exams.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: exams.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {exams.length > 0 ? `✓ Exams (${exams.length})` : '⚠ Exams unavailable'}
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            title="View Faculty & Advisors"
            style={{ border: 'none', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: faculty.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: faculty.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}
          >
            {faculty.length > 0 ? `✓ Faculty (${faculty.length})` : '⚠ Faculty unavailable'}
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        {[
          { id: 'overview', label: '📊 Dashboard Overview' },
          { id: 'attendance', label: `📈 Attendance (${attendance.length})` },
          { id: 'od', label: `⏱ On-Duty (${hasValidOD ? `${odHoursCount}/40h` : 'OD'})` },
          { id: 'marks', label: `🎯 Continuous Marks (${marks.length})` },
          { id: 'exams', label: `📝 Exams Schedule (${exams.length})` },
          { id: 'faculty', label: `👨‍🏫 Faculty (${faculty.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ fontSize: '0.84rem', padding: '6px 14px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB: OVERVIEW ===================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Key Metrics Grid */}
          <div className="metrics-grid">
            <MetricCard
              label="Cumulative CGPA"
              value={cgpaDisplay}
              subtext={student.rank ? `Class Rank #${student.rank} • ${creditsDisplay} Credits` : `${creditsDisplay} Credits`}
              icon="🎓"
              progressPercent={student.cgpa ? (student.cgpa / 10) * 100 : 0}
              variant="emerald"
            />

            <MetricCard
              label="Overall Attendance"
              value={hasAttendance ? `${overallAtt.percentage}%` : "Not available"}
              subtext={hasAttendance ? `${overallAtt.attended} / ${overallAtt.total} Classes Attended` : "VTOP Sync Required"}
              icon="📊"
              progressPercent={hasAttendance ? overallAtt.percentage : 0}
              variant={hasAttendance ? (overallAtt.percentage >= 80 ? 'emerald' : overallAtt.percentage >= 75 ? 'amber' : 'crimson') : 'blue'}
            />

            <MetricCard
              label="On-Duty (OD) Hours"
              value={odValueDisplay}
              subtext={odCardSubtext}
              icon="⏱"
              progressPercent={hasValidOD && odHoursCount !== null ? Math.min(100, Math.max(0, (odHoursCount / (od?.maxHours || 40)) * 100)) : 0}
              variant="blue"
            />

            <MetricCard
              label="Upcoming Exams"
              value={exams.length > 0 ? `${exams.length}` : "Not scheduled"}
              subtext={exams.length > 0 ? `Next: ${exams[0]?.subjectCode} on ${exams[0]?.date}` : "No active hall tickets"}
              icon="📝"
              progressPercent={exams.length > 0 ? 100 : 0}
              variant="emerald"
            />
          </div>

          {/* OD Usage Meter Visualizer */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Institutional Regulations
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                  ⏱ On-Duty (OD) Allowance & Utilization
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Maximum permissible OD credit limit is <b>40 hours</b> per academic semester.
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                  {od && od.usedHours !== null && od.usedHours !== undefined ? `${od.usedHours}h` : 'Not available'}{' '}
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 40h Max</span>
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--success-emerald)', fontWeight: 700 }}>
                  {od && od.remainingHours !== null && od.remainingHours !== undefined ? `✓ ${od.remainingHours} Hours Available` : 'Sync for exact hours'}
                </div>
              </div>
            </div>

            {od && od.percentageUsed !== null && od.percentageUsed !== undefined ? (
              <div>
                <div className="progress-track" style={{ height: '12px', borderRadius: '6px' }}>
                  <div
                    className="progress-fill emerald"
                    style={{
                      width: `${od.percentageUsed}%`,
                      borderRadius: '6px',
                      background: 'linear-gradient(90deg, var(--brand-color) 0%, var(--success-emerald) 100%)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <span>0 Hours</span>
                  <span>10h (25%)</span>
                  <span>20h (50%)</span>
                  <span>30h (75%)</span>
                  <span>40 Hours (100% Limit)</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                On-Duty leave data has not been logged on VTOP for the current semester.
              </div>
            )}
          </div>

          {/* Today's Timetable with Room & Block Details */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📅</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Today's Lectures & Labs (Monday)</h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {todaysSlots.length} Classes Scheduled Today
              </span>
            </div>

            {todaysSlots.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {todaysSlots.map((slot) => {
                  const roomObj = slot.room || {
                    roomNumber: 'Not available',
                    blockName: 'Academic Block',
                    fullVenue: slot.venue || 'Not available',
                  };

                  return (
                    <div
                      key={slot.id}
                      className="course-card"
                      style={{
                        padding: '16px 18px',
                        borderLeft: slot.isLab ? '4px solid #c084fc' : '4px solid var(--brand-color)',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="course-code-tag">{slot.subjectCode || slot.courseCode}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, marginLeft: '6px', color: 'var(--text-muted)' }}>
                            Slot: <b>{slot.slot || slot.slotName}</b>
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: slot.isLab ? 'rgba(192, 132, 252, 0.15)' : 'var(--brand-bg)',
                            color: slot.isLab ? '#c084fc' : 'var(--brand-color)',
                          }}
                        >
                          {slot.isLab ? '🔬 Practical Lab' : '📖 Theory'}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                          {slot.subject || slot.courseTitle}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          👨‍🏫 {slot.faculty}
                        </p>
                      </div>

                      <div
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Time: </span>
                          <b>{slot.startTime} – {slot.endTime}</b>
                        </div>
                        <div>
                          <span style={{ color: 'var(--brand-color)', fontWeight: 700 }}>
                            📍 {roomObj.blockName} • {roomObj.roomNumber}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-box">
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  No classes scheduled for today on your VTOP timetable.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB: ATTENDANCE ===================== */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {criticalSubjects.length > 0 && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                color: 'var(--danger-crimson)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              🚨 Critical Attendance Alert: You have {criticalSubjects.length} subject(s) below 75% threshold!
            </div>
          )}

          {attendance.length > 0 ? (
            <div className="courses-grid">
              {attendance.map((att) => {
                const hasPct = att.attendancePercentage !== null && att.attendancePercentage !== undefined;
                const isCrit = hasPct && att.attendancePercentage! < 75;

                return (
                  <div key={att.courseCode} className="course-card" style={{ gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="course-code-tag">{att.courseCode}</span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>{att.courseName}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>👨‍🏫 {att.facultyName}</p>
                      </div>
                      <span className={`attendance-percentage-pill ${isCrit ? 'critical' : 'safe'}`}>
                        {hasPct ? `${att.attendancePercentage}%` : 'Not available'}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span>
                          Attended: <b>{att.classesAttended !== null ? `${att.classesAttended} / ${att.classesConducted}` : 'Not available'}</b> classes
                        </span>
                        <span style={{ color: isCrit ? 'var(--danger-crimson)' : 'var(--success-emerald)', fontWeight: 700 }}>
                          {att.safeToMiss !== null && att.safeToMiss > 0
                            ? `Safe to miss ${att.safeToMiss} classes`
                            : att.needToAttend !== null && att.needToAttend > 0
                            ? `Need to attend next ${att.needToAttend} classes`
                            : 'Borderline'}
                        </span>
                      </div>
                      {hasPct && (
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${isCrit ? 'crimson' : 'emerald'}`}
                            style={{ width: `${att.attendancePercentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-box">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                No attendance records retrieved from VTOP. Connect or sync your account.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: MARKS ===================== */}
      {activeTab === 'marks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Bar with Status and Refresh */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>🎯 VTOP Continuous Assessment Marks</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Directly synchronized from VTOP examinations module. Shows authentic CAT-1, CAT-2, DA, and Quiz marks per enrolled subject.
              </p>
            </div>
            <button
              className="btn-outline"
              onClick={onForceSync}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            >
              <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
              <span>{syncing ? 'Syncing...' : 'Refresh Marks'}</span>
            </button>
          </div>

          {syncing ? (
            <div className="empty-state-box" style={{ padding: '40px 20px' }}>
              <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 12px', color: 'var(--brand-color)' }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Loading marks from VTOP...</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Querying examination continuous assessment tables.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
              {(courses.length > 0 ? courses : marks.map(m => ({ id: m.courseCode, code: m.courseCode, title: m.courseTitle || m.courseName, faculty: m.faculty || m.facultyName, slot: m.slot, type: 'Theory' }))).map((course) => {
                const courseCode = course.code || course.id;
                const m = marks.find((item) => (item.courseCode || '').toUpperCase() === (courseCode || '').toUpperCase());
                const rawComponents = m?.components || (Array.isArray((course as any).marks) ? (course as any).marks : []);
                const hasAuthenticMarks = rawComponents && rawComponents.length > 0;
                const facultyName = m?.faculty || m?.facultyName || course.faculty || 'Faculty unassigned';
                const courseTitle = course.title || m?.courseTitle || m?.courseName || courseCode;

                const totalScored = m?.weightageScored ?? (hasAuthenticMarks ? rawComponents.reduce((acc: number, c: any) => acc + (c.scored || 0), 0) : null);
                const totalGraded = m?.weightageGraded ?? (hasAuthenticMarks ? rawComponents.reduce((acc: number, c: any) => acc + (c.maxWeightage || c.max || 0), 0) : null);
                const totalPct = m?.totalInternal?.percentage ?? (totalScored !== null && totalGraded ? Number(((totalScored / totalGraded) * 100).toFixed(1)) : null);

                return (
                  <div
                    key={courseCode}
                    className="course-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '280px',
                      gap: '16px',
                      padding: '22px',
                    }}
                  >
                    {/* Header */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="course-code-tag">{courseCode}</span>
                            {course.slot && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Slot: <b>{course.slot}</b>
                              </span>
                            )}
                          </div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '6px' }}>{courseTitle}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            👨‍🏫 Faculty: <b>{facultyName}</b>
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {hasAuthenticMarks && totalPct !== null ? (
                            <>
                              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalPct >= 75 ? 'var(--success-emerald)' : totalPct >= 50 ? 'var(--warning-amber)' : 'var(--danger-crimson)' }}>
                                {totalPct}%
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Internal: {totalScored} / {totalGraded} marks
                              </span>
                            </>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                              }}
                            >
                              ⏳ Evaluation Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Body: Table of authentic marks or clean empty state */}
                    <div style={{ flex: 1 }}>
                      {hasAuthenticMarks ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="marks-breakdown-table">
                            <thead>
                              <tr>
                                <th>Assessment Name</th>
                                <th>Scored</th>
                                <th>Max</th>
                                <th>Weightage</th>
                                <th>Percentage</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rawComponents.map((comp: any, cIdx: number) => {
                                const scoredVal = comp.scored !== null && comp.scored !== undefined ? comp.scored : null;
                                const maxVal = comp.max || comp.maxMark || 50;
                                const weightVal = comp.weightage !== undefined && comp.weightage !== null ? comp.weightage : (comp.maxWeightage || 15);
                                const pctVal = comp.percentage !== undefined && comp.percentage !== null
                                  ? comp.percentage
                                  : (scoredVal !== null && maxVal ? Number(((scoredVal / maxVal) * 100).toFixed(1)) : null);

                                return (
                                  <tr key={cIdx}>
                                    <td><b>{comp.title || 'Assessment Component'}</b></td>
                                    <td style={{ color: scoredVal !== null ? (scoredVal / maxVal >= 0.75 ? 'var(--success-emerald)' : scoredVal / maxVal >= 0.5 ? 'var(--warning-amber)' : 'var(--danger-crimson)') : 'var(--text-muted)', fontWeight: 700 }}>
                                      {scoredVal !== null ? scoredVal : 'Pending'}
                                    </td>
                                    <td>{maxVal}</td>
                                    <td>{weightVal}%</td>
                                    <td>{pctVal !== null ? `${pctVal}%` : '-'}</td>
                                    <td>
                                      <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: scoredVal !== null ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: scoredVal !== null ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
                                        {comp.status || (scoredVal !== null ? 'Present' : 'Upcoming')}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '16px',
                            textAlign: 'center',
                          }}
                        >
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>
                            No assessment records returned by VTOP
                          </p>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                            Faculty has not published continuous assessment marks for this subject yet.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer: FAT Target Projection Notice */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {hasAuthenticMarks && rawComponents.length >= 3 ? (
                        <div>FAT Target: Target calculated from internal scores.</div>
                      ) : (
                        <div style={{ fontStyle: 'italic' }}>
                          FAT projection unavailable until marks are synchronized.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: EXAMS SCHEDULE ===================== */}
      {activeTab === 'exams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>📅 Official Examination Hall Tickets & Schedule</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Continuous Assessment Tests (CAT-1/CAT-2) and Final Assessment Tests (FAT) seating allocation.
            </p>
          </div>

          {exams.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {exams.map((ex) => (
                <div key={ex.id} className="course-card" style={{ gap: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="course-code-tag">{ex.subjectCode}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: 'var(--brand-color)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ex.examType}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{ex.subject}</h4>
                    {ex.syllabusCoverage && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        📖 <b>Syllabus:</b> {ex.syllabusCoverage}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>📅 {ex.date}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>⏰ {ex.time}</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--brand-color)', fontWeight: 800 }}>📍 {ex.block}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Room: <b>{ex.room}</b> • Seat: <b>{ex.seatNumber || 'Not available'}</b>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-box">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                No active exam schedules or hall tickets available on VTOP for this semester.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: FACULTY MAPPING ===================== */}
      {activeTab === 'faculty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>👨‍🏫 Faculty & Academic Advisors</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Course instructors, Student Proctor, Department Head, and School Dean retrieved directly from VTOP.
            </p>
          </div>

          {faculty.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'stretch' }}>
              {faculty.map((fac) => {
                const isLeadership = fac.isLeadership || ['dean', 'head of the department', 'hod', 'proctor'].some(r => (fac.designation || '').toLowerCase().includes(r));
                const initials = (fac.name || 'Faculty Member')
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('');

                return (
                  <div
                    key={fac.id || fac.name}
                    className="course-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '210px',
                      padding: '20px',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: 'var(--radius-full)',
                              background: isLeadership ? 'rgba(168, 85, 247, 0.15)' : 'var(--brand-bg)',
                              color: isLeadership ? '#a855f7' : 'var(--brand-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1.1rem',
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <h4 style={{ fontSize: '1.02rem', fontWeight: 800 }}>{fac.name || 'Faculty Member'}</h4>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fac.designation || 'Faculty Member'}</p>
                          </div>
                        </div>

                        {isLeadership && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              textTransform: 'uppercase',
                            }}
                          >
                            {(fac.designation || 'LEADERSHIP').includes('DEAN') ? 'DEAN' : (fac.designation || '').includes('HoD') || (fac.designation || '').includes('Head') ? 'HOD' : 'PROCTOR'}
                          </span>
                        )}
                      </div>

                      {/* Course / Role details */}
                      <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                        {isLeadership ? (
                          <>
                            {(fac.cabin || fac.venue) && (
                              <div>🏢 Office / Cabin: <b>{fac.cabin || fac.venue}</b></div>
                            )}
                            {fac.email && (
                              <div>✉️ Email: <a href={`mailto:${fac.email}`} style={{ color: 'var(--brand-color)' }}>{fac.email}</a></div>
                            )}
                            {fac.phone && (
                              <div>📞 Phone: <b>{fac.phone}</b></div>
                            )}
                          </>
                        ) : (
                          <>
                            {fac.enrolledCourses && fac.enrolledCourses.length > 0 ? (
                              fac.enrolledCourses.map((c, idx) => (
                                <div key={idx}>
                                  <div>📖 Course: <b>{c.code} - {c.title}</b></div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                    Slot: <b>{c.slot || 'Course information unavailable'}</b> • Venue: <b>{c.venue || 'TBA'}</b>
                                  </div>
                                </div>
                              ))
                            ) : fac.courseCode && fac.courseCode !== '-' ? (
                              <>
                                <div>📖 Course: <b>{fac.courseCode} {fac.courseTitle ? `- ${fac.courseTitle}` : ''}</b></div>
                                <div>Slot: <b>{fac.slot || 'Course information unavailable'}</b> • Venue: <b>{fac.venue || 'TBA'}</b></div>
                              </>
                            ) : (
                              <div>📖 Course information unavailable</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-box">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                No faculty mapping records found.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: ON-DUTY (OD) ===================== */}
      {activeTab === 'od' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Action notification banner */}
          {odActionMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background:
                  odActionMessage.type === 'success'
                    ? 'var(--success-bg)'
                    : odActionMessage.type === 'error'
                    ? 'var(--danger-bg)'
                    : 'var(--brand-bg)',
                border: `1px solid ${
                  odActionMessage.type === 'success'
                    ? 'var(--success-border)'
                    : odActionMessage.type === 'error'
                    ? 'var(--danger-border)'
                    : 'var(--border-subtle)'
                }`,
                color:
                  odActionMessage.type === 'success'
                    ? 'var(--success-emerald)'
                    : odActionMessage.type === 'error'
                    ? 'var(--danger-crimson)'
                    : 'var(--brand-color)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {odActionMessage.type === 'success' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{odActionMessage.text}</span>
              </div>
              <button
                onClick={() => setOdActionMessage(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Top Banner with Action Buttons */}
          <div
            style={{
              background: 'var(--card-banner-bg)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 26px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                VTOP Chennai (CC) • Institutional On-Duty (OD) System
              </span>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                {hasValidOD
                  ? `${odHoursCount ?? 0} of ${od?.maxHours || 40} Hours Utilized (${od?.percentageUsed ?? Math.round(((odHoursCount || 0) / (od?.maxHours || 40)) * 100)}%)`
                  : `On-Duty Records (${od?.maxHours || 40}h Max Allowed)`}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Sanctioned OD leaves for technical competitions, hackathons, sports, and research conferences.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: hasValidOD ? 'var(--success-emerald)' : 'var(--text-primary)' }}>
                  {hasValidOD ? `${od?.remainingHours ?? Math.max(0, (od?.maxHours || 40) - (odHoursCount || 0))} Hours` : `${od?.maxHours || 40} Hours`}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe Buffer Remaining</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleFetchOdFromVtop}
                  disabled={odSyncing}
                  className="btn-primary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Fetch On-Duty hours directly from VTOP CC portal"
                >
                  <RefreshCw size={14} style={{ animation: odSyncing ? 'spin 1s linear infinite' : 'none' }} />
                  <span>{odSyncing ? 'Fetching...' : 'Fetch OD from VTOP CC'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* OD Records List */}
          {hasValidOD && odRecordsList.length > 0 && (
            <div className="assignments-container">
              {odRecordsList.map((rec) => (
                <div key={rec.id} className="assignment-item-card" style={{ padding: '16px 20px', background: 'var(--bg-surface)' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span className="course-code-tag">{rec.subjectCode}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {rec.fromDate && rec.toDate && rec.fromDate !== rec.toDate ? `${rec.fromDate} - ${rec.toDate}` : rec.date}
                      </span>
                      {(rec.fromTime || rec.toTime || rec.timeRange) && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--brand-blue)', fontWeight: 600 }}>
                          ⏰ {rec.timeRange || `${rec.fromTime || ''} - ${rec.toTime || ''}`}
                        </span>
                      )}
                      {rec.slot && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--brand-color)', fontWeight: 700 }}>
                          Slot: {rec.slot}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{rec.reason}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                      Subject: {rec.subjectTitle} {rec.approvedBy ? `• Approved by: ${rec.approvedBy}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: rec.isApproved ? 'var(--success-emerald)' : rec.status === 'Rejected' ? 'var(--danger-crimson)' : 'var(--warning-amber)' }}>
                      +{rec.hours} Hours OD
                    </div>
                    <span className={`attendance-percentage-pill ${rec.isApproved ? 'safe' : rec.status === 'Rejected' ? 'critical' : 'amber'}`}>
                      {rec.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasValidOD && odRecordsList.length === 0 && (
            <div className="empty-state-box" style={{ background: 'var(--bg-surface)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                ✓ Verified VTOP CC Check
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                No sanctioned On-Duty leave records currently filed on VTOP CC for this semester (0 / 40h used).
              </p>
            </div>
          )}

          {!hasValidOD && (
            <div className="empty-state-box" style={{ border: '1px dashed var(--border-medium)', background: 'var(--bg-surface)' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
                Fetch Live OD Hours from VTOP CC
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '500px', margin: '4px auto 14px auto' }}>
                Click below to query VTOP CC. If your session is active, your hours will update immediately; otherwise, you will be prompted to solve the captcha to authenticate.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={handleFetchOdFromVtop}
                  disabled={odSyncing}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} style={{ animation: odSyncing ? 'spin 1s linear infinite' : 'none' }} />
                  <span>{odSyncing ? 'Connecting...' : 'Fetch OD from VTOP CC'}</span>
                </button>
              </div>
            </div>
          )}

          {/* StudentCC-Inspired OD Attendance Impact & Buffer Simulator */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 26px',
              marginTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  StudentCC • OD Attendance Impact Simulator
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                  Calculate Attendance Impact for Prospective / Sanctioned ODs
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Select an enrolled course and simulate how OD hours/classes shift your attendance percentage and buffer margin.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Select Registered Course
                </label>
                <select
                  value={calcCourseCode || (attendance[0]?.courseCode || '')}
                  onChange={(e) => setCalcCourseCode(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}
                >
                  {attendance.map((att) => (
                    <option key={att.courseCode} value={att.courseCode}>
                      {att.courseCode} - {att.courseTitle || 'Enrolled Course'} ({att.attendancePercentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  OD Hours / Classes to Sanction
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 4, 6].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setCalcOdHours(hrs)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: calcOdHours === hrs ? '1px solid var(--brand-color)' : '1px solid var(--border-subtle)',
                        background: calcOdHours === hrs ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-surface-elevated)',
                        color: calcOdHours === hrs ? 'var(--brand-color)' : 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      +{hrs}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Impact Calculation Result Display */}
            {(() => {
              const selectedAtt = attendance.find(
                (a) => (a.courseCode || '').toUpperCase() === (calcCourseCode || (attendance[0]?.courseCode || '')).toUpperCase()
              ) || attendance[0];

              if (!selectedAtt || selectedAtt.classesAttended === null || selectedAtt.classesConducted === null) {
                return null;
              }

              const currAtt = selectedAtt.classesAttended;
              const total = selectedAtt.classesConducted;
              const currPct = selectedAtt.attendancePercentage;
              const newAtt = currAtt + calcOdHours;
              const newPct = total > 0 ? Number(((newAtt / total) * 100).toFixed(1)) : 0;
              const floorPct = total > 0 ? Math.floor((newAtt * 100.0) / total) : 0;
              const diff = Number((newPct - currPct).toFixed(1));
              const newSafeToMiss = total > 0 ? Math.max(0, Math.floor((newAtt - (0.75 * total)) / 0.75)) : 0;

              return (
                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Attendance</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {currPct}% <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({currAtt} / {total})</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>With +{calcOdHours}h OD Applied</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: newPct >= 75 ? 'var(--success-emerald)' : 'var(--danger-crimson)' }}>
                      {newPct}% <span style={{ fontSize: '0.82rem', color: 'var(--success-emerald)', fontWeight: 700 }}>(+{diff}%)</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>StudentCC Standard (Floor)</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                      {floorPct}%
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe Classes Margin</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success-emerald)' }}>
                      {newSafeToMiss} {newSafeToMiss === 1 ? 'class' : 'classes'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================== DEVELOPER VTOP DIAGNOSTICS ===================== */}
      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            🛠️ Development Mode Telemetry & Engine Diagnostics
          </span>
          <button
            onClick={async () => {
              if (showDebug) {
                setShowDebug(false);
              } else {
                setLoadingDebug(true);
                try {
                  const dbg = await CampusAPI.getVtopDebug();
                  setDebugData(dbg);
                  setShowDebug(true);
                } catch (e) {
                  console.warn('Debug fetch failed', e);
                } finally {
                  setLoadingDebug(false);
                }
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-medium)',
              color: 'var(--brand-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loadingDebug ? 'Loading Diagnostics...' : showDebug ? '▲ Hide Engine Debug' : '▼ Inspect VTOP Raw Telemetry'}
          </button>
        </div>

        {showDebug && debugData && (
          <div
            style={{
              marginTop: '12px',
              background: '#0d1117',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: '#58a6ff',
              overflowX: 'auto',
              maxHeight: '400px',
            }}
          >
            <pre style={{ margin: 0 }}>
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default VtopSyncView;
