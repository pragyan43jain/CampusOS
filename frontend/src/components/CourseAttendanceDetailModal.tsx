import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calculator,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Attendance, MonthCalendar } from '../types';

interface CourseAttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Attendance | null;
  dayCardsMap?: Record<string, any[]>;
  calendars?: MonthCalendar[];
  targetAttendance?: number;
}

type CalendarEvent = {
  text: string;
  type: string;
  color?: string;
  category?: string;
};

type RemainingClassDay = {
  date: number;
  weekday: string;
  type: string;
  events?: CalendarEvent[];
  fullDate: Date;
};

const normalize = (d: Date | number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const normalizeDay = (d: string) => (d || '').slice(0, 3).toUpperCase();

// Helper to count upcoming classes till a target date
export function countRemainingClasses(
  courseCode: string,
  slotTime: string,
  dayCardsMap: Record<string, any[]>,
  calendarMonths: MonthCalendar[],
  fromDate: Date = new Date()
): RemainingClassDay[] | null {
  if (!courseCode || !dayCardsMap || !calendarMonths || !Array.isArray(calendarMonths) || calendarMonths.length === 0) {
    return null;
  }

  const daysWithSubject = Object.keys(dayCardsMap).filter((day) =>
    (dayCardsMap[day] || []).some(
      (c) =>
        c.courseCode === courseCode ||
        c.courseTitle === courseCode ||
        (c.courseCode && courseCode.startsWith(c.courseCode.slice(0, 7)))
    )
  );
  if (daysWithSubject.length === 0) return null;

  const subjectDays = daysWithSubject.map(normalizeDay);
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  let startHour = 8;
  let startMinute = 0;
  if (slotTime && slotTime.includes('-')) {
    const [start] = slotTime.split('-');
    const [hRaw, mRaw] = start.split(':');
    let h = Number(hRaw);
    const m = Number(mRaw) || 0;
    if (h >= 1 && h <= 7) h += 12;
    startHour = h;
    startMinute = m;
  }

  const allDays = calendarMonths.flatMap((monthObj) => {
    const monthStr = monthObj.month?.toString().toLowerCase() || '';
    const matchYear = monthObj.month?.toString().match(/\d{4}/);
    const year = monthObj.year || (matchYear ? parseInt(matchYear[0], 10) : new Date().getFullYear());
    const foundMonth = monthNames.find((m) => monthStr.includes(m));
    const mIndex = foundMonth ? monthNames.indexOf(foundMonth) : -1;

    return (monthObj.days || []).map((day: any) => {
      const fullDate = mIndex === -1 ? null : new Date(year, mIndex, day.date);
      const weekday = fullDate
        ? fullDate.toLocaleString('en-US', { weekday: 'short' })
        : '';
      return { ...day, fullDate, weekday };
    });
  });

  const remainingWorkingDays = allDays.filter((d) => {
    if (!d || !d.fullDate || isNaN(d.fullDate.getTime())) return false;

    const isWorkingDay =
      d.type?.toLowerCase() === 'working' ||
      d.events?.some(
        (ev: any) =>
          ev.text?.toLowerCase() === 'instructional day' ||
          ev.text?.toLowerCase().includes('working')
      );

    if (!isWorkingDay) return false;

    let effectiveDay = normalizeDay(d.weekday || '');
    if (effectiveDay === 'SAT' && Array.isArray(d.events)) {
      const dayOrderMap: Record<string, string> = {
        monday: 'MON',
        tuesday: 'TUE',
        wednesday: 'WED',
        thursday: 'THU',
        friday: 'FRI',
      };

      const found = d.events.find((ev: any) =>
        /monday|tuesday|wednesday|thursday|friday/i.test(ev.category || ev.text)
      );

      if (found) {
        const match =
          found.category?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i) ||
          found.text?.match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i);
        if (match) effectiveDay = dayOrderMap[match[1].toLowerCase()];
      }
    }

    if (!subjectDays.includes(effectiveDay)) return false;

    const classTime = new Date(d.fullDate);
    classTime.setHours(startHour, startMinute, 0, 0);
    if (classTime < fromDate) return false;

    return true;
  });

  return remainingWorkingDays;
}

