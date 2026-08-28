import React, { useState } from 'react';
import { StudentProfile, TimetableSlot, DayOfWeek, OD } from '../types';
import { MetricCard } from '../components/MetricCard';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  od?: OD;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable,
  od,
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

  const odHoursCount = od?.usedHours ?? od?.odHours ?? od?.totalOdHours ?? (od?.hasValidData ? 0 : 0);
  const odRemaining = od?.remainingHours ?? Math.max(0, (od?.maxHours || 40) - (odHoursCount || 0));

  return (
    <div className="page-content">
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

        <MetricCard
          label="On-Duty (OD) Hours"
          value={`${odHoursCount} Hours`}
          subtext={`✓ ${odRemaining}h Safe Buffer Available`}
          icon="⏱"
          progressPercent={Math.min(100, Math.max(0, ((odHoursCount || 0) / (od?.maxHours || 40)) * 100))}
          variant="blue"
        />

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
