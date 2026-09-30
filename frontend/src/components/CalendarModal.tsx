import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  RefreshCw,
  Info,
} from 'lucide-react';
import { CampusAPI } from '../services/api';
import { CalendarResponse, MonthCalendar, CalendarDay } from '../types';
import { buildExamScheduleMap } from './OverallAttendancePredictorModal';
import { resolveCalendarDayDetails, CalendarDayDetails } from './CalendarView';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams?: any;
  attendance?: any[];
}

export const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, exams, attendance }) => {
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeMonthIdx, setActiveMonthIdx] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const data = await CampusAPI.getCalendar();
      setCalendarData(data);
      if (data && data.calendars && data.calendars.length > 0) {
        // Try to match current calendar month
        const now = new Date();
        const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        const matchedIdx = data.calendars.findIndex((c) =>
          c.month.toUpperCase().includes(currentMonthName)
        );
        setActiveMonthIdx(matchedIdx >= 0 ? matchedIdx : 0);
      }
    } catch (err) {
      console.warn('[CalendarModal] Failed to fetch academic calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCalendar();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const calendars: MonthCalendar[] = calendarData?.calendars || [];
  const activeCalendar = calendars[activeMonthIdx] || null;

  // Compute month layout
  const { year, monthIndex } = useMemo(() => {
    const now = new Date();
    if (!activeCalendar) return { year: now.getFullYear(), monthIndex: now.getMonth() };

    const MONTHS_MAP: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };

    const match = activeCalendar.month.match(/([a-zA-Z]+)\s+(\d{4})/);
    let parsedMonthIndex = now.getMonth();
    let parsedYear = now.getFullYear();

    if (match) {
      const monthPrefix = match[1].slice(0, 3).toUpperCase();
      parsedMonthIndex = MONTHS_MAP[monthPrefix] ?? parsedMonthIndex;
      parsedYear = parseInt(match[2], 10);
    }

    return { year: parsedYear, monthIndex: parsedMonthIndex };
  }, [activeCalendar]);

  const daysGrid = useMemo(() => {
    if (!activeCalendar) return { blanks: [], days: [] };
    const monthStart = new Date(year, monthIndex, 1);
    const firstDay = monthStart.getDay(); // 0 is Sunday
    // Monday as first day of week: (firstDay + 6) % 7
    const blanksCount = (firstDay + 6) % 7;
    const blanks = Array.from({ length: blanksCount }, (_, i) => i);

    // Number of days in month
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

  const getDayInfo = (dayNum: number): CalendarDay | undefined => {
    if (!activeCalendar) return undefined;
    return activeCalendar.days.find((d) => d.date === dayNum);
  };

  if (!isOpen) return null;

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card, #121826)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>VTOP Academic Calendar</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Instructional Working Days, Holidays &amp; Semester Exam Windows
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchCalendar}
              disabled={loading}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ padding: '6px', borderRadius: '8px' }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Month Tabs */}
        {calendars.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 24px',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
              overflowX: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            {calendars.map((cal, idx) => {
              const isActive = idx === activeMonthIdx;
              return (
                <button
                  key={cal.month || idx}
                  onClick={() => {
                    setActiveMonthIdx(idx);
                    setSelectedDay(null);
                  }}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cal.month}
                </button>
              );
            })}
          </div>
        )}

        {/* Body Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading academic calendar from university ledger...
            </div>
          ) : !activeCalendar ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No academic calendar data available for this semester.
            </div>
          ) : (
            <div>
              {/* Month Title & Legend */}
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
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  {activeCalendar.month}
                </h3>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Instructional Day</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Holiday / Vacation</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                    <span style={{ color: 'var(--text-muted)' }}>CAT / FAT Exam</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Fest / Event</span>
                  </div>
                </div>
              </div>

              {/* 7-column Calendar Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '6px',
                  textAlign: 'center',
                }}
              >
                {weekdays.map((w) => (
                  <div
                    key={w}
                    style={{
                      padding: '8px 0',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {w}
                  </div>
                ))}

                {daysGrid.blanks.map((b) => (
                  <div key={`blank-${b}`} style={{ minHeight: '68px', opacity: 0.2 }} />
                ))}

                {daysGrid.days.map((dayNum) => {
                  const dayInfo = getDayInfo(dayNum);
                  const details = dayDetailsMap.get(dayNum) || resolveCalendarDayDetails(dayNum, dayInfo, year, monthIndex, examMap);
                  const isSelected = selectedDay?.date === dayNum;

                  let borderCol = details.borderCol;
                  let bgCol = details.bgCol;

                  if (isSelected) {
                    borderCol = '#3b82f6';
                    bgCol = 'rgba(59, 130, 246, 0.15)';
                  }

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDay(dayInfo || { date: dayNum, events: [] })}
                      style={{
                        minHeight: '68px',
                        padding: '6px',
                        borderRadius: '8px',
                        border: `1px solid ${borderCol}`,
                        backgroundColor: bgCol,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: isSelected ? '#60a5fa' : 'inherit',
                          display: 'flex',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <span>{dayNum}</span>
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '3px',
                            backgroundColor: details.badgeBg,
                            color: details.badgeCol,
                          }}
                        >
                          {details.badgeLabel}
                        </span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.64rem',
                          fontWeight: 600,
                          padding: '2px 4px',
                          borderRadius: '4px',
                          backgroundColor: details.badgeBg,
                          color: details.badgeCol,
                          marginTop: '2px',
                          textAlign: 'left',
                        }}
                        title={details.primaryDetail}
                      >
                        {details.primaryDetail}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Day Details Panel */}
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
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Info size={16} color="#3b82f6" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                        Schedule for {selectedDay.date} {activeCalendar.month}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Resolved primary classification */}
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
                          <div style={{ fontSize: '0.90rem', fontWeight: 700, color: details.badgeCol }}>
                            {details.primaryDetail} {details.secondaryDetail ? `• ${details.secondaryDetail}` : ''}
                          </div>
                          <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
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

                      {events.map((ev, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{ev.text}</span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor:
                                ev.type === 'Instructional Day'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : ev.type === 'Holiday'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                              color:
                                ev.type === 'Instructional Day'
                                  ? '#10b981'
                                  : ev.type === 'Holiday'
                                  ? '#ef4444'
                                  : '#3b82f6',
                            }}
                          >
                            {ev.category || ev.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            VTOP Semester Calendar System
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
