import React, { useMemo, useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Info, CalendarDays } from 'lucide-react';
import { CalendarResponse, MonthCalendar, CalendarDay, CalendarEvent } from '../types';
import { CampusAPI } from '../services/api';
import { buildExamScheduleMap, getExamForDay, ExamScheduleEntry } from './OverallAttendancePredictorModal';

export const CALENDAR_TYPES: Record<string, string> = {
  ALL: 'General Semester',
  ALL02: 'General Flexible',
  ALL03: 'General Freshers',
  ALL05: 'General LAW',
  ALL06: 'Flexible Freshers',
  ALL08: 'Cohort LAW',
  ALL11: 'Flexible Research',
  WEI: 'Weekend Intra Semester',
};

const HOLIDAY_KEYWORDS = [
  'holiday', 'pooja', 'puja', 'ayudha', 'diwali', 'deepavali', 'pongal', 'eid', 'christmas', 'good friday',
  'independence', 'republic', 'onam', 'holi', 'ramadan', 'ganesh', 'maha shivaratri', 'vesak',
  'vacation', 'term end', 'no instructional', 'noinstructional', 'vinayakar chathurthi', 'gandhi jayanthi', 'gandhi jayanti',
  'thaipoosam', 'telugu', 'tamil', 'ambedkar', 'muharram', 'milad', 'dussera', 'dussehra'
];