export const CourseAttendanceDetailModal: React.FC<CourseAttendanceDetailModalProps> = ({
  isOpen,
  onClose,
  course,
  dayCardsMap = {},
  calendars = [],
  targetAttendance = 75,
}) => {
  // Stepper deltas for hypothetical simulation
  const [simAttendedDelta, setSimAttendedDelta] = useState<number>(0);
  const [simMissedDelta, setSimMissedDelta] = useState<number>(0);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [futureDayStates, setFutureDayStates] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setSimAttendedDelta(0);
    setSimMissedDelta(0);
    setOpenDropdown(null);
    setFutureDayStates({});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, course, onClose]);

  if (!isOpen || !course) return null;

  const conducted = course.conducted ?? course.classesConducted ?? course.total ?? 0;
  const attended = course.attended ?? course.classesAttended ?? 0;
  const isLab =
    (course.courseCode || '').endsWith('P') ||
    (course.courseType || '').toLowerCase().includes('lab') ||
    (course.slot || '').startsWith('L');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayTs = today.getTime();

  // Future dates simulated absences (from interactive calendar toggle)
  const futureSimMissed = useMemo(() => {
    let count = 0;
    for (const [tsStr, state] of Object.entries(futureDayStates)) {
      const ts = parseInt(tsStr, 10);
      if (ts >= todayTs && state === 1) {
        count++;
      }
    }
    return count;
  }, [futureDayStates, todayTs]);

  // Simulation values
  const effectiveSimMissed = simMissedDelta + (isLab ? futureSimMissed * 2 : futureSimMissed);
  const simAttended = Math.max(0, attended + simAttendedDelta);
  const simConducted = Math.max(0, conducted + simAttendedDelta + effectiveSimMissed);
  const simPct = simConducted > 0 ? Math.round((simAttended / simConducted) * 1000) / 10 : 0;

  const targetRatio = targetAttendance / 100;
  const safeBunks = Math.max(0, Math.floor((simAttended - targetRatio * simConducted) / targetRatio));
  const safeBunkBlocks = isLab ? Math.floor(safeBunks / 2) : safeBunks;

  const recoveryNeeded =
    simPct < targetAttendance
      ? Math.ceil((targetRatio * simConducted - simAttended) / (1 - targetRatio))
      : 0;
  const recoveryBlocks = isLab ? Math.ceil(recoveryNeeded / 2) : recoveryNeeded;

  const countTillDate = (endDate: Date | string | null, startDate: Date = new Date()): RemainingClassDay[] | null => {
    if (!endDate || !calendars || calendars.length === 0) return null;
    const endMid = new Date(endDate);
    endMid.setHours(23, 59, 59, 999);

    const filteredMonths = calendars.map((monthObj) => ({
      ...monthObj,
      days: (monthObj.days || []).filter((d: any) => {
        if (!d.date) return false;
        const monthStr = monthObj.month?.toLowerCase() || '';
        const mIndex = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december',
        ].findIndex((m) => monthStr.includes(m));
        const matchYear = monthObj.month?.match(/\d{4}/);
        const y = monthObj.year || (matchYear ? parseInt(matchYear[0], 10) : new Date().getFullYear());
        const dFull = new Date(y, mIndex, d.date);
        dFull.setHours(0, 0, 0, 0);
        return dFull <= endMid;
      }),
    }));

    return countRemainingClasses(
      course.courseCode,
      course.slot || '',
      dayCardsMap,
      filteredMonths,
      startDate
    );
  };

  // Exam target dates for Fall Semester 2026-27
  const semesterStart = new Date('2026-07-20');
  const cat1Date = new Date('2026-08-08');
  const cat2Date = new Date('2026-09-25');
  const midsemDate = new Date('2026-09-10');
  const lidDate = new Date('2026-11-13');

  const classesTillCAT1 = countTillDate(cat1Date, semesterStart);
  const classesTillCAT2 = countTillDate(cat2Date, semesterStart);
  const classesTillMidSem = countTillDate(midsemDate, semesterStart);
  const classesTillLID = countTillDate(lidDate, semesterStart);

  const toggleDropdown = (key: string) => {
    setOpenDropdown(openDropdown === key ? null : key);
  };

  const cycleDayState = (timestamp: number, isPast?: boolean) => {
    if (isPast) return; // Disallow selecting or modifying past conducted dates
    setFutureDayStates((prev) => {
      const cur = prev[timestamp] ?? 0; // 0 = attending, 1 = missed, 2 = ignored
      const next = (cur + 1) % 3;
      return { ...prev, [timestamp]: next };
    });
  };

  const viewLogs: Array<{ date: string; status: string }> = (course as any).viewLink || [];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-content-glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '18px',
          padding: '24px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-card, rgba(255,255,255,0.12))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>
                {course.courseCode}
              </span>
              <span style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isLab ? 'Lab Component' : 'Theory Component'}
              </span>
              <span className={`status-badge ${simPct >= 80 ? 'safe' : simPct >= targetAttendance ? 'warning' : 'critical'}`}>
                {simPct >= 80 ? 'Safe Buffer' : simPct >= targetAttendance ? 'Borderline' : 'Debarment Risk'}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {course.courseTitle || course.courseName || 'Subject'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', borderRadius: '8px' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Metadata Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '18px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Faculty</span>
            <strong style={{ color: 'var(--text-primary)' }}>{course.facultyName || course.faculty || 'Faculty'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Slot & Venue</span>
            <strong style={{ color: 'var(--accent-cyan)' }}>{course.slot || 'TBA'} • {course.venue || course.slotVenue || 'Room TBA'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Credits</span>
            <strong style={{ color: 'var(--text-primary)' }}>{course.credits ?? (isLab ? 1 : 3)} Credits</strong>
          </div>
        </div>

        {/* Main Stats Card with SVG Circular Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attendance Performance
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: simPct >= 80 ? 'var(--success-emerald)' : simPct >= targetAttendance ? 'var(--warning-amber)' : 'var(--danger-crimson)' }}>
              {simPct.toFixed(1)}%
              {simAttendedDelta !== 0 || simMissedDelta !== 0 ? (
                <span style={{ fontSize: '0.82rem', marginLeft: '8px', color: simPct >= (course.percentage || 0) ? 'var(--success-emerald)' : 'var(--danger-crimson)' }}>
                  ({simPct >= (course.percentage || 0) ? '+' : ''}{(simPct - (course.percentage || 0)).toFixed(1)}% simulated)
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Attended: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{simAttended}</strong> / <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{simConducted}</strong> classes
            </div>

            {/* Margin result alert */}
            <div style={{ marginTop: '4px' }}>
              {simPct >= targetAttendance ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-emerald)', fontWeight: 600, fontSize: '0.85rem' }}>
                  <ShieldCheck size={16} />
                  {safeBunks > 0 ? (
                    <span>
                      Can safely miss <strong>{safeBunkBlocks}</strong> {isLab ? 'lab session' : 'class'}{safeBunkBlocks > 1 ? (isLab ? 's' : 'es') : ''} and remain above {targetAttendance}%.
                    </span>
                  ) : (
                    <span>On the edge! Attend the next class to maintain safe buffer.</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger-crimson)', fontWeight: 600, fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} />
                  <span>
                    Need to attend <strong>{recoveryBlocks}</strong> more {isLab ? 'lab session' : 'class'}{recoveryBlocks > 1 ? (isLab ? 's' : 'es') : ''} continuously to reach {targetAttendance}%.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Circular Progress Gauge */}
          <div style={{ width: '84px', height: '84px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border-color, rgba(255,255,255,0.12))"
                strokeWidth="3.2"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={simPct >= 80 ? 'var(--success-emerald, #10b981)' : simPct >= targetAttendance ? 'var(--warning-amber, #f59e0b)' : 'var(--danger-crimson, #ef4444)'}
                strokeWidth="3.2"
                strokeDasharray={`${Math.min(100, Math.max(0, simPct))}, 100`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>
            <span style={{ position: 'absolute', fontSize: '0.92rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: simPct >= 80 ? 'var(--success-emerald)' : simPct >= targetAttendance ? 'var(--warning-amber)' : 'var(--danger-crimson)' }}>
              {simPct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Interactive Course-Level What-If Simulator */}
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calculator size={15} color="var(--accent-blue)" />
              Course Attendance Simulator
            </h4>
            {(simAttendedDelta !== 0 || simMissedDelta !== 0 || Object.keys(futureDayStates).length > 0) && (
              <button
                onClick={() => {
                  setSimAttendedDelta(0);
                  setSimMissedDelta(0);
                  setFutureDayStates({});
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.74rem', padding: '2px 8px', color: '#f87171' }}
              >
                Reset Simulator
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Attend Next Lectures:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSimAttendedDelta((prev) => prev + n)}
                    className="btn btn-sm btn-ghost"
                    style={{ border: '1px solid var(--border-color)', fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px' }}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Simulate Missed Classes:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSimMissedDelta((prev) => prev + n)}
                    className="btn btn-sm btn-ghost"
                    style={{ border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px' }}
                  >
                    -{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Academic Calendar Exam Countdown & Upcoming Classes (CampusOS feature) */}
        {[
          { key: 'CAT1', label: 'Classes left before CAT I', data: classesTillCAT1 },
          { key: 'CAT2', label: 'Classes left before CAT II', data: classesTillCAT2 },
          { key: 'MIDSEM', label: 'Classes left before Mid Term Test', data: classesTillMidSem },
          { key: 'LID', label: 'Classes left before FAT (Last Instructional Day)', data: classesTillLID },
        ].some((d) => Array.isArray(d.data) && d.data.length > 0) && (
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.90rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarIcon size={15} color="var(--accent-cyan)" />
              Academic Calendar Exam Projections
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { key: 'CAT1', label: 'Classes left before CAT I', data: classesTillCAT1 },
                { key: 'CAT2', label: 'Classes left before CAT II', data: classesTillCAT2 },
                { key: 'MIDSEM', label: 'Classes left before Mid Term Test', data: classesTillMidSem },
                { key: 'LID', label: 'Classes left before FAT (LID)', data: classesTillLID },
              ].map(({ key, label, data }) => {
                if (!Array.isArray(data) || data.length === 0) return null;
                const isExpanded = openDropdown === key;
                const pastCount = data.filter((d) => (d.fullDate?.getTime() ?? 0) < todayTs).length;
                const remainingCount = data.length - pastCount;

                return (
                  <div key={key} style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleDropdown(key)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {label}:{' '}
                        <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {remainingCount} {remainingCount === 1 ? 'lecture' : 'lectures'} remaining
                        </strong>
                        {pastCount > 0 && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({pastCount} past conducted)
                          </span>
                        )}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', fontSize: '0.80rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                            Click present &amp; future dates to cycle: <strong style={{ color: 'var(--success-emerald)' }}>Attending</strong> ➔ <strong style={{ color: 'var(--danger-crimson)' }}>Missed (Absent)</strong> ➔ <strong style={{ color: 'var(--text-muted)' }}>Ignored</strong>
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#070a10', border: '1px solid rgba(255,255,255,0.12)' }} />
                              Past (Locked)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid var(--success-emerald)' }} />
                              Attending
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid var(--danger-crimson)' }} />
                              Absent
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '6px' }}>
                          {data.map((day, idx) => {
                            const dDate = day.fullDate ? new Date(day.fullDate) : null;
                            if (dDate) dDate.setHours(0, 0, 0, 0);
                            const dTs = dDate ? dDate.getTime() : 0;
                            const isPast = dTs < todayTs;
                            const isToday = dTs === todayTs;

                            const ts = normalize(day.fullDate);
                            const state = futureDayStates[ts] ?? 0;

                            let stateBg = state === 0 ? 'rgba(16, 185, 129, 0.18)' : state === 1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                            let stateBorder = state === 0 ? '1px solid rgba(16, 185, 129, 0.5)' : state === 1 ? '1px solid var(--danger-crimson)' : '1px solid var(--border-color)';
                            let stateColor = state === 0 ? 'var(--success-emerald)' : state === 1 ? 'var(--danger-crimson)' : 'var(--text-muted)';
                            let stateTag = state === 0 ? 'Attend' : state === 1 ? 'Absent' : 'Skip';
                            let title = `${day.fullDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}: ${state === 0 ? 'Attending' : state === 1 ? 'Missed (Absent)' : 'Ignored'}`;

                            if (isPast) {
                              stateBg = '#070a10';
                              stateBorder = '1px solid rgba(255, 255, 255, 0.08)';
                              stateColor = '#475569';
                              stateTag = 'Past';
                              title = `${day.fullDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}: Past conducted lecture (Locked)`;
                            } else if (isToday) {
                              stateBorder = '2px solid var(--accent-cyan)';
                              stateTag = 'Today';
                            }

                            return (
                              <button
                                key={idx}
                                onClick={() => !isPast && cycleDayState(ts, isPast)}
                                disabled={isPast}
                                style={{
                                  padding: '6px 4px',
                                  borderRadius: '6px',
                                  background: stateBg,
                                  border: stateBorder,
                                  color: stateColor,
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: isPast ? 'not-allowed' : 'pointer',
                                  textAlign: 'center',
                                  opacity: isPast ? 0.55 : 1,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px',
                                  transition: 'all 0.15s ease',
                                }}
                                title={title}
                              >
                                <div style={{ fontSize: '0.68rem', color: isPast ? '#475569' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                                  {day.weekday}
                                </div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isPast ? '#64748b' : 'inherit' }}>
                                  {day.date}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    padding: '0 4px',
                                    borderRadius: '3px',
                                    background: isPast ? 'rgba(255, 255, 255, 0.04)' : stateBg,
                                    color: isPast ? '#475569' : stateColor,
                                  }}
                                >
                                  {stateTag}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Historical Attendance Log (VTOP records) */}
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Attendance History Log ({viewLogs.length > 0 ? `${viewLogs.length} Records` : 'VTOP Registered Course'})
          </h4>

          {viewLogs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No granular class-by-class punch logs recorded yet. Current summary: {attended} attended of {conducted} conducted.
            </p>
          ) : (
            <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                {viewLogs.map((log, idx) => {
                  const statusLower = (log.status || '').toLowerCase();
                  const isPresent = statusLower === 'present';
                  const isAbsent = statusLower === 'absent';
                  const isOD = statusLower.includes('duty') || statusLower === 'od';

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{log.date}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isPresent ? 'var(--success-emerald)' : isAbsent ? 'var(--danger-crimson)' : isOD ? 'var(--warning-amber)' : 'var(--text-muted)',
                        }}
                      >
                        {log.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} className="btn btn-primary btn-sm" style={{ padding: '6px 16px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
