import React, { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, Calendar, Info } from 'lucide-react';
import { Attendance, Exam } from '../types';
import { analyzeAllCalendars } from '../services/calendarService';
import { DEFAULT_EXAMS } from '../services/defaultData';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface OverallAttendancePredictorModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: Attendance[];
  calendars?: any[];
  dayCardsMap?: Record<string, any[]>;
  exams?: Exam[];
}

const normalize = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const normalizeDay = (d: string) => (d || '').slice(0, 3).toUpperCase();

const dayOrderMap: Record<string, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
};

export interface ExamScheduleEntry {
  examType: string;
  label: string;
  fullName: string;
  slot?: string;
  courseCode?: string;
  courseTitle?: string;
}

export function parseExamDateStr(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'TBA') return null;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        const day = parseInt(parts[0], 10);
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const mIdx = months.indexOf(parts[1].toUpperCase());
        const yr = parseInt(parts[2], 10);
        if (mIdx !== -1 && !isNaN(day) && !isNaN(yr)) {
          return new Date(yr, mIdx, day);
        }
      }
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function buildExamScheduleMap(examsProp?: any, attendance?: Attendance[]): Map<string, ExamScheduleEntry> {
  const map = new Map<string, ExamScheduleEntry>();

  const toKey = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
  };

  const findCourseForSlot = (slotStr?: string) => {
    if (!slotStr || !Array.isArray(attendance)) return undefined;
    const cleanSlot = slotStr.trim().toUpperCase();
    return attendance.find((a) => {
      const s = String(a.slots || a.slot || '').toUpperCase();
      return s.split('+').map((x) => x.trim()).includes(cleanSlot) || s.includes(cleanSlot);
    });
  };

  const addEntry = (examType: string, it: any) => {
    if (!it || !it.date) return;
    const dt = parseExamDateStr(it.date);
    if (!dt) return;
    const key = toKey(dt);
    const typeUpper = String(examType || '').toUpperCase();
    const label =
      typeUpper.includes('1') || typeUpper.includes('CAT I')
        ? 'CAT 1'
        : typeUpper.includes('2') || typeUpper.includes('CAT II')
        ? 'CAT 2'
        : typeUpper.includes('LAB') && typeUpper.includes('FAT')
        ? 'Lab FAT'
        : typeUpper.includes('FAT') || typeUpper.includes('FINAL')
        ? 'FAT'
        : examType;

    const matched =
      findCourseForSlot(it.slot) ||
      (it.courseCode ? { courseCode: it.courseCode, courseTitle: it.courseTitle } : undefined);
    const courseSnippet = matched?.courseCode ? ` - ${matched.courseCode}` : '';
    map.set(key, {
      examType,
      label,
      fullName: `${examType} Examination (${it.slot ? `Slot ${it.slot}` : ''}${courseSnippet})`.trim(),
      slot: it.slot,
      courseCode: matched?.courseCode,
      courseTitle: matched?.courseTitle || it.courseTitle,
    });
  };

  // 1. Populate baseline from DEFAULT_EXAMS
  if (DEFAULT_EXAMS && typeof DEFAULT_EXAMS === 'object') {
    for (const [examType, items] of Object.entries(DEFAULT_EXAMS)) {
      if (Array.isArray(items)) {
        for (const it of items) {
          addEntry(examType, it);
        }
      }
    }
  }

  // 2. Overlay live exams records from prop if available (array or record object)
  if (examsProp) {
    if (Array.isArray(examsProp) && examsProp.length > 0) {
      for (const ex of examsProp) {
        const typeStr = ex.examType || ex.title || 'Exam';
        addEntry(typeStr, ex);
      }
    } else if (typeof examsProp === 'object') {
      for (const [examType, items] of Object.entries(examsProp)) {
        if (Array.isArray(items)) {
          for (const ex of items) {
            addEntry(examType, ex);
          }
        }
      }
    }
  }

  return map;
}

