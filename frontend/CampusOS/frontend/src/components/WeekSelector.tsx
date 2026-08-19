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
  const days: { day: DayOfWeek; name: string; dateNum: number }[] = [
    { day: 'MON', name: 'MON', dateNum: 17 },
    { day: 'TUE', name: 'TUE', dateNum: 18 },
    { day: 'WED', name: 'WED', dateNum: 19 },
    { day: 'THU', name: 'THU', dateNum: 20 },
    { day: 'FRI', name: 'FRI', dateNum: 21 },
    { day: 'SAT', name: 'SAT', dateNum: 22 },
  ];

  return (
    <div className="week-selector-card">
      <div className="week-selector-header">
        <div>
          <span className="week-title">Weekly Schedule</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
            Academic Cycle 2026 • Week 6
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          August 17 – August 22
        </span>
      </div>

      <div className="week-days-strip">
        {days.map((item) => {
          const isSelected = selectedDay === item.day;
          const classCount = dayClassCounts[item.day] || 0;
          return (
            <button
              key={item.day}
              className={`day-slot-btn ${isSelected ? 'active' : ''} ${classCount > 0 ? 'has-classes' : ''}`}
              onClick={() => onSelectDay(item.day)}
            >
              <span className="day-slot-name">{item.name}</span>
              <span className="day-slot-date">{item.dateNum}</span>
              {classCount > 0 && <div className="day-dot" title={`${classCount} classes`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
