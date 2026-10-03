import React, { useState } from 'react';
import {
  Clock,
  User,
  Radio,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Attendance, DayOfWeek } from '../types';

interface WeeklyAttendanceScheduleProps {
  dayCardsMap: Record<string, any[]>;
  onSelectCourse: (course: Attendance) => void;
  targetAttendance?: number;
}

const DAYS: DayOfWeek[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
];

export const WeeklyAttendanceSchedule: React.FC<WeeklyAttendanceScheduleProps> = ({
  dayCardsMap,
  onSelectCourse,
  targetAttendance = 75,
}) => {
  // Determine today's day abbreviation
  const getTodayDay = (): DayOfWeek => {
    const dayIndex = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      0: 'SUN',
      1: 'MON',
      2: 'TUE',
      3: 'WED',
      4: 'THU',
      5: 'FRI',
      6: 'SAT',
    };
    return map[dayIndex] || 'MON';
  };

  const [activeDay, setActiveDay] = useState<DayOfWeek>(
    getTodayDay()
  );

  // Check if a class is currently ongoing
  const isClassOngoing = (timeStr?: string, dayKey?: string): boolean => {
    if (!timeStr || !dayKey) return false;
    const now = new Date();
    const todayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    if (!todayName.startsWith(dayKey.slice(0, 3).toUpperCase())) return false;

    const [startStr, endStr] = timeStr.split('-').map((t) => t.trim());
    if (!startStr || !endStr) return false;

    const parseToTime = (str: string) => {
      const parts = str.split(':');
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) || 0;
      if (h >= 1 && h <= 7) h += 12; // 1-7 PM
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };

    const start = parseToTime(startStr);
    const end = parseToTime(endStr);
    return now >= start && now <= end;
  };

  const dayCourses = dayCardsMap[activeDay] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Day Selector Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          justifyContent: 'flex-start',
        }}
      >
        {DAYS.map((day) => {
          const count = (dayCardsMap[day] || []).length;
          const isActive = activeDay === day;
          const isToday = getTodayDay() === day;

          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: isToday && !isActive ? '1px solid var(--accent-cyan)' : undefined,
              }}
            >
              <span>{day}</span>
              {isToday && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--accent-cyan)',
                    color: isActive ? '#fff' : '#000',
                    fontWeight: 800,
                  }}
                >
                  TODAY
                </span>
              )}
              <span
                style={{
                  fontSize: '0.72rem',
                  opacity: 0.8,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Courses for this day */}
      {dayCourses.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.01)',
            borderRadius: '12px',
            border: '1px dashed var(--border-color)',
          }}
        >
          <CalendarIcon size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
          <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-primary)' }}>
            No Scheduled Classes on {activeDay}
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No registered lectures or laboratory slots mapped for this day. Enjoy your free time or prepare for upcoming assessments!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '14px',
          }}
        >
          {dayCourses.map((att, idx) => {
            const conducted = att.conducted ?? att.classesConducted ?? att.total ?? 0;
            const attended = att.attended ?? att.classesAttended ?? 0;
            const pct =
              att.percentage ??
              att.attendancePercentage ??
              (conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 0);
            const targetRatio = targetAttendance / 100;
            const safeBunks = Math.max(0, Math.floor((attended - targetRatio * conducted) / targetRatio));
            const recoveryNeeded =
              pct < targetAttendance
                ? Math.ceil((targetRatio * conducted - attended) / (1 - targetRatio))
                : 0;

            const isLab = (att.slotName || '').startsWith('L');
            const ongoing = isClassOngoing(att.time, activeDay);

            return (
              <div
                key={idx}
                onClick={() => onSelectCourse(att)}
                className="card hover-trigger"
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: ongoing
                    ? '2px solid var(--accent-cyan)'
                    : pct < 75
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid var(--border-color)',
                  background: ongoing
                    ? 'rgba(45, 231, 211, 0.04)'
                    : pct < 75
                    ? 'rgba(239, 68, 68, 0.03)'
                    : 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Live ongoing pulse badge */}
                {ongoing && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: 'rgba(45, 231, 211, 0.2)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Radio size={12} className="animate-pulse" />
                    <span>LIVE LECTURE</span>
                  </div>
                )}

                {/* Top: Code & Slot */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        color: 'var(--accent-cyan)',
                        fontSize: '0.95rem',
                      }}
                    >
                      {att.courseCode || 'COURSE'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {isLab ? 'Lab' : 'Theory'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                      }}
                    >
                      Slot {att.slotName || att.slot}
                    </span>
                  </div>

                  <h4
                    style={{
                      margin: '0 0 6px',
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.35,
                      paddingRight: ongoing ? '80px' : 0,
                    }}
                  >
                    {att.courseTitle || att.courseName || 'Subject Title'}
                  </h4>
                </div>

                {/* Middle: Time & Faculty */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="var(--accent-cyan)" />
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {att.time || 'Time TBA'}
                    </strong>
                    <span>• {att.venue || att.slotVenue || 'Room TBA'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="var(--accent-blue)" />
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '220px',
                      }}
                    >
                      {att.facultyName || att.faculty || 'Faculty'}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Percentage & Safe Margin */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '1rem',
                        color:
                          pct >= 80
                            ? 'var(--success-emerald)'
                            : pct >= 75
                            ? 'var(--warning-amber)'
                            : 'var(--danger-crimson)',
                      }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-muted)',
                        marginLeft: '6px',
                      }}
                    >
                      ({attended}/{conducted})
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: pct >= targetAttendance ? 'var(--success-emerald)' : 'var(--danger-crimson)',
                    }}
                  >
                    {pct >= targetAttendance ? (
                      safeBunks > 0 ? `+${safeBunks} safe to miss` : 'Borderline'
                    ) : (
                      `Attend next ${recoveryNeeded} classes`
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
