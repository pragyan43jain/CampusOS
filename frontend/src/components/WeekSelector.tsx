import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { DayOfWeek } from '../types';

interface WeekSelectorProps {
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  dayClassCounts: Record<DayOfWeek, number>;
}

export const WeekSelector: React.FC<WeekSelectorProps> = ({
  selectedDay,
  onSelectDay,
  dayClassCounts,
}) => {
  const days: { day: DayOfWeek; shortName: string; fullName: string }[] = [
    { day: 'MON', shortName: 'Mon', fullName: 'Monday' },
    { day: 'TUE', shortName: 'Tue', fullName: 'Tuesday' },
    { day: 'WED', shortName: 'Wed', fullName: 'Wednesday' },
    { day: 'THU', shortName: 'Thu', fullName: 'Thursday' },
    { day: 'FRI', shortName: 'Fri', fullName: 'Friday' },
    { day: 'SAT', shortName: 'Sat', fullName: 'Saturday' },
  ];

  return (
    <div className="card" style={{ padding: '16px 20px', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-icon-box" style={{ width: '32px', height: '32px' }}>
            <Calendar size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Weekly Timetable & Schedule
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Select a day to review scheduled lectures, venues, and attendance buffers
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <Clock size={13} />
          <span>Active Semester Schedule</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        {days.map((item) => {
          const isSelected = selectedDay === item.day;
          const count = dayClassCounts[item.day] || 0;
          return (
            <button
              key={item.day}
              onClick={() => onSelectDay(item.day)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'var(--brand-bg)' : 'var(--bg-surface-elevated)',
                border: `1px solid ${isSelected ? 'var(--brand-color)' : 'var(--border-subtle)'}`,
                color: isSelected ? 'var(--brand-color)' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '0.92rem', fontWeight: isSelected ? 800 : 600 }}>
                {item.fullName}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: `1px solid ${isSelected ? 'var(--brand-border)' : 'var(--border-subtle)'}`,
                }}
              >
                {count} {count === 1 ? 'Class' : 'Classes'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