export function getExamForDay(
  date: Date | null,
  events: any[],
  examMap: Map<string, ExamScheduleEntry>
): { isExam: boolean; label: string; fullName: string; slot?: string; courseCode?: string } {
  if (!date) return { isExam: false, label: '', fullName: '' };

  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  if (examMap.has(key)) {
    const entry = examMap.get(key)!;
    return {
      isExam: true,
      label: entry.label,
      fullName: entry.fullName,
      slot: entry.slot,
      courseCode: entry.courseCode,
    };
  }

  // Also check calendar day events
  for (const ev of events || []) {
    const text = String(ev.text || '').toLowerCase();
    const cat = String(ev.category || '').toLowerCase();
    const type = String(ev.type || '').toLowerCase();
    const combined = `${text} ${cat} ${type}`;

    if (
      combined.includes('cat ii') ||
      combined.includes('cat 2') ||
      combined.includes('cat-2') ||
      combined.includes('assessment test 2') ||
      combined.includes('assessment test - ii') ||
      cat === 'cat ii' ||
      cat === 'cat 2'
    ) {
      return { isExam: true, label: 'CAT 2', fullName: 'CAT II Examination' };
    }

    if (
      combined.includes('cat i') ||
      combined.includes('cat 1') ||
      combined.includes('cat-1') ||
      combined.includes('assessment test 1') ||
      combined.includes('assessment test - i') ||
      cat === 'cat i' ||
      cat === 'cat 1'
    ) {
      return { isExam: true, label: 'CAT 1', fullName: 'CAT I Examination' };
    }

    if (combined.includes('lab fat') || combined.includes('laboratory fat')) {
      return { isExam: true, label: 'Lab FAT', fullName: 'Lab Final Assessment Test' };
    }

    if (
      combined.includes('fat') ||
      combined.includes('final assessment') ||
      cat === 'fat' ||
      text.includes('final assessment test') ||
      (type.includes('examination') && !combined.includes('cat'))
    ) {
      return { isExam: true, label: 'FAT', fullName: 'Final Assessment Test (FAT)' };
    }

    if (combined.includes('mid term') || combined.includes('midterm')) {
      return { isExam: true, label: 'Mid Term', fullName: 'Mid Term Examination' };
    }
  }

  return { isExam: false, label: '', fullName: '' };
}

