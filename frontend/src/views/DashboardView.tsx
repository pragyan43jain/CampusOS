import React, { useState } from 'react';
import { StudentProfile, TimetableSlot, DayOfWeek, OD } from '../types';
import { MetricCard } from '../components/MetricCard';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  od?: OD;
  onOpenSyncModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable,
  od,
  onOpenSyncModal,
}) => {
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

  const attendance = student.overallAttendance;
  const hasAttendance = Boolean(
    attendance &&
    attendance.percentage !== null &&
    attendance.percentage !== undefined &&
    attendance.hasValidData !== false
  );
  const hasAttCounts = Boolean(
    attendance &&
    attendance.attended !== null &&
    attendance.attended !== undefined &&
    attendance.total !== null &&
    attendance.total !== undefined
  );
  
  const attPct = attendance?.percentage ?? 0;
  const attAttended = attendance?.attended ?? 0;
  const attTotal = attendance?.total ?? 0;

  const uniqueCoursesCount = new Set(timetable.map(t => t.courseCode || t.subjectCode).filter(Boolean)).size;

  const cgpaDisplay = student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : "Not available";
  const creditsDisplay = student.creditsEarned !== null && student.creditsEarned !== undefined 
    ? `${student.creditsEarned} / ${student.totalCreditsRequired || 160}` 
    : "Not available";

  const odHoursCount = od?.usedHours ?? od?.odHours ?? od?.totalOdHours ?? (od?.hasValidData ? 0 : null);
  const odRemaining = od?.remainingHours ?? Math.max(0, (od?.maxHours || 40) - (odHoursCount || 0));

  return (
    <div className="page-content">
      {/* ChainGPT Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(40, 239, 206, 0.08) 0%, rgba(106, 89, 229, 0.08) 50%, rgba(251, 124, 79, 0.05) 100%), #0e0e16',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--glow-card)',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #28efce 0%, #6a59e5 50%, #fb7c4f 100%)' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge-chaingpt">
                <span className="pulse-dot" />
                CHAINGPT ACADEMIC PROTOCOL v2.0
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ● VIT CHENNAI NODE
              </span>
            </div>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #ffffff 30%, #28efce 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Welcome back, {student.name ? student.name.split(' ')[0] : 'Scholar'} ⚡
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '600px' }}>
              Autonomous intelligence powering your VTOP academic schedule, attendance buffer optimization, and real-time GPA tracking.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenSyncModal}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.86rem' }}
            >
              <span>⚡</span>
              <span>Sync VTOP Engine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Metrics Row */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <MetricCard
          label="Overall Attendance"
          value={hasAttendance && attendance ? `${attendance.percentage}%` : "Not available"}
          subtext={hasAttendance && hasAttCounts ? `${attAttended} / ${attTotal} classes attended` : "VTOP sync required"}
          icon="📊"
          progressPercent={hasAttendance ? attPct : 0}
          variant={hasAttendance ? (attPct >= 80 ? 'emerald' : attPct >= 75 ? 'amber' : 'crimson') : 'blue'}
        />

        <div onClick={onOpenSyncModal} style={{ cursor: 'pointer' }} title="Click to fetch or view live On-Duty (OD) hours from VTOP CC">
          <MetricCard
            label="On-Duty (OD) Hours"
            value={odHoursCount !== null && odHoursCount !== undefined ? `${odHoursCount} Hours` : "Sync VTOP CC"}
            subtext={odHoursCount !== null && odHoursCount !== undefined ? `✓ ${odRemaining}h Safe Buffer Available` : "Click to fetch live from VTOP"}
            icon="⏱"
            progressPercent={Math.min(100, Math.max(0, (((odHoursCount || 0)) / (od?.maxHours || 40)) * 100))}
            variant="blue"
          />
        </div>

        <MetricCard
          label="Cumulative CGPA"
          value={cgpaDisplay}
          subtext={student.rank ? `Class Rank #${student.rank} • Semester ${student.semester || 'N/A'}` : `Semester ${student.semester || 'N/A'}`}
          icon="🎓"
          progressPercent={student.cgpa ? (student.cgpa / 10) * 100 : 0}
          variant="emerald"
        />

        <MetricCard
          label="Degree Credits"
          value={creditsDisplay}
          subtext={student.creditsEarned && student.totalCreditsRequired ? `${((student.creditsEarned / student.totalCreditsRequired) * 100).toFixed(1)}% Degree Completed` : "Official Degree Progress"}
          icon="📚"
          progressPercent={student.creditsEarned && student.totalCreditsRequired ? (student.creditsEarned / student.totalCreditsRequired) * 100 : 0}
          variant="blue"
        />

        <MetricCard
          label="Enrolled Courses"
          value={uniqueCoursesCount > 0 ? `${uniqueCoursesCount}` : "Not available"}
          subtext="Active Academic Registration"
          icon="🏛"
          progressPercent={uniqueCoursesCount > 0 ? 100 : 0}
          variant="blue"
        />
      </div>

      {/* Week Selector */}
      <WeekSelector
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        dayClassCounts={dayClassCounts}
      />

      {/* Daily Timetable */}
      <div className="timetable-section">
        <div className="section-header">
          <div className="section-title">
            <span>📅</span>
            <span>{dayTitles[selectedDay]} Schedule</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ({filteredSlots.length} {filteredSlots.length === 1 ? 'class' : 'classes'} scheduled)
            </span>
          </div>
        </div>

        {filteredSlots.length > 0 ? (
          <div className="timetable-list">
            {filteredSlots.map((slot) => (
              <TimetableSlotCard
                key={slot.id}
                slot={slot}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state-box">
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No lectures scheduled for {dayTitles[selectedDay]}.
            </p>
            <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
              Enjoy your free time or prepare with the AI Study Planner!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
