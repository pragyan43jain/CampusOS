import React from 'react';
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--surface-input)',
        border: '1px solid var(--border-card)',
        padding: '4px',
        borderRadius: 'var(--radius-btn)',
        overflowX: 'auto',
      }}
    >
      {days.map((item) => {
        const isSelected = selectedDay === item.day;
        const count = dayClassCounts[item.day] || 0;

        return (
          <button
            key={item.day}
            onClick={() => onSelectDay(item.day)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isSelected ? 'var(--surface-secondary)' : 'transparent',
              border: `1px solid ${isSelected ? 'rgba(45, 231, 211, 0.25)' : 'transparent'}`,
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isSelected ? 700 : 500,
              fontSize: '0.86rem',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{item.shortName}</span>
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSelected ? 'rgba(45, 231, 211, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