export const OverallAttendancePredictorModal: React.FC<OverallAttendancePredictorModalProps> = ({
  isOpen,
  onClose,
  attendance = [],
  calendars = [],
  dayCardsMap = {},
  exams = [],
}) => {
  useLockBodyScroll(isOpen);
  const [dateStates, setDateStates] = useState<Record<number, number>>({});
  const [mode, setMode] = useState<'CAT1' | 'CAT2' | 'LID'>('LID');
  const [monthIdx, setMonthIdx] = useState<number>(0);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const examMap = useMemo(() => {
    return buildExamScheduleMap(exams, attendance);
  }, [exams, attendance]);

  const { results: analyzeCalendars, importantEvents } = useMemo(() => {
    return analyzeAllCalendars(calendars);
  }, [calendars]);

  const findEventDate = (eventName: string): Date | null => {
    const ev = Array.from(importantEvents.values()).find(
      (e) => e.event.toLowerCase() === eventName.toLowerCase()
    );
    return ev ? ev.formattedDate : null;
  };

  const impDates = useMemo(() => {
    return {
      cat1Date: findEventDate('CAT I') || findEventDate('CAT 1') || new Date('2026-08-14'),
      cat2Date: findEventDate('CAT II') || findEventDate('CAT 2') || new Date('2026-10-01'),
      lidLabDate: findEventDate('lid for laboratory classes') || new Date('2026-11-10'),
      lidTheoryDate: findEventDate('LID FOR THEORY CLASSES') || new Date('2026-11-13'),
      midsemStart: findEventDate('Mid Term Test') || findEventDate('CAT I') || new Date('2026-08-08'),
    };
  }, [importantEvents]);

  // Extract all working instructional days and examinations across the entire semester
  const allWorkingDays = useMemo(() => {
    if (!Array.isArray(analyzeCalendars) || analyzeCalendars.length === 0) return [];

    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];

    return analyzeCalendars.flatMap((monthObj) => {
      const monthStr = monthObj.month?.toLowerCase() || '';
      const year = monthObj.year || new Date().getFullYear();
      const foundMonth = monthNames.find((m) => monthStr.includes(m));
      const mIndex = foundMonth ? monthNames.indexOf(foundMonth) : -1;

      return (monthObj.days || [])
        .map((d) => {
          const dateObj = mIndex === -1 ? null : new Date(year, mIndex, d.date);
          if (!dateObj) return null;

          const exam = getExamForDay(dateObj, d.events || [], examMap);
          const typeLower = (d.type || '').toLowerCase();

          // Keep days that are academic working days OR exam days
          if (typeLower !== 'working' && !exam.isExam) return null;

          // Resolve effective day (e.g. handle Saturday swaps like 'Instructional Day (Order of Friday)')
          let effectiveDay = normalizeDay(d.weekday || '');
          if (effectiveDay === 'SAT' && Array.isArray(d.events) && d.events.length > 0) {
            const found = d.events.find((ev: any) =>
              /(monday|tuesday|wednesday|thursday|friday)/i.test(ev.text || ev.category || '')
            );
            if (found) {
              const match = (found.text || found.category || '').match(
                /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
              );
              if (match && match[1]) {
                const mapped = dayOrderMap[match[1].toLowerCase()];
                if (mapped) effectiveDay = mapped;
              }
            }
          }

          return {
            date: dateObj,
            weekday: d.weekday,
            effectiveDay,
            month: monthObj.month,
            year: monthObj.year,
            events: d.events || [],
            isExam: exam.isExam,
            examLabel: exam.label,
            examFullName: exam.fullName,
            slot: exam.slot,
            courseCode: exam.courseCode,
          };
        })
        .filter(Boolean) as Array<{
          date: Date;
          weekday: string;
          effectiveDay: string;
          month: string;
          year: number;
          events: any[];
          isExam: boolean;
          examLabel: string;
          examFullName: string;
          slot?: string;
          courseCode?: string;
        }>;
    });
  }, [analyzeCalendars, examMap]);

  const formatMonthLabel = (monthStr?: string, yearNum?: number) => {
    if (!monthStr) return '';
    const clean = String(monthStr).trim();
    if (/\d{4}/.test(clean)) return clean;
    return `${clean} ${yearNum || new Date().getFullYear()}`;
  };

  const monthsAvailable = useMemo(() => {
    return Array.from(new Set(allWorkingDays.map((d) => formatMonthLabel(d.month, d.year))));
  }, [allWorkingDays]);

  // Automatically start with current month (e.g. SEPTEMBER 2026)
  useEffect(() => {
    if (monthsAvailable.length > 0) {
      const now = new Date();
      const curMonthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const idx = monthsAvailable.findIndex((m) => m.toUpperCase().includes(curMonthName));
      if (idx >= 0) {
        setMonthIdx(idx);
      } else {
        setMonthIdx(0);
      }
    }
  }, [monthsAvailable]);

  const currentMonth = monthsAvailable[monthIdx] || (monthsAvailable[0] || '');

  const handleModeChange = (newMode: 'CAT1' | 'CAT2' | 'LID') => {
    setMode(newMode);
    if (newMode === 'CAT1') {
      const idx = monthsAvailable.findIndex((m) => m.toUpperCase().includes('AUGUST'));
      if (idx >= 0) setMonthIdx(idx);
    } else if (newMode === 'CAT2') {
      const idx = monthsAvailable.findIndex((m) => m.toUpperCase().includes('SEPTEMBER'));
      if (idx >= 0) setMonthIdx(idx);
    } else if (newMode === 'LID') {
      const now = new Date();
      const curMonthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const idx = monthsAvailable.findIndex((m) => m.toUpperCase().includes(curMonthName));
      if (idx >= 0) setMonthIdx(idx);
    }
  };

  const cutoffDate = useMemo(() => {
    if (mode === 'CAT1') return impDates.cat1Date;
    if (mode === 'CAT2') return impDates.cat2Date;
    return new Date(Math.max(impDates.lidLabDate.getTime(), impDates.lidTheoryDate.getTime()));
  }, [mode, impDates]);

  const attendanceLockDates = useMemo(() => {
    if (!cutoffDate || mode === 'LID') return new Set<number>();
    const isThuOrFri = (d: Date) => d.getDay() === 4 || d.getDay() === 5;
    const locked = new Set<number>();
    const d1 = new Date(cutoffDate);
    d1.setDate(d1.getDate() - 2);
    const d2 = new Date(cutoffDate);
    d2.setDate(d2.getDate() - 1);
    if (isThuOrFri(d1)) locked.add(normalize(d1));
    if (isThuOrFri(d2)) locked.add(normalize(d2));
    return locked;
  }, [cutoffDate, mode]);

  const visibleDays = useMemo(() => {
    return allWorkingDays.filter((d) => {
      if (!d || !d.date) return false;
      const sameMonth = formatMonthLabel(d.month, d.year) === currentMonth;
      if (!sameMonth) return false;
      // Allow exam days (like FAT in November or CAT2 in September) to remain visible in the month view
      if (cutoffDate && d.date > cutoffDate && !d.isExam) return false;
      return true;
    });
  }, [allWorkingDays, currentMonth, cutoffDate]);

  const toggleDate = (date: Date, isExam?: boolean) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isExam || date < today) return; // Cannot toggle regular class attendance on examination or past days
    const time = date.getTime();
    setDateStates((prev) => {
      const effectiveState =
        prev[time] !== undefined
          ? prev[time]
          : attendanceLockDates.has(time)
          ? 2
          : 0;
      // Cycle: 0 (Attend) -> 1 (Absent) -> 2 (Skip) -> 0
      const nextState = (effectiveState + 1) % 3;
      return { ...prev, [time]: nextState };
    });
  };

  const resetSelected = () => setDateStates({});

  // Prediction calculation using exact CampusOS formula:
  // effectiveFuture = isLab ? futureCount * 2 : futureCount
  // effectiveMissed = effectiveFuture > 0 ? (isLab ? missed * 2 : missed) : 0
  // predictedAttended = attended + (effectiveFuture - effectiveMissed)
  // predictedTotal = total + effectiveFuture
  // predictedPercent = ((predictedAttended / predictedTotal) * 100).toFixed(1)
  const predictions = useMemo(() => {
    return attendance
      .filter((c) => (c.slot || c.slots || '') !== 'NILL')
      .map((c) => {
        const attended = parseInt(String(c.attended ?? c.classesAttended ?? 0)) || 0;
        const total = parseInt(String(c.conducted ?? c.classesConducted ?? c.total ?? 0)) || 0;
        const isLab =
          (c.courseCode || '').endsWith('(L)') ||
          (c.courseCode || '').endsWith('P') ||
          (c.courseType || '').toLowerCase().includes('lab') ||
          (c.type || '').toLowerCase().includes('lab');

        let effectiveCutoff: Date | null = null;
        if (mode === 'CAT1') {
          effectiveCutoff = impDates.cat1Date;
        } else if (mode === 'CAT2') {
          effectiveCutoff = impDates.cat2Date;
        } else if (mode === 'LID') {
          effectiveCutoff = isLab ? impDates.lidLabDate : impDates.lidTheoryDate;
        }

        const filteredDays = allWorkingDays.filter(
          (d) => !effectiveCutoff || d.date <= effectiveCutoff
        );

        const { futureCount } = countFutureClassesForCourse(
          c.courseCode,
          dayCardsMap,
          filteredDays,
          dateStates,
          effectiveCutoff,
          attendanceLockDates
        );
        const missed = countMissedClassesForCourse(
          c.courseCode,
          dayCardsMap,
          dateStates,
          filteredDays,
          effectiveCutoff,
          attendanceLockDates
        );

        const effectiveFuture = isLab ? futureCount * 2 : futureCount;
        const effectiveMissed = effectiveFuture > 0 ? (isLab ? missed * 2 : missed) : 0;

        const predictedAttended = attended + (effectiveFuture - effectiveMissed);
        const predictedTotal = total + effectiveFuture;
        const predictedPercent =
          predictedTotal > 0
            ? parseFloat(((predictedAttended / predictedTotal) * 100).toFixed(1))
            : 100;

        // Baseline (0 simulated absences)
        const baselineAttended = attended + effectiveFuture;
        const baselinePercent =
          predictedTotal > 0
            ? parseFloat(((baselineAttended / predictedTotal) * 100).toFixed(1))
            : 100;
        const deltaPercent = parseFloat((predictedPercent - baselinePercent).toFixed(1));

        return {
          ...c,
          predictedAttended,
          predictedTotal,
          predictedPercent,
          missedCount: effectiveMissed,
          deltaPercent,
          isLab,
        };
      });
  }, [
    dateStates,
    attendance,
    allWorkingDays,
    dayCardsMap,
    mode,
    cutoffDate,
    impDates,
    attendanceLockDates,
  ]);

  const totalAttended = predictions.reduce((sum, p) => sum + (p.predictedAttended || 0), 0);
  const totalClasses = predictions.reduce((sum, p) => sum + (p.predictedTotal || 0), 0);
  const overallAvg = totalClasses > 0 ? ((totalAttended / totalClasses) * 100).toFixed(1) : '0.0';

  if (!isOpen) return null;

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
          maxWidth: '920px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-primary, #0f172a)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          boxSizing: 'border-box',
          overscrollBehavior: 'contain',
        }}
      >
        {/* 1. Fixed Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan, #06b6d4)',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Overall Attendance Predictor
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Simulate day leaves to predict final semester attendance margins across your timetable.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', borderRadius: '8px' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. Scrollable Middle Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Milestone Mode Selector & Month Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Target Cutoff Mode */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['CAT1', 'CAT2', 'LID'] as const).map((mKey) => (
                <button
                  key={mKey}
                  onClick={() => handleModeChange(mKey)}
                  className={`btn btn-sm ${mode === mKey ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    fontSize: '0.80rem',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: mode === mKey ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {mKey === 'CAT1' ? 'Till CAT I' : mKey === 'CAT2' ? 'Till CAT II' : 'Till LID (FAT)'}
                </button>
              ))}
            </div>

            {/* Month Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                disabled={monthIdx === 0}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px' }}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '130px', textAlign: 'center' }}>
                {currentMonth}
              </span>
              <button
                onClick={() => setMonthIdx((i) => Math.min(monthsAvailable.length - 1, i + 1))}
                disabled={monthIdx >= monthsAvailable.length - 1}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px' }}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={resetSelected}
                title="Reset all days to attending"
                className="btn btn-sm btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  marginLeft: '8px',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                }}
              >
                <RotateCcw size={14} />
                <span>Reset Selections</span>
              </button>
            </div>
          </div>

          {/* Interactive Working Days Grid */}
          <div
            style={{
              background: 'var(--bg-tertiary, #1e293b)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.80rem', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                Click a future date to toggle: <strong style={{ color: 'var(--text-primary)' }}>Attending → Missed (Absent) → Ignored</strong>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid var(--success-emerald, #10b981)' }}></span>
                  <span style={{ fontSize: '0.75rem' }}>Attending</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.4)', border: '1px solid var(--danger-crimson, #ef4444)' }}></span>
                  <span style={{ fontSize: '0.75rem' }}>Missed (Absent)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(148, 163, 184, 0.2)', border: '1px solid var(--text-muted)' }}></span>
                  <span style={{ fontSize: '0.75rem' }}>Ignored</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.35)', border: '1px solid #c084fc' }}></span>
                  <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600 }}>Exam (CAT / FAT)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(100, 116, 139, 0.2)', border: '1px solid rgba(148, 163, 184, 0.35)' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conducted</span>
                </div>
              </div>
            </div>

            {visibleDays.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No working instructional days or examinations scheduled for this period.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px' }}>
                {visibleDays.map((d, dIdx) => {
                  const isExam = d.isExam;
                  const time = d.date.getTime();
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const isPast = d.date.getTime() < todayDate.getTime();
                  const isToday = d.date.toDateString() === new Date().toDateString();

                  const state =
                    dateStates[time] !== undefined
                      ? dateStates[time]
                      : attendanceLockDates.has(time)
                      ? 2
                      : 0;

                  const classesOnDay = (dayCardsMap[d.effectiveDay] || []).length;
                  const isDisabled = isExam || isPast;

                  let bg = 'rgba(16, 185, 129, 0.18)';
                  let border = '1px solid rgba(16, 185, 129, 0.5)';
                  let badgeBg = 'rgba(16, 185, 129, 0.2)';
                  let badgeColor = 'var(--success-emerald, #10b981)';
                  let badgeText = 'Attend';
                  let subText = `${classesOnDay} ${classesOnDay === 1 ? 'class' : 'classes'}`;
                  let subColor = 'var(--text-muted)';
                  let title = `${d.weekday} ${d.date.getDate()} (${d.effectiveDay}): ${classesOnDay} classes scheduled. Click to toggle.`;

                  if (isExam) {
                    bg = 'rgba(168, 85, 247, 0.16)';
                    border = '1px solid rgba(168, 85, 247, 0.55)';
                    badgeBg = 'rgba(168, 85, 247, 0.35)';
                    badgeColor = '#f3e8ff';
                    badgeText = d.examLabel || 'EXAM';
                    subText = d.slot ? `${d.examLabel} (${d.slot})` : `${d.examLabel} Exam`;
                    subColor = '#c084fc';
                    title = `${d.weekday} ${d.date.getDate()}: ${d.examFullName || d.examLabel}. Examination Day — No regular classes scheduled.`;
                  } else if (isPast) {
                    bg = '#070a10';
                    border = '1px solid rgba(255, 255, 255, 0.08)';
                    badgeBg = 'rgba(255, 255, 255, 0.04)';
                    badgeColor = '#64748b';
                    badgeText = 'Past';
                    subText = `${classesOnDay} ${classesOnDay === 1 ? 'class' : 'classes'}`;
                    subColor = '#475569';
                    title = `${d.weekday} ${d.date.getDate()}: Past conducted class day (Locked).`;
                  } else {
                    if (isToday) {
                      border = '2px solid var(--accent-cyan, #06b6d4)';
                    }
                    if (state === 1) {
                      bg = 'rgba(239, 68, 68, 0.35)';
                      border = '1px solid var(--danger-crimson, #ef4444)';
                      badgeBg = 'rgba(239, 68, 68, 0.3)';
                      badgeColor = 'var(--danger-crimson, #ef4444)';
                      badgeText = 'Absent';
                    } else if (state === 2) {
                      bg = 'rgba(148, 163, 184, 0.15)';
                      border = '1px dashed var(--text-muted)';
                      badgeBg = 'rgba(148, 163, 184, 0.2)';
                      badgeColor = 'var(--text-muted)';
                      badgeText = 'Skip';
                    }
                  }

                  return (
                    <button
                      key={dIdx}
                      onClick={() => !isDisabled && toggleDate(d.date, isExam)}
                      disabled={isDisabled}
                      title={title}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        background: bg,
                        border,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        boxShadow: isExam ? '0 0 10px rgba(168, 85, 247, 0.15)' : 'none',
                        opacity: isPast && !isExam ? 0.55 : 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: isExam ? '#c084fc' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: isExam ? 700 : 600,
                        }}
                      >
                        {d.weekday}
                      </span>
                      <span
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: isExam ? '#e9d5ff' : isPast ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}
                      >
                        {d.date.getDate()}
                      </span>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          letterSpacing: isExam ? '0.03em' : 'normal',
                          border: isExam ? '1px solid rgba(168, 85, 247, 0.6)' : 'none',
                        }}
                      >
                        {badgeText}
                      </span>
                      <span
                        style={{
                          fontSize: '0.60rem',
                          color: subColor,
                          marginTop: '2px',
                          fontWeight: isExam ? 700 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '72px',
                          textAlign: 'center',
                        }}
                      >
                        {subText}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aggregate Prediction Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderRadius: '12px',
              background: parseFloat(overallAvg) >= 80 ? 'rgba(16, 185, 129, 0.12)' : parseFloat(overallAvg) >= 75 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${parseFloat(overallAvg) >= 80 ? 'rgba(16, 185, 129, 0.4)' : parseFloat(overallAvg) >= 75 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Projected Attendance Aggregate
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: parseFloat(overallAvg) >= 80 ? 'var(--success-emerald, #10b981)' : parseFloat(overallAvg) >= 75 ? 'var(--warning-amber, #f59e0b)' : 'var(--danger-crimson, #ef4444)',
                }}
              >
                {overallAvg}%
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Projected Classes
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {totalAttended} / {totalClasses} classes
              </div>
            </div>
          </div>

          {/* 3. Course-by-Course Predictions Section (flexShrink: 0 ensures it is NEVER hidden/squished) */}
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} color="var(--accent-cyan, #06b6d4)" />
                <span>Course-by-Course Attendance Predictions ({predictions.length} Courses)</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                When you mark a day absent, all classes scheduled on that day are marked missed.
              </span>
            </div>

            {/* Fully visible courses table */}
            <div
              style={{
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                overflowX: 'auto',
              }}
            >
              <table
                className="academic-data-table"
                style={{
                  width: '100%',
                  fontSize: '0.84rem',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Course Code</th>
                    <th style={{ padding: '10px 14px' }}>Course Title</th>
                    <th style={{ padding: '10px 14px' }}>Projected Classes</th>
                    <th style={{ padding: '10px 14px' }}>Predicted %</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Absence Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p, pIdx) => {
                    const pct = p.predictedPercent;
                    const isLab = p.isLab;
                    return (
                      <tr key={pIdx}>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan, #06b6d4)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{p.courseCode}</span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: isLab ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: isLab ? '#a78bfa' : '#60a5fa',
                                fontWeight: 700,
                              }}
                            >
                              {isLab ? 'LAB' : 'TH'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                          {p.courseTitle || p.courseName}
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                          {p.predictedAttended} / {p.predictedTotal}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.92rem',
                              color: pct >= 80 ? 'var(--success-emerald, #10b981)' : pct >= 75 ? 'var(--warning-amber, #f59e0b)' : 'var(--danger-crimson, #ef4444)',
                            }}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor:
                                pct >= 80
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : pct >= 75
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color:
                                pct >= 80
                                  ? 'var(--success-emerald, #10b981)'
                                  : pct >= 75
                                  ? 'var(--warning-amber, #f59e0b)'
                                  : 'var(--danger-crimson, #ef4444)',
                              border: `1px solid ${
                                pct >= 80
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : pct >= 75
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)'
                              }`,
                            }}
                          >
                            {pct >= 80 ? 'Safe' : pct >= 75 ? 'Borderline' : 'Shortage'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {p.missedCount > 0 ? (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--danger-crimson, #ef4444)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              -{p.missedCount} {p.missedCount === 1 ? 'class' : 'classes'} ({p.deltaPercent}%)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Attending all
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. Fixed Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.02))',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} className="btn btn-primary btn-sm" style={{ padding: '6px 20px', fontWeight: 600 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

function countFutureClassesForCourse(
  courseCode: string,
  dayCardsMap: Record<string, any[]>,
  allWorkingDays: any[],
  dateStates: Record<number, number>,
  cutoffDate: Date | null,
  attendanceLockDates?: Set<number>
): { futureCount: number } {
  if (!courseCode || !dayCardsMap || !Array.isArray(allWorkingDays))
    return { futureCount: 0 };

  const normalizeDay = (d: string) => (d || '').slice(0, 3).toUpperCase();

  const cleanTarget = (courseCode || '').replace(/\([TL]\)$/, '').trim().toUpperCase();

  const subjectDays = Object.keys(dayCardsMap).filter((day) =>
    (dayCardsMap[day] || []).some((c) => {
      const code = (c.courseCode || c.code || '').replace(/\([TL]\)$/, '').trim().toUpperCase();
      return code === cleanTarget || (c.courseCode || c.code) === courseCode;
    })
  );
  if (subjectDays.length === 0)
    return { futureCount: 0 };

  const subjectDaysShort = subjectDays.map(normalizeDay);

  const dayOrderMap: Record<string, string> = {
    monday: 'MON',
    tuesday: 'TUE',
    wednesday: 'WED',
    thursday: 'THU',
    friday: 'FRI',
  };

  const ymd = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
  };

  const effectiveMap = new Map<string, string>();
  for (const d of allWorkingDays) {
    if (!d?.date) continue;
    let effectiveDay = normalizeDay(d.weekday || '');
    if (effectiveDay === 'SAT' && Array.isArray(d.events) && d.events.length > 0) {
      const found = d.events.find((ev: any) =>
        /(monday|tuesday|wednesday|thursday|friday)/i.test(ev.text || ev.category || '')
      );
      if (found) {
        const match = (found.text || found.category || '').match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
        );
        if (match && match[1]) {
          const mapped = dayOrderMap[match[1].toLowerCase()];
          if (mapped) effectiveDay = mapped;
        }
      }
    }
    effectiveMap.set(ymd(d.date), effectiveDay);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const remainingWorkingDays = allWorkingDays.filter((d) => {
    if (!d || !d.date || isNaN(d.date.getTime?.())) return false;

    // Only future days counted from today; past conducted classes are already in VTOP record
    if (d.date < today) return false;

    if (cutoffDate && d.date > cutoffDate) return false;

    // Exclude all examination days (e.g. CAT 1, CAT 2, FAT) from regular class calculations
    if (d.isExam) return false;

    let effectiveDay = normalizeDay(d.weekday || '');
    if (effectiveDay === 'SAT' && Array.isArray(d.events) && d.events.length > 0) {
      const found = d.events.find((ev: any) =>
        /(monday|tuesday|wednesday|thursday|friday)/i.test(ev.text || ev.category || '')
      );
      if (found) {
        const match = (found.text || found.category || '').match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
        );
        if (match && match[1]) {
          const mapped = dayOrderMap[match[1].toLowerCase()];
          if (mapped) effectiveDay = mapped;
        }
      }
    }

    const time = d.date.getTime();

    const effectiveState =
      dateStates[time] !== undefined
        ? dateStates[time]
        : attendanceLockDates?.has(time)
        ? 2
        : 0;

    return subjectDaysShort.includes(effectiveDay) && effectiveState !== 2;
  });

  return { futureCount: remainingWorkingDays.length };
}

function countMissedClassesForCourse(
  courseCode: string,
  dayCardsMap: Record<string, any[]>,
  dateStates: Record<number, number>,
  allWorkingDays: any[],
  cutoffDate: Date | null,
  attendanceLockDates?: Set<number>
): number {
  if (!courseCode || !dayCardsMap || typeof dateStates !== 'object') return 0;

  const normalizeDay = (d: string) => (d || '').slice(0, 3).toUpperCase();

  const cleanTarget = (courseCode || '').replace(/\([TL]\)$/, '').trim().toUpperCase();

  const subjectDays = Object.keys(dayCardsMap).filter((day) =>
    (dayCardsMap[day] || []).some((c) => {
      const code = (c.courseCode || c.code || '').replace(/\([TL]\)$/, '').trim().toUpperCase();
      return code === cleanTarget || (c.courseCode || c.code) === courseCode;
    })
  );
  if (subjectDays.length === 0) return 0;

  const subjectDaysShort = subjectDays.map(normalizeDay);
  const dayOrderMap: Record<string, string> = {
    monday: 'MON',
    tuesday: 'TUE',
    wednesday: 'WED',
    thursday: 'THU',
    friday: 'FRI',
  };

  const ymd = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
  };

  const effectiveMap = new Map<string, string>();
  for (const d of allWorkingDays) {
    if (!d?.date) continue;
    let effectiveDay = normalizeDay(d.weekday || '');
    if (effectiveDay === 'SAT' && Array.isArray(d.events) && d.events.length > 0) {
      const found = d.events.find((ev: any) =>
        /(monday|tuesday|wednesday|thursday|friday)/i.test(
          ev.text || ev.category || ''
        )
      );
      if (found) {
        const match = (found.text || found.category || '').match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday)/i
        );
        if (match && match[1]) {
          const mapped = dayOrderMap[match[1].toLowerCase()];
          if (mapped) effectiveDay = mapped;
        }
      }
    }
    effectiveMap.set(ymd(d.date), effectiveDay);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let missed = 0;

  for (const timestamp of Object.keys(dateStates)) {
    const s = new Date(parseInt(timestamp, 10));
    s.setHours(0, 0, 0, 0);
    if (s < today) continue; // Past days cannot be counted as future absences
    const key = ymd(s);
    const eff = effectiveMap.get(key);
    if (!eff) continue;
    if (cutoffDate && s > cutoffDate) continue;

    // Exam days have no regular classes to miss
    const dayObj = allWorkingDays.find((d) => ymd(d.date) === key);
    if (dayObj?.isExam) continue;

    const time = s.getTime();

    const effectiveState =
      dateStates[time] !== undefined
        ? dateStates[time]
        : attendanceLockDates?.has(time)
        ? 2
        : 0;

    if (effectiveState === 1 && subjectDaysShort.includes(eff)) {
      missed++;
    }
  }
  return missed;
}

