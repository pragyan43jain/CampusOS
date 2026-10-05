import React, { useState, useEffect, useMemo, Component, ErrorInfo } from 'react';
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
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

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

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseMonthAndYear(monthVal: any, yearVal?: any): { year: number; monthIndex: number } | null {
  const str = String(monthVal || '').toLowerCase().trim();
  const now = new Date();
  let year = Number(yearVal) || now.getFullYear();

  const matchYear = str.match(/\b(20\d\d)\b/);
  if (matchYear) {
    year = parseInt(matchYear[1], 10);
  }

  for (const [key, idx] of Object.entries(MONTH_MAP)) {
    if (str.includes(key)) {
      return { year, monthIndex: idx };
    }
  }

  return null;
}

const normalize = (d: Date | number | null | undefined): number => {
  if (!d) return 0;
  const x = new Date(d);
  if (isNaN(x.getTime())) return 0;
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const normalizeDay = (d: string) => String(d || '').slice(0, 3).toUpperCase();

// Helper to count upcoming classes till a target date
export function countRemainingClasses(
  courseCode: string,
  slotTime: string,
  dayCardsMap: Record<string, any[]>,
  calendarMonths: MonthCalendar[],
  fromDate: Date = new Date()
): RemainingClassDay[] | null {
  try {
    if (!courseCode || !dayCardsMap || !calendarMonths || !Array.isArray(calendarMonths) || calendarMonths.length === 0) {
      return null;
    }

    const cleanCode = String(courseCode).trim().toUpperCase();
    const daysWithSubject = Object.keys(dayCardsMap).filter((day) =>
      (dayCardsMap[day] || []).some((c) => {
        const cCode = String(c?.courseCode || c?.code || '').trim().toUpperCase();
        const cTitle = String(c?.courseTitle || c?.title || '').trim().toUpperCase();
        return (
          cCode === cleanCode ||
          cTitle === cleanCode ||
          (cleanCode.length >= 6 && cCode.startsWith(cleanCode.slice(0, 6)))
        );
      })
    );
    if (daysWithSubject.length === 0) return null;

    const subjectDays = daysWithSubject.map(normalizeDay);

    let startHour = 8;
    let startMinute = 0;
    const timeMatch = String(slotTime || '').match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (!isNaN(h)) startHour = h;
      if (!isNaN(m)) startMinute = m;
      if (startHour >= 1 && startHour <= 7) startHour += 12;
    }

    const allDays = calendarMonths.flatMap((monthObj) => {
      if (!monthObj) return [];
      const parsed = parseMonthAndYear(monthObj.month, monthObj.year);
      if (!parsed) return [];

      return (monthObj.days || []).map((day: any) => {
        const dayNum = Number(day?.date);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return null;
        const fullDate = new Date(parsed.year, parsed.monthIndex, dayNum);
        if (isNaN(fullDate.getTime())) return null;
        const weekday = fullDate.toLocaleString('en-US', { weekday: 'short' });
        return { ...day, date: dayNum, fullDate, weekday };
      }).filter(Boolean);
    });

    const remainingWorkingDays = allDays.filter((d: any) => {
      if (!d || !d.fullDate || isNaN(d.fullDate.getTime())) return false;

      const isWorkingDay =
        String(d.type || '').toLowerCase() === 'working' ||
        String(d.type || '').toLowerCase().includes('instructional') ||
        (Array.isArray(d.events) && d.events.some(
          (ev: any) =>
            String(ev.text || '').toLowerCase().includes('instructional') ||
            String(ev.text || '').toLowerCase().includes('working')
        ));

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
          /monday|tuesday|wednesday|thursday|friday/i.test(ev.category || ev.text || '')
        );

        if (found) {
          const match =
            String(found.category || '').match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i) ||
            String(found.text || '').match(/(Monday|Tuesday|Wednesday|Thursday|Friday)/i);
          if (match && match[1]) {
            effectiveDay = dayOrderMap[match[1].toLowerCase()] || effectiveDay;
          }
        }
      }

      if (!subjectDays.includes(effectiveDay)) return false;

      const classTime = new Date(d.fullDate);
      classTime.setHours(startHour, startMinute, 0, 0);
      if (classTime < fromDate) return false;

      return true;
    });

    return remainingWorkingDays;
  } catch (err) {
    console.warn('[countRemainingClasses] calculation error:', err);
    return null;
  }
}