function normalize(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

function isHolidayEvent(e: CalendarEvent) {
  if (!e) return false;
  const type = String(e.type || '').toLowerCase();
  const text = normalize(e.text || '');
  const cat = normalize(e.category || '');
  if (type.includes('holiday')) return true;
  if (type.includes('no instructional')) return true;
  if (cat.includes('no instructional')) return true;
  for (const kw of HOLIDAY_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

function isInstructionalEvent(e: CalendarEvent) {
  if (!e) return false;
  const type = String(e.type || '').toLowerCase();
  const cat = normalize(e.category || '');
  if (type === 'instructional day') return true;
  if (cat.includes('working')) return true;
  return false;
}

export interface CalendarDayDetails {
  dayType: 'instructional' | 'holiday' | 'exam' | 'fest' | 'weekend';
  badgeLabel: string;
  badgeCol: string;
  badgeBg: string;
  bgCol: string;
  borderCol: string;
  primaryDetail: string;
  secondaryDetail?: string;
  fullDescription: string;
}

export function resolveCalendarDayDetails(
  dayNum: number,
  dayInfo: CalendarDay | undefined,
  year: number,
  monthIndex: number,
  examMap: Map<string, ExamScheduleEntry>
): CalendarDayDetails {
  const dateObj = new Date(year, monthIndex, dayNum);
  const dow = dateObj.getDay(); // 0 = Sun, 6 = Sat
  const events = dayInfo?.events || [];

  // 1. Check Exam
  const examInfo = getExamForDay(dateObj, events, examMap);
  if (examInfo.isExam) {
    const coursePart = examInfo.courseCode ? ` (${examInfo.courseCode})` : '';
    const slotPart = examInfo.slot ? ` [Slot ${examInfo.slot}]` : '';
    return {
      dayType: 'exam',
      badgeLabel: examInfo.label || 'Exam',
      badgeCol: '#c084fc',
      badgeBg: 'rgba(168, 85, 247, 0.25)',
      bgCol: 'rgba(168, 85, 247, 0.08)',
      borderCol: 'rgba(168, 85, 247, 0.4)',
      primaryDetail: `${examInfo.label} Exam${coursePart}`,
      secondaryDetail: examInfo.slot ? `Slot ${examInfo.slot}` : 'Semester Assessment',
      fullDescription: `${examInfo.fullName || `${examInfo.label} Exam`}${coursePart}${slotPart}. Official University Examination Day.`,
    };
  }

  // 2. Check for Fest / College Events
  const combinedEventText = events.map(e => `${e.text || ''} ${e.category || ''} ${e.type || ''}`).join(' ').toLowerCase();
  if (combinedEventText.includes('technovit') || combinedEventText.includes('vibrance') || combinedEventText.includes('riviera') || combinedEventText.includes('gravitas')) {
    const festName = combinedEventText.includes('technovit') ? 'TechnoVIT' : combinedEventText.includes('vibrance') ? 'Vibrance' : combinedEventText.includes('riviera') ? 'Riviera' : 'College Fest';
    return {
      dayType: 'fest',
      badgeLabel: 'Event',
      badgeCol: '#8b5cf6',
      badgeBg: 'rgba(139, 92, 246, 0.2)',
      bgCol: 'rgba(139, 92, 246, 0.08)',
      borderCol: 'rgba(139, 92, 246, 0.35)',
      primaryDetail: festName,
      secondaryDetail: 'University Festival',
      fullDescription: `${festName} Annual Cultural / Technical Festival. Non-Instructional Event.`,
    };
  }

  // 3. Known Specific Festival / Public Holidays (Fall 2026 / Academic Semester)
  let specificHolidayName: string | null = null;
  for (const ev of events) {
    const txt = (ev.text || '').trim();
    const cat = (ev.category || '').trim();
    if (cat && cat !== 'General' && cat !== 'Holiday' && cat !== 'Working Day') {
      specificHolidayName = cat.replace(/[()]/g, '').trim();
      break;
    }
    const m = txt.match(/\(([^)]+)\)/);
    if (m && !m[1].toLowerCase().includes('working')) {
      specificHolidayName = m[1].trim();
      break;
    }
  }

  const ymd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  const KNOWN_HOLIDAYS: Record<string, string> = {
    '2026-08-15': 'Independence Day',
    '2026-08-27': 'Krishna Janmashtami',
    '2026-09-07': 'Vinayagar Chaturthi',
    '2026-09-16': 'Milad-un-Nabi',
    '2026-10-02': 'Gandhi Jayanti',
    '2026-10-11': 'Ayudha Pooja',
    '2026-10-12': 'Vijaya Dasami / Dussehra',
    '2026-10-31': 'Deepavali (Diwali)',
    '2026-11-01': 'Diwali Holiday',
    '2026-11-15': 'Guru Nanak Jayanti',
    '2026-12-25': 'Christmas',
  };

  if (!specificHolidayName && KNOWN_HOLIDAYS[ymd]) {
    specificHolidayName = KNOWN_HOLIDAYS[ymd];
  }

  const isExplicitHoliday = events.some(isHolidayEvent) || Boolean(specificHolidayName) || combinedEventText.includes('holiday') || combinedEventText.includes('vacation');

  if (isExplicitHoliday) {
    const holidayTitle = specificHolidayName || 'University Holiday';
    return {
      dayType: 'holiday',
      badgeLabel: 'Holiday',
      badgeCol: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      bgCol: 'rgba(239, 68, 68, 0.07)',
      borderCol: 'rgba(239, 68, 68, 0.35)',
      primaryDetail: holidayTitle,
      secondaryDetail: 'Official Holiday',
      fullDescription: `${holidayTitle} - Declared University Holiday. No classes conducted.`,
    };
  }

  // 4. Sundays
  if (dow === 0) {
    return {
      dayType: 'holiday',
      badgeLabel: 'Sunday',
      badgeCol: '#f43f5e',
      badgeBg: 'rgba(244, 63, 94, 0.15)',
      bgCol: 'rgba(244, 63, 94, 0.04)',
      borderCol: 'rgba(244, 63, 94, 0.25)',
      primaryDetail: 'Sunday (Holiday)',
      secondaryDetail: 'Weekend Non-Working',
      fullDescription: 'Sunday - Weekly university holiday. No regular classes or lab sessions.',
    };
  }

  // 5. Saturdays
  if (dow === 6) {
    const isWorkingSaturday = events.some(isInstructionalEvent) || combinedEventText.includes('instructional') || combinedEventText.includes('order of');
    let orderDetail = '';
    const m = combinedEventText.match(/order of\s+([a-z]+)/i);
    if (m) {
      orderDetail = `Order of ${m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()}`;
    }

    if (isWorkingSaturday) {
      return {
        dayType: 'instructional',
        badgeLabel: 'Working',
        badgeCol: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.18)',
        bgCol: 'rgba(16, 185, 129, 0.06)',
        borderCol: 'rgba(16, 185, 129, 0.3)',
        primaryDetail: orderDetail ? `Instructional (${orderDetail})` : 'Instructional Day',
        secondaryDetail: orderDetail || 'Working Saturday',
        fullDescription: `Working Saturday — ${orderDetail || 'Regular instructional day according to university notification'}. Attendance recorded.`,
      };
    }

    return {
      dayType: 'weekend',
      badgeLabel: 'Weekend',
      badgeCol: '#94a3b8',
      badgeBg: 'rgba(148, 163, 184, 0.15)',
      bgCol: 'rgba(148, 163, 184, 0.03)',
      borderCol: 'rgba(148, 163, 184, 0.2)',
      primaryDetail: 'Saturday (Weekend)',
      secondaryDetail: 'No Classes',
      fullDescription: 'Saturday - University weekend. No instructional classes scheduled.',
    };
  }

  // 6. Regular Weekdays (Mon - Fri)
  let orderInfo = '';
  const orderMatch = combinedEventText.match(/order of\s+([a-z]+)/i);
  if (orderMatch) {
    orderInfo = `Order of ${orderMatch[1].charAt(0).toUpperCase() + orderMatch[1].slice(1).toLowerCase()}`;
  }

  return {
    dayType: 'instructional',
    badgeLabel: 'Working',
    badgeCol: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    bgCol: 'rgba(16, 185, 129, 0.05)',
    borderCol: 'rgba(16, 185, 129, 0.25)',
    primaryDetail: orderInfo ? `Instructional (${orderInfo})` : 'Instructional Day',
    secondaryDetail: orderInfo || 'Regular Timetable',
    fullDescription: orderInfo
      ? `Instructional Working Day following ${orderInfo} timetable.`
      : 'Instructional Working Day following normal weekday schedule. Attendance recorded.',
  };
}

interface CalendarViewProps {
  initialCalendars?: MonthCalendar[];
  calendarType?: string;
  onCalendarTypeChange?: (newType: string) => void;
  exams?: any;
  attendance?: any[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  initialCalendars,
  calendarType = 'ALL',
  onCalendarTypeChange,
  exams,
  attendance,
}) => {
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(calendarType || 'ALL');
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const fetchCalendar = async (typeToFetch = selectedType) => {
    setLoading(true);
    try {
      const data = await CampusAPI.getCalendar(undefined, typeToFetch);
      if (data && data.calendars && data.calendars.length > 0) {
        setCalendarData(data);
        // Auto-select current month (e.g. SEPTEMBER)
        const now = new Date();
        const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        const matchedIdx = data.calendars.findIndex((c) =>
          c.month.toUpperCase().includes(currentMonthName)
        );
        setActiveIdx(matchedIdx >= 0 ? matchedIdx : 0);
      }
    } catch (err) {
      console.warn('[CalendarView] Failed to fetch academic calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCalendars && initialCalendars.length > 0) {
      setCalendarData({ semesterId: 'CH20262701', calendars: initialCalendars });
      const now = new Date();
      const curMonth = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const idx = initialCalendars.findIndex((c) => c.month.toUpperCase().includes(curMonth));
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      fetchCalendar();
    }
  }, [initialCalendars]);

  const safeCalendars = useMemo<MonthCalendar[]>(() => {
    if (!calendarData || !calendarData.calendars) return [];
    return calendarData.calendars;
  }, [calendarData]);

  const activeCalendar = safeCalendars[activeIdx] || null;

  // Month parse
  const { year, monthIndex } = useMemo(() => {
    const now = new Date();
    if (!activeCalendar) return { year: now.getFullYear(), monthIndex: now.getMonth() };

    const MONTH_NAME_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const rawMonth = String(activeCalendar.month || '').trim();
    const match = rawMonth.match(/([a-zA-Z]+)\s+(\d{4})/);

    let parsedMonthIndex = now.getMonth();
    let parsedYear = now.getFullYear();

    if (match) {
      const monthPrefix = match[1].toLowerCase().slice(0, 3);
      parsedMonthIndex = MONTH_NAME_MAP[monthPrefix] ?? parsedMonthIndex;
      parsedYear = parseInt(match[2], 10);
    } else if (activeCalendar.year) {
      parsedYear = activeCalendar.year;
    }

    return { year: parsedYear, monthIndex: parsedMonthIndex };
  }, [activeCalendar]);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const daysGrid = useMemo(() => {
    if (!activeCalendar) return { blanks: [], days: [] };
    const monthStart = new Date(year, monthIndex, 1);
    const firstDay = monthStart.getDay(); // 0 is Sunday
    // Monday as first day of week: (firstDay + 6) % 7
    const blanksCount = (firstDay + 6) % 7;
    const blanks = Array.from({ length: blanksCount }, (_, i) => i);

    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const days: number[] = Array.from({ length: totalDays }, (_, i) => i + 1);

    return { blanks, days };
  }, [activeCalendar, year, monthIndex]);

  const examMap = useMemo(() => {
    return buildExamScheduleMap(exams, attendance);
  }, [exams, attendance]);

  const dayDetailsMap = useMemo(() => {
    const map = new Map<number, CalendarDayDetails>();
    daysGrid.days.forEach((dayNum) => {
      const dayInfo = activeCalendar?.days?.find((d) => d.date === dayNum);
      const details = resolveCalendarDayDetails(dayNum, dayInfo, year, monthIndex, examMap);
      map.set(dayNum, details);
    });
    return map;
  }, [daysGrid.days, activeCalendar, year, monthIndex, examMap]);

  // Statistics for active calendar month
  const stats = useMemo(() => {
    let instructional = 0;
    let holidays = 0;
    let exams = 0;

    dayDetailsMap.forEach((details) => {
      if (details.dayType === 'exam') exams++;
      else if (details.dayType === 'holiday' || details.dayType === 'weekend') holidays++;
      else if (details.dayType === 'instructional') instructional++;
    });

    return {
      total: daysGrid.days.length,
      instructional,
      holidays,
      exams,
    };
  }, [dayDetailsMap, daysGrid.days.length]);

  const getDayInfo = (dayNum: number): CalendarDay | undefined => {
    if (!activeCalendar) return undefined;
    return activeCalendar.days.find((d) => d.date === dayNum);
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

  const handleTypeSubmit = () => {
    if (onCalendarTypeChange) {
      onCalendarTypeChange(selectedType);
    }
    fetchCalendar(selectedType);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Card with Title and Actions */}
      <div className="card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)',
              }}
            >
              <CalendarDays size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                  Academic Calendar
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--accent-blue)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {CALENDAR_TYPES[selectedType] || selectedType}
                </span>
              </div>
              <p className="card-description" style={{ margin: 0, marginTop: '2px' }}>
                Official instructional schedules, examination milestones (CAT I, CAT II, FAT), and sanctioned holidays.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => fetchCalendar(selectedType)}
              disabled={loading}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)' }}
              title="Refresh academic calendar ledger"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh Calendar'}</span>
            </button>
          </div>
        </div>

        {/* 2. Month Selector Pills */}
        {safeCalendars.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {safeCalendars.map((cal, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={cal.month || idx}
                  onClick={() => {
                    setActiveIdx(idx);
                    setSelectedDay(null);
                  }}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    border: isActive ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {cal.month}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Main Calendar Container */}
      <div className="card">
        {/* Month Title Bar & Quick Stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setActiveIdx((prev) => Math.max(0, prev - 1));
                setSelectedDay(null);
              }}
              disabled={activeIdx === 0}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 8px' }}
            >
              <ChevronLeft size={16} />
            </button>

            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, minWidth: '170px', textAlign: 'center' }}>
              {activeCalendar?.month || 'Semester Calendar'}
            </h3>

            <button
              onClick={() => {
                setActiveIdx((prev) => Math.min(safeCalendars.length - 1, prev + 1));
                setSelectedDay(null);
              }}
              disabled={activeIdx >= safeCalendars.length - 1}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 8px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.80rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ color: 'var(--text-muted)' }}>Instructional: <strong>{stats.instructional}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.80rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ color: 'var(--text-muted)' }}>Holidays: <strong>{stats.holidays}</strong></span>
            </div>
            {stats.exams > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.80rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ color: 'var(--text-muted)' }}>Exams: <strong>{stats.exams}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* 7-column Calendar Grid */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <div
            style={{
              minWidth: '700px',
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            {weekdays.map((w) => (
              <div
                key={w}
                style={{
                  padding: '10px 0',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                {w}
              </div>
            ))}

            {daysGrid.blanks.map((b) => (
              <div key={`blank-${b}`} style={{ minHeight: '85px', opacity: 0.15 }} />
            ))}

            {daysGrid.days.map((dayNum) => {
              const dayInfo = getDayInfo(dayNum);
              const details = dayDetailsMap.get(dayNum) || resolveCalendarDayDetails(dayNum, dayInfo, year, monthIndex, examMap);
              const isSelected = selectedDay?.date === dayNum;
              const isToday = isCurrentMonth && dayNum === today.getDate();

              let borderCol = details.borderCol;
              let bgCol = details.bgCol;
              let badgeCol = details.badgeCol;
              let badgeBg = details.badgeBg;
              let badgeLabel = details.badgeLabel;

              if (isSelected) {
                borderCol = '#3b82f6';
                bgCol = 'rgba(59, 130, 246, 0.15)';
              }

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(dayInfo || { date: dayNum, events: [] })}
                  style={{
                    minHeight: '85px',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: bgCol,
                    border: `1px solid ${borderCol}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    boxShadow: isToday ? '0 0 0 2px #3b82f6' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: isToday ? '#3b82f6' : 'inherit',
                      }}
                    >
                      {dayNum}
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: badgeBg,
                        color: badgeCol,
                      }}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Day detail pill: always displays what is on this day! */}
                  <div style={{ marginTop: '5px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        lineHeight: '1.15',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        backgroundColor: badgeBg,
                        color: badgeCol,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={details.primaryDetail}
                    >
                      {details.primaryDetail}
                    </div>
                    {details.secondaryDetail && (
                      <div
                        style={{
                          fontSize: '0.62rem',
                          lineHeight: '1.1',
                          padding: '1px 3px',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={details.secondaryDetail}
                      >
                        {details.secondaryDetail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Selected Day Inspector Drawer / Card */}
        {selectedDay && (() => {
          const dayInfo = getDayInfo(selectedDay.date);
          const details = dayDetailsMap.get(selectedDay.date) || resolveCalendarDayDetails(selectedDay.date, dayInfo, year, monthIndex, examMap);
          const events = selectedDay.events || dayInfo?.events || [];

          return (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} color="var(--accent-blue)" />
                  <span>
                    Schedule for {activeCalendar?.month} {selectedDay.date}
                  </span>
                </h4>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Primary resolved classification */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: details.bgCol,
                    border: `1px solid ${details.borderCol}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: details.badgeCol }}>
                      {details.primaryDetail} {details.secondaryDetail ? `• ${details.secondaryDetail}` : ''}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {details.fullDescription}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: details.badgeBg,
                      color: details.badgeCol,
                    }}
                  >
                    {details.badgeLabel}
                  </span>
                </div>

                {/* Specific university event records if available */}
                {events.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: ev.color || details.badgeCol || '#3b82f6',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{ev.text}</div>
                      {ev.category && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Category: {ev.category} • Type: {ev.type}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 5. Calendar Type Switcher (CampusOS Model) */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
          Select University Academic Calendar Type
        </h4>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '500px' }}>
          Different degree programs follow tailored institutional calendars for regular working days, continuous assessment periods, and lab exams.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              minWidth: '220px',
            }}
          >
            {Object.entries(CALENDAR_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>

          <button
            onClick={handleTypeSubmit}
            disabled={loading}
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 18px', fontWeight: 600 }}
          >
            {loading ? 'Switching...' : 'Switch Calendar'}
          </button>
        </div>
      </div>
    </div>
  );
};
