import React, { useState } from 'react';
import {
  Percent,
  Clock,
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
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

  const uniqueCoursesCount = new Set(timetable.map((t) => t.courseCode || t.subjectCode).filter(Boolean)).size;

  const cgpaDisplay =
    student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'Data unavailable';
  const creditsDisplay =
    student.creditsEarned !== null && student.creditsEarned !== undefined
      ? `${student.creditsEarned} / ${student.totalCreditsRequired || 160}`
      : 'Data unavailable';

  const odHoursCount = od?.usedHours ?? od?.odHours ?? od?.totalOdHours ?? (od?.hasValidData ? 0 : null);
  const odRemaining = od?.remainingHours ?? Math.max(0, (od?.maxHours || 40) - (odHoursCount || 0));

  const isAuth = Boolean(student?.regNo && student.regNo !== 'Not available');

  return (
    <div className="page-container">
      {/* Hero Welcome Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <Sparkles size={13} />
              <span>{isAuth ? 'VTOP Verified Session' : 'Offline Mode'}</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>{student.program || 'VIT Chennai'} • Semester {student.semester || 'N/A'}</span>
            </div>

            <h2 className="hero-heading">
              Welcome back, {student.name ? student.name.split(' ')[0] : 'Student'}
            </h2>
            <p className="hero-desc">
              Academic command center tracking timetable slots, attendance safety buffers, continuous assessments, and degree progression.
            </p>
          </div>

          <button
            onClick={onOpenSyncModal}
            className="btn btn-primary"
          >
            <RefreshCw size={14} />
            <span>Sync VTOP Hub</span>
          </button>
        </div>
      </div>

      {/* Main 5-Column Statistics Grid */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Overall Attendance"
          value={hasAttendance && attendance ? `${attendance.percentage}%` : 'Data unavailable'}
          subtext={hasAttendance && hasAttCounts ? `${attAttended} / ${attTotal} classes attended` : 'VTOP sync required'}
          icon={<Percent size={16} />}
          progressPercent={hasAttendance ? attPct : 0}
          variant={hasAttendance ? (attPct >= 80 ? 'emerald' : attPct >= 75 ? 'amber' : 'crimson') : 'cyan'}
        />

        <MetricCard
          label="On-Duty (OD) Hours"
          value={odHoursCount !== null && odHoursCount !== undefined ? `${odHoursCount} Hours` : 'Data unavailable'}
          subtext={odHoursCount !== null && odHoursCount !== undefined ? `✓ ${odRemaining}h safe limit available` : 'VTOP sync required'}
          icon={<Clock size={16} />}
          progressPercent={Math.min(100, Math.max(0, ((odHoursCount || 0) / (od?.maxHours || 40)) * 100))}
          variant="cyan"
          onClick={onOpenSyncModal}
        />

        <MetricCard
          label="Cumulative CGPA"
          value={cgpaDisplay}
          subtext={student.rank ? `Class Rank #${student.rank} • Performance` : 'Academic performance'}
          icon={<GraduationCap size={16} />}
          progressPercent={student.cgpa ? (student.cgpa / 10) * 100 : 0}
          variant="emerald"
        />

        <MetricCard
          label="Degree Credits"
          value={creditsDisplay}
          subtext={
            student.creditsEarned && student.totalCreditsRequired
              ? `${((student.creditsEarned / student.totalCreditsRequired) * 100).toFixed(1)}% degree completed`
              : 'Official degree progress'
          }
          icon={<Award size={16} />}
          progressPercent={
            student.creditsEarned && student.totalCreditsRequired
              ? (student.creditsEarned / student.totalCreditsRequired) * 100
              : 0
          }
          variant="cyan"
        />

        <MetricCard
          label="Enrolled Courses"
          value={uniqueCoursesCount > 0 ? `${uniqueCoursesCount}` : 'Data unavailable'}
          subtext="Active registered subjects"
          icon={<BookOpen size={16} />}
          progressPercent={uniqueCoursesCount > 0 ? 100 : 0}
          variant="cyan"
        />
      </div>

      {/* Week Selector Bar */}
      <WeekSelector
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        dayClassCounts={dayClassCounts}
      />

      {/* Daily Class Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {dayTitles[selectedDay]} Classes
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ({filteredSlots.length} {filteredSlots.length === 1 ? 'lecture' : 'lectures'} scheduled)
            </span>
          </div>
        </div>

        {filteredSlots.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredSlots.map((slot) => (
              <TimetableSlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        ) : (
          <div className="empty-state-card card">
            <div className="empty-state-icon-box">
              <Calendar size={24} />
            </div>
            <h4 className="empty-state-title">No Lectures Scheduled</h4>
            <p className="empty-state-desc">
              No classes are timetabled for {dayTitles[selectedDay]}. Use this free slot for self-study, assignment preparation, or revision with the AI Study Planner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
