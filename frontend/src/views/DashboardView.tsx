import React, { useState } from 'react';
import { StudentProfile, TimetableSlot, DayOfWeek } from '../types';
import { MetricCard } from '../components/MetricCard';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  onSimulateAttendance: (courseCode: string, attended: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable,
  onSimulateAttendance,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('MON');

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
    MON: 'Monday, August 17',
    TUE: 'Tuesday, August 18',
    WED: 'Wednesday, August 19',
    THU: 'Thursday, August 20',
    FRI: 'Friday, August 21',
    SAT: 'Saturday, August 22',
  };

  return (
    <div className="page-content">
      {/* Hero Metrics Row */}
      <div className="metrics-grid">
        <MetricCard
          label="Overall Attendance"
          value={`${student.overallAttendance.percentage}%`}
          subtext={`${student.overallAttendance.attended} / ${student.overallAttendance.total} attended`}
          icon="📊"
          progressPercent={student.overallAttendance.percentage}
          variant={student.overallAttendance.percentage >= 80 ? 'emerald' : student.overallAttendance.percentage >= 75 ? 'amber' : 'crimson'}
        />

        <MetricCard
          label="Cumulative CGPA"
          value={student.cgpa.toFixed(2)}
          subtext={`Class Rank #${student.rank} • Sem 4`}
          icon="🎓"
          progressPercent={(student.cgpa / 10) * 100}
          variant="emerald"
        />

        <MetricCard
          label="Degree Credits"
          value={`${student.creditsEarned} / ${student.totalCreditsRequired}`}
          subtext="42.5% Degree Completed"
          icon="📚"
          progressPercent={(student.creditsEarned / student.totalCreditsRequired) * 100}
          variant="blue"
        />

        <MetricCard
          label="Enrolled Courses"
          value="6"
          subtext="5 Theory / Embedded + 1 Lab"
          icon="🏛"
          progressPercent={100}
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
            <span>{dayTitles[selectedDay]}</span>
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
                onSimulate={onSimulateAttendance}
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