// React Error Boundary to prevent blank screen crash
class ModalErrorBoundary extends Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CourseAttendanceDetailModal] ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
          <h3>Unable to display attendance modal details.</h3>
          <p style={{ color: 'var(--text-muted)' }}>An unexpected rendering error occurred. Please close and retry.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const CourseAttendanceDetailModalContent: React.FC<CourseAttendanceDetailModalProps> = ({
  isOpen,
  onClose,
  course,
  dayCardsMap = {},
  calendars = [],
  targetAttendance = 75,
}) => {
  useLockBodyScroll(isOpen);

  // Stepper deltas for hypothetical simulation
  const [simAttendedDelta, setSimAttendedDelta] = useState<number>(0);
  const [simMissedDelta, setSimMissedDelta] = useState<number>(0);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [futureDayStates, setFutureDayStates] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!isOpen) return;

    setSimAttendedDelta(0);
    setSimMissedDelta(0);
    setOpenDropdown(null);
    setFutureDayStates({});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, course, onClose]);

  if (!isOpen || !course) return null;

  // Defensive numeric parsing
  const rawConducted = course.conducted ?? course.classesConducted ?? course.total ?? 0;
  const rawAttended = course.attended ?? course.classesAttended ?? 0;
  const conducted = Number(rawConducted) || 0;
  const attended = Number(rawAttended) || 0;

  const courseCodeStr = String(course.courseCode || (course as any).code || '').trim();
  const courseTypeStr = String(course.courseType || course.type || '').toLowerCase();
  const slotStr = String(course.slot || (course as any).slots || '').trim();

  const isLab =
    courseCodeStr.toUpperCase().endsWith('P') ||
    courseTypeStr.includes('lab') ||
    slotStr.toUpperCase().startsWith('L');

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
      if (!isNaN(ts) && ts >= todayTs && state === 1) {
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

  const targetRatio = (targetAttendance || 75) / 100;

  // Primary authoritative Safe Bunks Formula:
  // Can miss = floor((Attended - Target * Conducted) / Target)
  const actualSafeBunks = conducted > 0
    ? Math.max(0, Math.floor((attended - targetRatio * conducted) / targetRatio))
    : 0;
  const actualSafeBunkBlocks = isLab ? Math.floor(actualSafeBunks / 2) : actualSafeBunks;

  // Simulated Safe Bunks:
  const simSafeBunks = simConducted > 0
    ? Math.max(0, Math.floor((simAttended - targetRatio * simConducted) / targetRatio))
    : 0;
  const simSafeBunkBlocks = isLab ? Math.floor(simSafeBunks / 2) : simSafeBunks;

  const simRecoveryNeeded =
    simPct < targetAttendance && simConducted > 0
      ? Math.ceil((targetRatio * simConducted - simAttended) / (1 - targetRatio))
      : 0;
  const simRecoveryBlocks = isLab ? Math.ceil(simRecoveryNeeded / 2) : simRecoveryNeeded;

  // Count upcoming classes till academic milestones
  const countTillDate = (endDate: Date | string | null, startDate: Date = new Date()): RemainingClassDay[] | null => {
    try {
      if (!endDate || !calendars || !Array.isArray(calendars) || calendars.length === 0) return null;
      const endMid = new Date(endDate);
      if (isNaN(endMid.getTime())) return null;
      endMid.setHours(23, 59, 59, 999);

      const filteredMonths = calendars.map((monthObj) => {
        if (!monthObj) return null;
        const parsed = parseMonthAndYear(monthObj.month, monthObj.year);
        if (!parsed) return null;

        return {
          ...monthObj,
          days: (monthObj.days || []).filter((d: any) => {
            const dayNum = Number(d?.date);
            if (isNaN(dayNum)) return false;
            const dFull = new Date(parsed.year, parsed.monthIndex, dayNum);
            if (isNaN(dFull.getTime())) return false;
            dFull.setHours(0, 0, 0, 0);
            return dFull <= endMid;
          }),
        };
      }).filter(Boolean) as MonthCalendar[];

      return countRemainingClasses(
        courseCodeStr,
        slotStr,
        dayCardsMap,
        filteredMonths,
        startDate
      );
    } catch (err) {
      console.warn('[countTillDate] Error:', err);
      return null;
    }
  };

  // Exam target dates
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
    if (isPast || !timestamp || isNaN(timestamp)) return;
    setFutureDayStates((prev) => {
      const cur = prev[timestamp] ?? 0;
      const next = (cur + 1) % 3;
      return { ...prev, [timestamp]: next };
    });
  };

  const viewLogs: Array<{ date: string; status: string }> = (course as any).viewLink || [];

  return (
    <div
      className="modal-backdrop overscroll-contain"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="modal-content-glass overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '18px',
          padding: '24px',
          background: 'var(--bg-secondary, #121826)',
          border: '1px solid var(--border-card, rgba(255,255,255,0.12))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))', paddingBottom: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: '#38bdf8', fontSize: '1.15rem' }}>
                {courseCodeStr || 'COURSE'}
              </span>
              <span style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                {isLab ? 'Lab Component' : 'Theory Component'}
              </span>
              <span className={`status-badge ${simPct >= 80 ? 'safe' : simPct >= targetAttendance ? 'warning' : 'critical'}`}>
                {simPct >= 80 ? 'Safe Buffer' : simPct >= targetAttendance ? 'Borderline' : 'Debarment Risk'}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', lineHeight: 1.3 }}>
              {course.courseTitle || course.courseName || (course as any).title || 'Subject'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Course Metadata Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '18px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', fontSize: '0.72rem' }}>Faculty</span>
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{course.facultyName || course.faculty || 'Faculty TBA'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', fontSize: '0.72rem' }}>Slot & Venue</span>
            <strong style={{ color: '#38bdf8' }}>{slotStr || 'TBA'} • {course.venue || course.slotVenue || 'Room TBA'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', fontSize: '0.72rem' }}>Credits</span>
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{course.credits ?? (isLab ? 1 : 3)} Credits</strong>
          </div>
        </div>

        {/* Dedicated Highlight Box: Subject-wise Safe Bunk Allowance */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '18px',
            background: simPct >= targetAttendance ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${simPct >= targetAttendance ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: simPct >= targetAttendance ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: simPct >= targetAttendance ? '#10b981' : '#ef4444',
            }}
          >
            {simPct >= targetAttendance ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: simPct >= targetAttendance ? '#34d399' : '#f87171' }}>
              {simPct >= targetAttendance ? 'Subject Bunk Allowance' : 'Attendance Shortage Warning'}
            </div>

            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginTop: '2px' }}>
              {simPct >= targetAttendance ? (
                simSafeBunkBlocks > 0 ? (
                  <span>
                    You can safely leave <span style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 800 }}>{simSafeBunkBlocks}</span> {isLab ? 'lab session' : 'class'}{simSafeBunkBlocks > 1 ? (isLab ? 's' : 'es') : ''} and remain at or above {targetAttendance}%.
                  </span>
                ) : (
                  <span>
                    You are on the edge! You cannot leave any more classes. Attend the next {isLab ? 'lab session' : 'class'} to stay above {targetAttendance}%.
                  </span>
                )
              ) : (
                <span>
                  Shortage alert: Need to attend <span style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 800 }}>{simRecoveryBlocks}</span> more {isLab ? 'lab session' : 'class'}{simRecoveryBlocks > 1 ? (isLab ? 's' : 'es') : ''} consecutively to reach {targetAttendance}%.
                </span>
              )}
            </div>

            {simAttendedDelta !== 0 || simMissedDelta !== 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                * Reflects simulator state (+{simAttendedDelta} attended, -{simMissedDelta} missed). Base official allowance: {actualSafeBunkBlocks} {isLab ? 'lab sessions' : 'classes'} safe to leave.
              </div>
            ) : null}
          </div>
        </div>

        {/* Main Stats Card with Circular Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attendance Performance
            </span>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, fontFamily: 'var(--font-mono, monospace)', color: simPct >= 80 ? '#10b981' : simPct >= targetAttendance ? '#f59e0b' : '#ef4444' }}>
              {simPct.toFixed(1)}%
              {simAttendedDelta !== 0 || simMissedDelta !== 0 ? (
                <span style={{ fontSize: '0.82rem', marginLeft: '8px', color: simPct >= (course.percentage || 0) ? '#10b981' : '#ef4444' }}>
                  ({simPct >= (course.percentage || 0) ? '+' : ''}{(simPct - (Number(course.percentage) || 0)).toFixed(1)}% simulated)
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              Attended: <strong style={{ color: 'var(--text-primary, #f8fafc)', fontFamily: 'var(--font-mono, monospace)' }}>{simAttended}</strong> / <strong style={{ color: 'var(--text-primary, #f8fafc)', fontFamily: 'var(--font-mono, monospace)' }}>{simConducted}</strong> classes conducted
            </div>
          </div>

          {/* Circular Progress Gauge */}
          <div style={{ width: '84px', height: '84px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="3.2"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={simPct >= 80 ? '#10b981' : simPct >= targetAttendance ? '#f59e0b' : '#ef4444'}
                strokeWidth="3.2"
                strokeDasharray={`${Math.min(100, Math.max(0, simPct))}, 100`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>
            <span style={{ position: 'absolute', fontSize: '0.92rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: simPct >= 80 ? '#10b981' : simPct >= targetAttendance ? '#f59e0b' : '#ef4444' }}>
              {simPct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Interactive What-If Simulator */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary, #f8fafc)' }}>
              <Calculator size={16} color="#38bdf8" />
              Interactive Bunk &amp; Attendance Simulator
            </h4>
            {(simAttendedDelta !== 0 || simMissedDelta !== 0 || Object.keys(futureDayStates).length > 0) && (
              <button
                onClick={() => {
                  setSimAttendedDelta(0);
                  setSimMissedDelta(0);
                  setFutureDayStates({});
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.74rem', padding: '3px 8px', color: '#f87171', cursor: 'pointer' }}
              >
                Reset Simulator
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>Simulate Attending Lectures:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSimAttendedDelta((prev) => prev + n)}
                    className="btn btn-sm btn-ghost"
                    style={{ border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>Simulate Leaving / Missing Lectures:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSimMissedDelta((prev) => prev + n)}
                    className="btn btn-sm btn-ghost"
                    style={{ border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    -{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Academic Calendar Exam Projections */}
        {[
          { key: 'CAT1', label: 'Classes left before CAT I', data: classesTillCAT1 },
          { key: 'CAT2', label: 'Classes left before CAT II', data: classesTillCAT2 },
          { key: 'MIDSEM', label: 'Classes left before Mid Term Test', data: classesTillMidSem },
          { key: 'LID', label: 'Classes left before FAT (Last Instructional Day)', data: classesTillLID },
        ].some((d) => Array.isArray(d.data) && d.data.length > 0) && (
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.90rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary, #f8fafc)' }}>
              <CalendarIcon size={16} color="#38bdf8" />
              Upcoming Academic Calendar Projections
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
                const pastCount = data.filter((d) => (d?.fullDate instanceof Date && !isNaN(d.fullDate.getTime()) ? d.fullDate.getTime() < todayTs : false)).length;
                const remainingCount = Math.max(0, data.length - pastCount);

                return (
                  <div key={key} style={{ borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleDropdown(key)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-primary, #f8fafc)',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {label}:{' '}
                        <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono, monospace)' }}>
                          {remainingCount} {remainingCount === 1 ? 'lecture' : 'lectures'} remaining
                        </strong>
                        {pastCount > 0 && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', marginLeft: '6px' }}>
                            ({pastCount} past conducted)
                          </span>
                        )}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))', fontSize: '0.80rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '6px' }}>
                          {data.map((day, idx) => {
                            const dDate = (day?.fullDate instanceof Date && !isNaN(day.fullDate.getTime())) ? day.fullDate : null;
                            const dTs = dDate ? dDate.getTime() : 0;
                            const isPast = dTs < todayTs;
                            const isToday = dTs === todayTs;

                            const ts = normalize(dDate);
                            const state = futureDayStates[ts] ?? 0;

                            let stateBg = state === 0 ? 'rgba(16, 185, 129, 0.18)' : state === 1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                            let stateBorder = state === 0 ? '1px solid rgba(16, 185, 129, 0.5)' : state === 1 ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)';
                            let stateColor = state === 0 ? '#34d399' : state === 1 ? '#ef4444' : 'var(--text-muted, #94a3b8)';
                            let stateTag = state === 0 ? 'Attend' : state === 1 ? 'Absent' : 'Skip';

                            const formattedDate = dDate
                              ? dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
                              : `Day ${day.date}`;

                            let title = `${formattedDate}: ${state === 0 ? 'Attending' : state === 1 ? 'Missed (Absent)' : 'Ignored'}`;

                            if (isPast) {
                              stateBg = '#070a10';
                              stateBorder = '1px solid rgba(255, 255, 255, 0.08)';
                              stateColor = '#475569';
                              stateTag = 'Past';
                              title = `${formattedDate}: Past conducted lecture`;
                            } else if (isToday) {
                              stateBorder = '2px solid #38bdf8';
                              stateTag = 'Today';
                            }

                            return (
                              <button
                                key={idx}
                                onClick={() => !isPast && ts && cycleDayState(ts, isPast)}
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
                                }}
                                title={title}
                              >
                                <div style={{ fontSize: '0.68rem', color: isPast ? '#475569' : 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                                  {day.weekday || ''}
                                </div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: isPast ? '#64748b' : 'inherit' }}>
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

        {/* Historical Attendance Punch Log */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Attendance History Log ({viewLogs.length > 0 ? `${viewLogs.length} Records` : 'VTOP Registered Course'})
          </h4>

          {viewLogs.length === 0 ? (
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                Official summary: <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{attended}</strong> attended of <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{conducted}</strong> conducted lectures. (Granular punch logs sync on login).
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                {viewLogs.map((log, idx) => {
                  const statusLower = String(log.status || '').toLowerCase();
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
                        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{log.date}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isPresent ? '#10b981' : isAbsent ? '#ef4444' : isOD ? '#f59e0b' : 'var(--text-muted, #94a3b8)',
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
          <button onClick={onClose} className="btn btn-primary btn-sm" style={{ padding: '7px 20px', borderRadius: '8px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const CourseAttendanceDetailModal: React.FC<CourseAttendanceDetailModalProps> = (props) => {
  if (!props.isOpen || !props.course) return null;
  return (
    <ModalErrorBoundary>
      <CourseAttendanceDetailModalContent {...props} />
    </ModalErrorBoundary>
  );
};
