import React, { useState } from 'react';
import {
  StudentProfile,
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
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [loadingDebug, setLoadingDebug] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<any>(null);

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
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, var(--bg-surface) 100%)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="brand-logo-badge" style={{ width: '48px', height: '48px', fontSize: '1.4rem' }}>
            V
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>VTOP Chennai Integration Hub</h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: (student?.regNo && student.regNo !== 'Not available') ? 'var(--success-bg)' : 'rgba(255,255,255,0.08)',
                  color: (student?.regNo && student.regNo !== 'Not available') ? 'var(--success-emerald)' : 'var(--text-muted)',
                  border: `1px solid ${(student?.regNo && student.regNo !== 'Not available') ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                }}
              >
                {(student?.regNo && student.regNo !== 'Not available') ? '● AUTHORITATIVE VTOP DATA' : '○ DISCONNECTED'}
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
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: student.regNo !== 'Not available' ? 'var(--success-bg)' : 'var(--danger-bg)', color: student.regNo !== 'Not available' ? 'var(--success-emerald)' : 'var(--danger-crimson)', fontWeight: 700 }}>
            {student.regNo !== 'Not available' ? '✓ Profile' : '✕ Profile'}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: attendance.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: attendance.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
            {attendance.length > 0 ? `✓ Attendance (${attendance.length})` : '✕ Attendance'}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: timetable.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: timetable.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
            {timetable.length > 0 ? `✓ Timetable (${timetable.length})` : '✕ Timetable'}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: marks.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: marks.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
            {marks.length > 0 ? `✓ Marks (${marks.length})` : '✕ Marks'}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: hasValidOD ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: hasValidOD ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
            {hasValidOD ? `✓ OD (${odHoursCount}/40h)` : '✕ OD'}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: exams.length > 0 ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)', color: exams.length > 0 ? 'var(--success-emerald)' : 'var(--text-muted)', fontWeight: 700 }}>
            {exams.length > 0 ? `✓ Exams (${exams.length})` : '✕ Exams'}
          </span>
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
          {marks.length > 0 ? (
            marks.map((m) => (
              <div key={m.courseCode} className="course-card" style={{ gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="course-code-tag">{m.courseCode}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '4px' }}>{m.courseName}</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>👨‍🏫 Faculty: <b>{m.facultyName}</b></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                      {m.totalInternal ? `${m.totalInternal.percentage}%` : 'Not available'}
                    </div>
                    {m.totalInternal && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Internal: {m.totalInternal.scored} / {m.totalInternal.max} marks
                      </span>
                    )}
                  </div>
                </div>

                <table className="marks-breakdown-table">
                  <thead>
                    <tr>
                      <th>Assessment Name</th>
                      <th>Scored</th>
                      <th>Max Marks</th>
                      <th>Weightage</th>
                      <th>FAT Target Projection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.cat1 && (
                      <tr>
                        <td><b>Continuous Assessment Test 1 (CAT 1)</b></td>
                        <td style={{ color: 'var(--success-emerald)', fontWeight: 700 }}>
                          {m.cat1.scored !== null ? m.cat1.scored : 'Not available'}
                        </td>
                        <td>{m.cat1.max || 50}</td>
                        <td>{m.cat1.weightage || 15}%</td>
                        <td>{m.fat?.minNeededForS ? `Target S: ${m.fat.minNeededForS}+ in FAT` : 'Not available'}</td>
                      </tr>
                    )}
                    {m.cat2 && (
                      <tr>
                        <td><b>Continuous Assessment Test 2 (CAT 2)</b></td>
                        <td style={{ color: 'var(--success-emerald)', fontWeight: 700 }}>
                          {m.cat2.scored !== null ? m.cat2.scored : 'Not available'}
                        </td>
                        <td>{m.cat2.max || 50}</td>
                        <td>{m.cat2.weightage || 15}%</td>
                        <td>{m.fat?.minNeededForA ? `Target A: ${m.fat.minNeededForA}+ in FAT` : 'Not available'}</td>
                      </tr>
                    )}
                    {m.da1 && (
                      <tr>
                        <td><b>Digital Assignment 1 (DA 1)</b></td>
                        <td style={{ color: 'var(--success-emerald)', fontWeight: 700 }}>
                          {m.da1.scored !== null ? m.da1.scored : 'Not available'}
                        </td>
                        <td>{m.da1.max || 10}</td>
                        <td>{m.da1.weightage || 10}%</td>
                        <td>-</td>
                      </tr>
                    )}
                    {m.quiz && (
                      <tr>
                        <td><b>Online Quiz Assessment</b></td>
                        <td style={{ color: 'var(--success-emerald)', fontWeight: 700 }}>
                          {m.quiz.scored !== null ? m.quiz.scored : 'Not available'}
                        </td>
                        <td>{m.quiz.max || 10}</td>
                        <td>{m.quiz.weightage || 10}%</td>
                        <td>-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <div className="empty-state-box">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                No continuous assessment marks published on VTOP yet.
              </p>
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
        <div>
          {faculty.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {faculty.map((fac) => (
                <div key={fac.id} className="course-card" style={{ gap: '12px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--brand-bg)',
                        color: 'var(--brand-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                      }}
                    >
                      {(fac.name || 'Faculty Member')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{fac.name || 'Faculty Member'}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fac.designation || 'Faculty Member'}</p>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                    <div>Course: <b>{fac.courseCode} - {fac.courseTitle}</b></div>
                    <div>Slot: <b>{fac.slot || 'Not available'}</b> • Venue: <b>{fac.venue || 'Not available'}</b></div>
                    {fac.cabin && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>🏢 Cabin: {fac.cabin}</div>}
                    {fac.email && <div style={{ color: 'var(--brand-color)', fontSize: '0.75rem' }}>✉️ {fac.email}</div>}
                  </div>
                </div>
              ))}
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
          <div
            style={{
              background: 'linear-gradient(135deg, #111622 0%, #1a2233 100%)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 26px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase' }}>
                Institutional On-Duty (OD) Records
              </span>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '2px' }}>
                {hasValidOD
                  ? `${odHoursCount ?? 0} of ${od?.maxHours || 40} Hours Utilized (${od?.percentageUsed ?? Math.round(((odHoursCount || 0) / (od?.maxHours || 40)) * 100)}%)`
                  : `On-Duty Records (${od?.maxHours || 40}h Max Allowed)`}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Official sanctioned OD leaves for technical competitions, hackathons, and research paper presentations.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: hasValidOD ? 'var(--success-emerald)' : 'var(--text-muted)' }}>
                {hasValidOD ? `${od?.remainingHours ?? Math.max(0, (od?.maxHours || 40) - (odHoursCount || 0))} Hours` : `${od?.maxHours || 40} Hours`}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe Buffer Remaining</span>
            </div>
          </div>

          {/* OD Records List */}
          {hasValidOD && odRecordsList.length > 0 && (
            <div className="assignments-container">
              {odRecordsList.map((rec) => (
                <div key={rec.id} className="assignment-item-card" style={{ padding: '16px 20px' }}>
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
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700 }}>{rec.reason}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Subject: {rec.subjectTitle} {rec.approvedBy ? `• Approved by: ${rec.approvedBy}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: rec.isApproved ? 'var(--success-emerald)' : rec.status === 'Rejected' ? 'var(--danger-crimson)' : 'var(--amber-gold)' }}>
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
            <div className="empty-state-box">
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                ✓ Verified VTOP Check
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                No sanctioned On-Duty leave records found on VTOP for this semester (0 / 40h used).
              </p>
            </div>
          )}

          {!hasValidOD && od?.state === 'source_unavailable' && (
            <div className="empty-state-box" style={{ border: '1px dashed var(--border-medium)' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                ℹ️ On-Duty hours endpoint is not accessible from VTOP portal on this student account / route.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                If you have submitted OD forms, ensure they are approved on VTOP by your faculty advisor.
              </p>
            </div>
          )}

          {!hasValidOD && od?.state === 'parser_failed' && (
            <div className="empty-state-box" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--danger-crimson)', fontWeight: 700 }}>
                ⚠️ Unable to parse OD data from VTOP
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {od?.message || 'Header layout or table structure could not be identified.'}
              </p>
            </div>
          )}

          {!hasValidOD && !['source_unavailable', 'parser_failed'].includes(od?.state || '') && (
            <div className="empty-state-box">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                {od?.message || 'Sync with VTOP to inspect On-Duty status.'}
              </p>
            </div>
          )}
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
