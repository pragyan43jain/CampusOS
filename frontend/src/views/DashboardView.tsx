import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Clock,
  RefreshCw,
  Download,
  Calendar,
  ArrowRight,
  Calculator,
  ChevronRight,
  Award,
  Users,
  MapPin,
  BarChart2,
  CheckCircle2,
  RotateCcw,
  Bell,
  FlaskConical,
} from 'lucide-react';
import {
  StudentProfile,
  TimetableSlot,
  DayOfWeek,
  Course,
  Attendance,
  Marks,
  Exam,
  Assignment,
  FeeItem,
  PlacementDrive,
  DSACategory,
  AIStudyTask,
  ODResponse,
} from '../types';
import { NavView } from '../components/Sidebar';
import { AcademicsSubTab } from './AcademicsView';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  courses?: Course[];
  attendance?: Attendance[];
  marks?: Marks[];
  exams?: Exam[];
  assignments?: Assignment[];
  fees?: FeeItem[];
  placements?: PlacementDrive[];
  dsaTopics?: DSACategory[];
  aiTasks?: AIStudyTask[];
  odData?: ODResponse | null;
  onOpenODModal?: () => void;
  onSync?: () => void;
  syncing?: boolean;
  onOpenSyncModal?: () => void;
  teamsAccount?: any;
  lmsAccount?: any;
  onLinkTeams?: () => void;
  onLinkLMS?: () => void;
  onSyncAll?: () => void;
  syncingAll?: boolean;
  syncResultMsg?: string | null;
  onSelectView?: (view: NavView) => void;
  onSelectAcademicsSubTab?: (subTab: AcademicsSubTab) => void;
  onToggleAssignment?: (id: string, currentStatus: 'Pending' | 'Submitted' | string) => void | Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable = [],
  courses = [],
  attendance = [],
  marks = [],
  exams = [],
  assignments: _assignments = [],
  fees: _fees = [],
  placements: _placements = [],
  dsaTopics: _dsaTopics = [],
  aiTasks: _aiTasks = [],
  odData,
  onOpenODModal,
  onSync,
  syncing = false,
  onOpenSyncModal,
  teamsAccount: _teamsAccount,
  lmsAccount: _lmsAccount,
  onLinkTeams: _onLinkTeams,
  onLinkLMS: _onLinkLMS,
  onSyncAll: _onSyncAll,
  syncingAll: _syncingAll = false,
  onSelectView,
  onSelectAcademicsSubTab,
  onToggleAssignment: _onToggleAssignment,
}) => {
  // Navigation helper
  const navigateToAcademics = (subTab: AcademicsSubTab) => {
    onSelectView?.('academics');
    onSelectAcademicsSubTab?.(subTab);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/academics/${subTab}`);
    }
  };

  // Day Selector for Timetable
  const getTodayDayOfWeek = (): DayOfWeek => {
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
    return map[dayIndex] || 'THU';
  };

  // Guaranteed safe array normalizations to prevent non-iterable or null exceptions
  const safeTimetable = useMemo(() => (Array.isArray(timetable) ? timetable : []), [timetable]);
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const safeAttendance = useMemo(() => (Array.isArray(attendance) ? attendance : []), [attendance]);
  const safeMarks = useMemo(() => (Array.isArray(marks) ? marks : []), [marks]);
  const safeExams: Exam[] = useMemo(() => {
    if (Array.isArray(exams)) return exams;
    if (exams && typeof exams === 'object') {
      try {
        return (Object.values(exams).flat() as Exam[]).filter(Boolean);
      } catch {
        return [];
      }
    }
    return [];
  }, [exams]);

  // Safe numerical formatter helper
  const formatFixed = (val: any, digits: number = 1, fallback: string = '--'): string => {
    if (val === null || val === undefined) return fallback;
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num)) return fallback;
    return num.toFixed(digits);
  };

  const todayDay = useMemo(() => getTodayDayOfWeek(), []);

  // Compute available days from timetable
  const availableDays = useMemo(() => {
    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    if (safeTimetable.some((s) => s?.day === 'SAT')) days.push('SAT');
    if (safeTimetable.some((s) => s?.day === 'SUN')) days.push('SUN');
    return days;
  }, [safeTimetable]);

  const defaultDay = useMemo(() => {
    const today = getTodayDayOfWeek();
    if (safeTimetable.some((s) => s?.day === today)) return today;
    const daySequence: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const todayIdx = daySequence.indexOf(today);
    for (let offset = 1; offset < 7; offset++) {
      const nextDay = daySequence[(todayIdx + offset) % 7];
      if (safeTimetable.some((s) => s?.day === nextDay)) return nextDay;
    }
    return 'MON';
  }, [safeTimetable]);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(defaultDay);
  const [simulatedOffset, setSimulatedOffset] = useState<number>(0);
  const [deltaLeaves, setDeltaLeaves] = useState<number>(0);
  const [deltaOD, setDeltaOD] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Real-time 30-second clock tick to sync active and upcoming classes dynamically
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Keep selectedDay aligned if timetable loads asynchronously
  useEffect(() => {
    if (safeTimetable.length > 0 && !safeTimetable.some((s) => s?.day === selectedDay)) {
      setSelectedDay(defaultDay);
    }
  }, [safeTimetable, defaultDay, selectedDay]);

  // Robust helper to parse time strings ("HH:MM", "14:00", "02:00 PM") to minutes from midnight
  const parseTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const clean = timeStr.trim();
    const isPM = /pm/i.test(clean);
    const isAM = /am/i.test(clean);
    const numPart = clean.replace(/[^\d:]/g, '');
    const parts = numPart.split(':');
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (!isPM && !isAM && h >= 1 && h <= 7) h += 12; // 24-hr inference if 1..7 (e.g. 2:00 = 14:00)
    return h * 60 + m;
  };

  // Timetable slots for selected day, sorted chronologically
  const filteredSlots = useMemo(() => {
    const slots = safeTimetable.filter((s) => s && s.day === selectedDay);
    return [...slots].sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));
  }, [safeTimetable, selectedDay]);

  // Determine active or upcoming class synced with current time
  const { activeNextClass, nextClassStatus, nextClassDayLabel } = useMemo(() => {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    // 1. Look for ongoing or upcoming class today
    const todaySlots = safeTimetable
      .filter((s) => s && s.day === todayDay)
      .sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));

    for (const slot of todaySlots) {
      const startMin = parseTimeToMinutes(slot.startTime);
      const endMin = parseTimeToMinutes(slot.endTime);

      // Ongoing live class right now
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        return {
          activeNextClass: slot,
          nextClassStatus: 'live' as const,
          nextClassDayLabel: 'Live Now',
        };
      }

      // Next upcoming class today
      if (currentMinutes < startMin) {
        return {
          activeNextClass: slot,
          nextClassStatus: 'upcoming' as const,
          nextClassDayLabel: 'Today',
        };
      }
    }

    // 2. All classes today are finished (or today has no classes): search upcoming days of the week
    const daySequence: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const todayIdx = daySequence.indexOf(todayDay);

    for (let offset = 1; offset < 7; offset++) {
      const nextDay = daySequence[(todayIdx + offset) % 7];
      const nextDaySlots = safeTimetable
        .filter((s) => s && s.day === nextDay)
        .sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));

      if (nextDaySlots.length > 0) {
        const dayNames: Record<string, string> = {
          MON: 'Monday',
          TUE: 'Tuesday',
          WED: 'Wednesday',
          THU: 'Thursday',
          FRI: 'Friday',
          SAT: 'Saturday',
          SUN: 'Sunday',
        };
        const label = offset === 1 ? 'Tomorrow' : (dayNames[nextDay] || nextDay);
        return {
          activeNextClass: nextDaySlots[0],
          nextClassStatus: 'next_day' as const,
          nextClassDayLabel: label,
        };
      }
    }

    return {
      activeNextClass: filteredSlots.length > 0 ? filteredSlots[0] : null,
      nextClassStatus: 'fallback' as const,
      nextClassDayLabel: 'Scheduled',
    };
  }, [safeTimetable, todayDay, filteredSlots, currentTime]);

  const nextClass = activeNextClass;

  // Today's total classes and current class position for the hero cockpit card
  const todaySlots = useMemo(() => {
    return safeTimetable
      .filter((s) => s && s.day === todayDay)
      .sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));
  }, [safeTimetable, todayDay]);

  const currentSlotIndex = useMemo(() => {
    if (!nextClass) return 1;
    const idx = todaySlots.findIndex(
      (s) =>
        (s.courseCode || s.subjectCode) === (nextClass.courseCode || nextClass.subjectCode) &&
        s.startTime === nextClass.startTime
    );
    return idx >= 0 ? idx + 1 : 1;
  }, [todaySlots, nextClass]);

  const nextClassTiming = useMemo(() => {
    if (!nextClass) {
      return { label: 'No class scheduled', progressPct: 0 };
    }
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const startMin = parseTimeToMinutes(nextClass.startTime);
    const endMin = parseTimeToMinutes(nextClass.endTime);

    if (nextClassStatus === 'live') {
      const elapsed = Math.max(0, currentMinutes - startMin);
      const duration = Math.max(1, endMin - startMin);
      const pct = Math.min(100, Math.max(10, Math.round((elapsed / duration) * 100)));
      const remaining = Math.max(1, endMin - currentMinutes);
      return {
        label: `Class in session • ${remaining}m remaining`,
        progressPct: pct,
      };
    }

    if (nextClassStatus === 'upcoming') {
      const diff = Math.max(0, startMin - currentMinutes);
      return {
        label: diff <= 60 ? `Class starts in ${diff} min${diff === 1 ? '' : 's'}` : `Starts at ${nextClass.startTime}`,
        progressPct: 65,
      };
    }

    if (nextClassStatus === 'next_day') {
      return {
        label: `Starts ${nextClassDayLabel} at ${nextClass.startTime || 'TBA'}`,
        progressPct: 40,
      };
    }

    return {
      label: `Scheduled at ${nextClass.startTime || 'TBA'}`,
      progressPct: 50,
    };
  }, [nextClass, nextClassStatus, nextClassDayLabel, currentTime]);

  // Dynamic slot attendance resolver with zero hallucination and strict course mapping
  const getSlotAttendance = (slot: TimetableSlot) => {
    if (!safeAttendance || safeAttendance.length === 0) return null;
    const sCode = (slot.courseCode || slot.subjectCode || '').trim().toUpperCase();
    const sSlot = (slot.slot || slot.slotName || '').trim();
    const sTitle = (slot.courseTitle || slot.courseName || slot.subject || '').trim().toLowerCase();

    let match = safeAttendance.find((a) => {
      const aCode = (a.courseCode || (a as any).code || '').trim().toUpperCase();
      return aCode && sCode && aCode === sCode;
    });

    if (!match && sSlot) {
      match = safeAttendance.find((a) => {
        const aSlot = (a.slot || (a as any).slotName || '').trim();
        const aSlots = (a.slots || '').trim();
        return (aSlot && aSlot === sSlot) || (aSlots && aSlots.includes(sSlot));
      });
    }

    if (!match && sTitle) {
      match = safeAttendance.find((a) => {
        const aTitle = (a.courseTitle || a.courseName || (a as any).title || '').trim().toLowerCase();
        return aTitle && aTitle === sTitle;
      });
    }

    if (!match) return null;

    const attended = Number(match.attended ?? match.classesAttended ?? 0) || 0;
    const total = Number(match.total ?? match.conducted ?? match.classesConducted ?? 0) || 0;
    const rawPct = match.percentage ?? match.attendancePercentage;
    const pct = rawPct !== null && rawPct !== undefined && !isNaN(Number(rawPct))
      ? Number(rawPct)
      : (total > 0 ? Math.round((attended / total) * 1000) / 10 : 0);
    const safeMiss = match.safeToMiss ?? (pct >= 75 ? Math.max(0, Math.floor((attended - 0.75 * total) / 0.75)) : 0);
    const needAttend = match.needToAttend ?? (pct < 75 ? Math.ceil((0.75 * total - attended) / 0.25) : 0);

    return {
      ...match,
      attended,
      total,
      percentage: pct,
      safeToMiss: safeMiss,
      needToAttend: needAttend,
      isCritical: pct < 75,
    };
  };

  const nextClassAtt = nextClass ? getSlotAttendance(nextClass) : null;

  // Evaluated continuous assessment marks from authentic VTOP ledger
  const evaluatedMarks = useMemo(() => {
    if (!safeMarks || safeMarks.length === 0) return [];
    const list: Array<{
      courseCode: string;
      courseTitle: string;
      compTitle: string;
      scored: number;
      max: number;
      weightage?: number;
      maxWeightage?: number;
      average?: number | null;
      status?: string;
    }> = [];

    for (const m of safeMarks) {
      if (!m) continue;
      if (Array.isArray(m.components) && m.components.length > 0) {
        for (const c of m.components) {
          if (!c) continue;
          if (c.scored !== null && c.scored !== undefined && !isNaN(Number(c.scored))) {
            list.push({
              courseCode: m.courseCode || '',
              courseTitle: m.courseTitle || m.courseName || '',
              compTitle: c.title || 'Component',
              scored: Number(c.scored),
              max: c.max !== null && c.max !== undefined && !isNaN(Number(c.max)) ? Number(c.max) : 100,
              weightage: c.weightage !== null && c.weightage !== undefined && !isNaN(Number(c.weightage)) ? Number(c.weightage) : undefined,
              maxWeightage: c.maxWeightage !== null && c.maxWeightage !== undefined && !isNaN(Number(c.maxWeightage)) ? Number(c.maxWeightage) : 15,
              average: c.average !== null && c.average !== undefined && !isNaN(Number(c.average)) ? Number(c.average) : null,
              status: c.status || 'Recorded',
            });
          }
        }
      } else if (m.cat1 && m.cat1.scored !== null && m.cat1.scored !== undefined && !isNaN(Number(m.cat1.scored))) {
        list.push({
          courseCode: m.courseCode || '',
          courseTitle: m.courseTitle || m.courseName || '',
          compTitle: 'CAT-1',
          scored: Number(m.cat1.scored),
          max: m.cat1.max !== null && m.cat1.max !== undefined && !isNaN(Number(m.cat1.max)) ? Number(m.cat1.max) : 50,
          weightage: m.cat1.weightage !== null && m.cat1.weightage !== undefined && !isNaN(Number(m.cat1.weightage)) ? Number(m.cat1.weightage) : undefined,
          maxWeightage: 15,
          average: null,
          status: 'Recorded',
        });
      }
    }
    return list.slice(0, 2);
  }, [safeMarks]);

  // Courses most at risk or closest to 75% cutoff
  const watchCourses = useMemo(() => {
    if (!safeAttendance || safeAttendance.length === 0) return [];
    return [...safeAttendance]
      .filter((a) => a && (a.total ?? a.classesConducted ?? 0) > 0)
      .sort((a, b) => {
        const pA = Number(a?.percentage ?? a?.attendancePercentage ?? 100) || 100;
        const pB = Number(b?.percentage ?? b?.attendancePercentage ?? 100) || 100;
        return pA - pB;
      })
      .slice(0, 2);
  }, [safeAttendance]);

  // Next upcoming examination from authentic exam schedule
  const nextExam = useMemo(() => {
    if (!safeExams || safeExams.length === 0) return null;
    const now = Date.now();
    const sorted = [...safeExams].sort((a, b) => {
      const tA = a?.date ? new Date(a.date).getTime() || 0 : 0;
      const tB = b?.date ? new Date(b.date).getTime() || 0 : 0;
      return tA - tB;
    });
    return sorted.find((e) => (new Date(e?.date || '').getTime() || 0) >= now - 86400000) || sorted[0];
  }, [safeExams]);

  // Calculate overall attendance
  const overallAtt = student?.overallAttendance;
  const overallPct = overallAtt?.percentage !== null && overallAtt?.percentage !== undefined && !isNaN(Number(overallAtt.percentage))
    ? Number(overallAtt.percentage)
    : (safeAttendance.length > 0
        ? Math.round(
            (safeAttendance.reduce((acc, c) => acc + (Number(c?.attended ?? c?.classesAttended ?? 0) || 0), 0) /
              Math.max(1, safeAttendance.reduce((acc, c) => acc + (Number(c?.total ?? c?.classesConducted ?? 0) || 0), 0))) * 1000
          ) / 10
        : 0);

  const attBufferMargin = Math.round((overallPct - 75.0) * 10) / 10;

  // Stitch Absence Simulator projected attendance telemetry
  const projectedAttendance = useMemo(() => {
    const netPct = Math.round((overallPct - deltaLeaves * 1.1 + deltaOD * 0.8) * 10) / 10;
    const clamped = Math.max(0, Math.min(100, netPct));
    const headroom = Math.round((clamped - 75.0) * 10) / 10;
    const isSafe = clamped >= 75.0;
    return {
      percentage: clamped,
      headroom,
      isSafe,
      statusLabel: isSafe ? `Safe (+${headroom}% Headroom)` : `Defaulter Risk (${Math.abs(headroom)}% Below)`,
    };
  }, [overallPct, deltaLeaves, deltaOD]);
  const criticalCount = safeAttendance.filter((a) => {
    if (!a) return false;
    let p = a.percentage !== undefined && a.percentage !== null ? a.percentage : a.attendancePercentage;
    if ((p === undefined || p === null) && (a.total || a.classesConducted || 0) > 0) {
      p = Math.round(((Number(a.attended ?? a.classesAttended ?? 0) || 0) / (Number(a.total ?? a.classesConducted ?? 1) || 1)) * 1000) / 10;
    }
    return p !== undefined && p !== null && !isNaN(Number(p)) && Number(p) < 75;
  }).length;

  // CGPA calculation
  const cgpaDisplay = student?.cgpa !== null && student?.cgpa !== undefined && !isNaN(Number(student.cgpa))
    ? Number(student.cgpa).toFixed(2)
    : '--';

  const earnedCredits = student?.creditsEarned ?? (safeCourses.length > 0 ? safeCourses.reduce((a, c) => a + (Number(c?.credits) || 0), 0) : '--');
  const registeredCredits = student?.registeredCredits ?? (safeCourses.length > 0 ? safeCourses.reduce((a, c) => a + (Number(c?.credits) || 0), 0) : '--');
  const currentSemester = student?.semester ? `Fall Semester 2026-27 • Sem ${student.semester}` : 'Fall Semester 2026-27';

  // OD metrics
  const approvedOdHours =
    odData?.approvedHours ??
    odData?.usedHours ??
    (student as any)?.odHours ??
    (student as any)?.approvedOdHours ??
    0;
  const maxOdHours = odData?.maxHours ?? odData?.maxOdHours ?? 40;
  const remainingOdHours = Math.max(0, maxOdHours - approvedOdHours);

  // Greeting logic
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatTitleCase = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (!clean) return '';
    const first = clean.split(' ')[0];
    if (/\d/.test(first)) return first.toUpperCase();
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const studentDisplayName = formatTitleCase(student?.name || 'Pragyan');

  const formatLastSynced = (): string => {
    if (!student?.lastSynced) return 'Synced • Active Session';
    const parsed = new Date(student.lastSynced);
    if (isNaN(parsed.getTime())) return 'Synced • Active Session';
    const now = Date.now();
    const diffSec = Math.floor((now - parsed.getTime()) / 1000);
    if (diffSec < 60) return 'Synced just now • Active Session';
    if (diffSec < 3600) return `Synced ${Math.floor(diffSec / 60)}m ago • Active Session`;
    if (diffSec < 86400) return `Synced ${Math.floor(diffSec / 3600)}h ago • Active Session`;
    return `Synced ${parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })} • Active Session`;
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* =========================================================================
          MOBILE EDITORIAL HERO (MATCHING USER REFERENCE DESIGN)
          ========================================================================= */}
      <div className="md:hidden flex flex-col gap-4">
        {/* Clean Greeting */}
        <div className="flex flex-col gap-0.5 pt-1">
          <span className="text-sm font-medium text-on-surface-variant">Good Morning,</span>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface uppercase font-heading">
            {studentDisplayName}
          </h1>
        </div>

        {/* Sync Data Pill Button */}
        <button
          onClick={onSync || onOpenSyncModal}
          disabled={syncing}
          className="w-full py-3 px-4 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest active:scale-[0.99] transition-all flex items-center justify-center gap-2 font-semibold text-sm text-on-surface shadow-sm border border-outline-variant/15"
        >
          <RefreshCw size={15} className={`text-on-surface-variant ${syncing ? 'animate-spin text-primary' : ''}`} />
          <span>{syncing ? 'Syncing Records...' : 'Sync Data'}</span>
        </button>

        {/* TWO SQUARE BOXES (HERO METRICS AS REQUESTED) */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Square Box 1: Attendance */}
          <div
            onClick={() => navigateToAcademics('attendance')}
            className="aspect-square p-4 rounded-2xl bg-surface-container-high border border-outline-variant/15 flex flex-col items-center justify-center text-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer group"
          >
            {/* Circular Ring Gauge */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-surface-container-highest"
                  fill="none"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 * (1 - Math.min(100, Math.max(0, Number(overallPct) || 0)) / 100)}
                  strokeLinecap="round"
                  className={Number(overallPct) >= 75 ? 'text-primary' : 'text-error'}
                  fill="none"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold font-tabular-data text-on-surface tracking-tight leading-none mt-1">
              {overallPct}%
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              Attendance
            </span>
          </div>

          {/* Square Box 2: OD Classes */}
          <div
            onClick={onOpenODModal}
            className="aspect-square p-4 rounded-2xl bg-surface-container-high border border-outline-variant/15 flex flex-col items-center justify-center text-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface">
              <Bell size={28} className="text-on-surface-variant group-hover:text-primary transition-colors" />
            </div>
            <span className="text-2xl font-bold font-tabular-data text-on-surface tracking-tight leading-none mt-1">
              {approvedOdHours}/{maxOdHours}
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              OD Classes
            </span>
          </div>
        </div>

        {/* Academic Calendar Link Card */}
        <div
          onClick={() => onSelectAcademicsSubTab?.('calendar')}
          className="w-full p-4 rounded-2xl bg-surface-container-high border border-outline-variant/15 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all shadow-sm"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-surface-container-highest/60 flex items-center justify-center text-on-surface">
              <Calendar size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-on-surface">Academic Calendar</h4>
              <p className="text-xs text-on-surface-variant">View schedule &amp; working days</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-on-surface-variant" />
        </div>

        {/* Secondary Row: GPA & Registered Courses (Pill Cards) */}
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => navigateToAcademics('grades')}
            className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/15 flex items-center gap-3 cursor-pointer active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <GraduationCap size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-on-surface block leading-tight font-tabular-data">{cgpaDisplay}</span>
              <span className="text-[11px] text-on-surface-variant font-medium truncate block">GPA · {earnedCredits} Cr</span>
            </div>
          </div>

          <div
            onClick={() => navigateToAcademics('courses')}
            className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/15 flex items-center gap-3 cursor-pointer active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-on-surface block leading-tight font-tabular-data">{safeCourses.length}</span>
              <span className="text-[11px] text-on-surface-variant font-medium truncate block">Courses · {registeredCredits} CH</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DESKTOP EDITORIAL GREETING & KPI CARDS (>= md)
          ========================================================================= */}
      <div className="hidden md:flex flex-col gap-6">
        <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-secondary font-semibold bg-secondary-fixed/40 px-2 py-0.5 rounded">
                {currentSemester}
              </span>
              <span className="text-outline-variant text-[11px]">•</span>
              <span className="font-label-sm text-[11px] text-outline font-semibold">
                {student?.branch || 'Undergraduate Engineering'}
              </span>
              <span className="text-outline-variant text-[11px]">•</span>
              <span className="font-label-sm text-[11px] text-on-surface-variant font-tabular-data">
                Slot Set 1
              </span>
            </div>
            <h1 className="font-display-lg text-2xl md:text-3xl text-on-background tracking-tight font-semibold">
              {getGreeting()}, {studentDisplayName}
            </h1>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
              Academic records &amp; continuous assessment matrix synchronized directly with VTOP.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
            <div className="flex flex-col items-start md:items-end">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="font-label-md text-xs font-semibold text-on-surface">VTOP Live Sync</span>
              </div>
              <span className="font-label-sm text-[11px] text-outline font-tabular-data">
                {formatLastSynced()}
              </span>
            </div>
            <button
              onClick={onSync || onOpenSyncModal}
              disabled={syncing}
              className="bg-primary text-on-primary px-3.5 py-2 rounded-lg font-label-md text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity disabled:opacity-70 active:scale-95"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Records'}</span>
            </button>
          </div>
        </section>

        {/* Academic KPI Cards (4-col on Desktop) */}
        <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {/* Metric 1: CGPA */}
          <div
            onClick={() => navigateToAcademics('grades')}
            className="bg-surface-container-high p-3.5 md:p-5 rounded-xl shadow-md border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Cumulative GPA
              </span>
              <GraduationCap size={18} className="text-primary" />
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-metric-display text-2xl md:text-3xl font-bold text-on-surface font-tabular-data">
                  {cgpaDisplay}
                </span>
                <span className="font-label-md text-xs text-outline font-medium font-tabular-data">
                  / 10.00
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-label-sm text-[11px]">
                <span className="text-secondary font-semibold font-tabular-data">+0.14 trend</span>
                <span className="text-on-surface-variant font-tabular-data">{earnedCredits} Cr</span>
              </div>
            </div>
          </div>

          {/* Metric 2: Aggregate Attendance */}
          <div
            onClick={() => navigateToAcademics('attendance')}
            className="bg-surface-container-high p-3.5 md:p-5 rounded-xl shadow-md border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Aggregate Attend.
              </span>
              <ShieldCheck size={18} className="text-secondary" />
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-metric-display text-2xl md:text-3xl font-bold text-secondary font-tabular-data">
                  {overallPct}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-label-sm text-[11px]">
                <span className={`font-semibold font-tabular-data ${attBufferMargin >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {attBufferMargin >= 0 ? `+${attBufferMargin}% Buffer` : `${attBufferMargin}% Below`}
                </span>
                <span className="text-outline font-tabular-data">
                  {criticalCount > 0 ? `${criticalCount} Critical` : 'Req: 75%'}
                </span>
              </div>
            </div>
          </div>

          {/* Metric 3: Curricular Load */}
          <div
            onClick={() => navigateToAcademics('courses')}
            className="bg-surface-container-high p-3.5 md:p-5 rounded-xl shadow-md border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Curricular Load
              </span>
              <BookOpen size={18} className="text-tertiary" />
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-metric-display text-2xl md:text-3xl font-bold text-on-surface font-tabular-data">
                  {safeCourses.length}
                </span>
                <span className="font-label-md text-xs text-on-surface-variant">Courses</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
                <span className="font-tabular-data">{registeredCredits} CH</span>
                <span className="text-outline">Max: 27.0</span>
              </div>
            </div>
          </div>

          {/* Metric 4: On-Duty Buffer */}
          <div
            onClick={onOpenODModal}
            className="bg-surface-container-high p-3.5 md:p-5 rounded-xl shadow-md border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                On-Duty Buffer
              </span>
              <Clock size={18} className={approvedOdHours > maxOdHours ? 'text-error' : 'text-secondary'} />
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-metric-display text-2xl md:text-3xl font-bold font-tabular-data ${approvedOdHours > maxOdHours ? 'text-error' : 'text-on-surface'}`}>
                  {approvedOdHours}
                </span>
                <span className="font-label-md text-xs text-outline font-medium font-tabular-data">
                  / {maxOdHours}h
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
                <span className={`font-semibold font-tabular-data ${approvedOdHours > maxOdHours ? 'text-error' : 'text-secondary'}`}>
                  {maxOdHours > 0 ? Math.round((approvedOdHours / maxOdHours) * 100) : 0}% Consumed
                </span>
                <span className="text-outline">
                  {approvedOdHours > maxOdHours ? 'Exceeded' : `${remainingOdHours}h left`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Action Shortcuts Bar */}
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onSelectView?.('assignments')}
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all active:scale-95 min-h-[56px] shadow-sm border border-outline-variant/20 group"
          >
            <BarChart2 size={18} className="text-primary group-hover:scale-110 transition-transform sm:w-5 sm:h-5" />
            <span className="text-[11px] sm:text-xs font-semibold mt-1 text-center truncate w-full">Assignments</span>
            <span className="text-[9px] text-outline hidden sm:block">LMS &amp; Teams</span>
          </button>
          <button
            type="button"
            onClick={() => (onSync ? onSync() : onOpenSyncModal?.())}
            disabled={syncing}
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all active:scale-95 min-h-[56px] shadow-sm border border-outline-variant/20 group"
          >
            <RefreshCw size={18} className={`text-secondary group-hover:scale-110 transition-transform sm:w-5 sm:h-5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] sm:text-xs font-semibold mt-1 text-center truncate w-full">Sync VTOP</span>
            <span className="text-[9px] text-outline hidden sm:block">Live Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToAcademics('attendance')}
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all active:scale-95 min-h-[56px] shadow-sm border border-outline-variant/20 group"
          >
            <ShieldCheck size={18} className="text-tertiary group-hover:scale-110 transition-transform sm:w-5 sm:h-5" />
            <span className="text-[11px] sm:text-xs font-semibold mt-1 text-center truncate w-full">Attendance</span>
            <span className="text-[9px] text-outline hidden sm:block">75% Calculator</span>
          </button>
        </section>
      </div>

      {/* =========================================================================
          3. TWO-COLUMN WORKSPACE: LEFT CORE (8 COLS) + RIGHT SATELLITE (4 COLS)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. ACADEMIC TIMELINE & LIVE CLASS ROSTER */}
          <section className="bg-surface-container-lowest rounded-xl p-3 sm:p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2 border-b border-outline-variant/20 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar size={20} className="text-primary" />
                <h2 className="font-headline-md text-lg font-semibold text-on-surface">
                  Today's Academic Timeline
                </h2>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar flex-nowrap py-1">
                {availableDays.map((d) => {
                  const isDayActive = selectedDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={`transition-all shrink-0 ${
                        isDayActive
                          ? 'px-5 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold shadow-sm text-xs'
                          : 'px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Up: Highlighted Active Class Banner (Stitch Hero Cockpit) */}
            {nextClass ? (
              <div className="relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/30 p-4 md:p-5 shadow-xl flex flex-col gap-3">
                <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between flex-wrap gap-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold font-tabular-data uppercase tracking-wide">
                      {nextClassStatus === 'live'
                        ? `Live Now • Slot ${nextClass.slot || 'Active Session'}`
                        : nextClassStatus === 'next_day'
                        ? `Next Up (${nextClassDayLabel}) • Slot ${nextClass.slot || 'Upcoming'}`
                        : `Next Up • Slot ${nextClass.slot || 'Active'}`}
                    </span>
                    <span className="text-xs text-on-surface-variant font-tabular-data">
                      {nextClass.startTime || '14:00'} - {nextClass.endTime || '14:50'}
                    </span>
                  </div>
                  {nextClassAtt && nextClassAtt.total > 0 ? (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      nextClassAtt.isCritical
                        ? 'bg-error text-white'
                        : 'bg-secondary-container/20 text-secondary'
                    }`}>
                      <ShieldCheck size={14} />
                      <span>
                        {nextClassAtt.isCritical
                          ? `Need +${nextClassAtt.needToAttend} Classes`
                          : nextClassAtt.safeToMiss > 0
                          ? `Safe Buffer: +${nextClassAtt.safeToMiss}`
                          : 'Borderline (0 Safe)'}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container/20 text-secondary text-[11px] font-semibold">
                      <ShieldCheck size={14} />
                      <span>Safe Buffer: Cutoff 75%</span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-0.5">
                  <span className="font-tabular-data text-xs text-primary font-bold tracking-wider">
                    {nextClass.courseCode || nextClass.subjectCode || 'Active Course'}
                  </span>
                  <h3 className="font-headline-md text-xl md:text-2xl font-semibold text-on-surface mt-0.5 min-w-0 break-words [overflow-wrap:anywhere]">
                    {nextClass.courseTitle || nextClass.subject || nextClass.courseName || 'Lecture'}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant text-xs">
                    <span className="flex items-center gap-1 text-on-surface">
                      <Users size={14} className="text-primary" />
                      {nextClass.faculty || nextClass.facultyName || 'Course Faculty'}
                    </span>
                    <span className="flex items-center gap-1 text-on-surface">
                      <MapPin size={14} className="text-primary" />
                      Room {nextClass.room || nextClass.venue || 'Campus Venue'}
                    </span>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="relative z-10 mt-1 bg-surface-container-lowest rounded-full h-1.5 w-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500"
                    style={{ width: `${nextClassTiming.progressPct}%` }}
                  />
                </div>
                <div className="relative z-10 flex justify-between text-[11px] text-on-surface-variant font-tabular-data">
                  <span>{nextClassTiming.label}</span>
                  <span>Slot {currentSlotIndex} of {Math.max(1, todaySlots.length)} today</span>
                </div>

                {/* Actions */}
                <div className="relative z-10 mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToAcademics('courses')}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border border-outline-variant/20 shadow-sm"
                  >
                    <Download size={15} className="text-primary" />
                    <span>Syllabus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToAcademics('attendance')}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                  >
                    <ShieldCheck size={15} />
                    <span>Quick Check-in</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Daily Stream Chrono Cards */}
            {filteredSlots.length === 0 ? (
              <div className="bg-surface-container-low p-6 rounded-2xl text-center border border-outline-variant/10">
                <Calendar size={28} className="mx-auto text-outline-variant mb-2" />
                <p className="font-headline-sm text-sm font-semibold text-on-surface">No Classes Scheduled</p>
                <p className="font-body-sm text-xs text-outline mt-0.5">
                  No academic lecture or lab slots registered for {selectedDay}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredSlots.map((slot, idx) => {
                  const slotAtt = getSlotAttendance(slot);
                  const isToday = selectedDay === todayDay;
                  const startMin = parseTimeToMinutes(slot.startTime);
                  const endMin = parseTimeToMinutes(slot.endTime);
                  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                  const isSlotLive = isToday && currentMinutes >= startMin && currentMinutes < endMin;
                  const isSlotCompleted = isToday && currentMinutes >= endMin;
                  const isSlotUpcoming = isToday && currentMinutes < startMin;

                  return (
                    <React.Fragment key={slot.id || `${slot.courseCode}-${slot.slot}-${idx}`}>
                      {/* Mobile Class Card (< md) */}
                      <div
                        onClick={() => navigateToAcademics('courses')}
                        className={`md:hidden p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm active:scale-[0.99] ${
                          isSlotLive
                            ? 'bg-primary-container/20 border-primary/50'
                            : 'bg-surface-container-high border-outline-variant/15'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            slot.slot?.startsWith('L') || (slot.courseCode || '').endsWith('P')
                              ? 'bg-primary/20 text-primary'
                              : 'bg-secondary/20 text-secondary'
                          }`}>
                            {slot.slot?.startsWith('L') || (slot.courseCode || '').endsWith('P') ? (
                              <FlaskConical size={22} />
                            ) : (
                              <BookOpen size={22} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-sm text-on-surface line-clamp-2 break-words [overflow-wrap:anywhere]">
                              {slot.courseTitle || slot.subject || slot.courseName || 'Lecture'}
                            </h4>
                            <p className="text-xs text-on-surface-variant mt-0.5 truncate font-tabular-data">
                              {slot.startTime || 'TBA'} - {slot.endTime || 'TBA'} {slot.room || slot.venue ? `· ${slot.room || slot.venue}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {slotAtt && slotAtt.total > 0 && (
                            <span className={`text-xs font-bold font-tabular-data px-2 py-0.5 rounded-full ${
                              slotAtt.isCritical
                                ? 'bg-error-container text-error'
                                : 'bg-secondary-fixed/40 text-on-secondary-fixed'
                            }`}>
                              {formatFixed(slotAtt.percentage, 0)}%
                            </span>
                          )}
                          <ChevronRight size={18} className="text-on-surface-variant/70" />
                        </div>
                      </div>

                      {/* Desktop Slot Row (>= md) */}
                      <div
                        className={`hidden md:flex p-3.5 md:p-4 rounded-lg flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors border ${
                          isSlotLive
                            ? 'bg-primary-container/15 border-primary/50 ring-1 ring-primary/40'
                            : isSlotCompleted
                            ? 'bg-surface-container-low/70 border-outline-variant/10 opacity-75'
                            : 'bg-surface-container-low hover:bg-surface-container border border-outline-variant/10'
                        }`}
                      >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded shadow-sm shrink-0 border ${
                          isSlotLive
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-lowest border-outline-variant/20'
                        }`}>
                          <span className={`font-label-sm text-[10px] font-semibold uppercase ${
                            isSlotLive ? 'text-primary-fixed' : 'text-outline'
                          }`}>
                            {slot.slot?.startsWith('L') ? 'Lab' : 'Hour'}
                          </span>
                          <span className={`font-headline-sm text-xs md:text-sm font-tabular-data font-semibold ${
                            isSlotLive ? 'text-on-primary' : 'text-on-surface'
                          }`}>
                            {slot.startTime || 'TBA'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-label-sm text-xs font-semibold text-primary">
                              {slot.courseCode || slot.subjectCode || 'Course'}
                            </span>
                            <span className="text-outline-variant text-xs">•</span>
                            <span className="font-label-sm text-xs text-outline">
                              Slot {slot.slot || slot.slotName || 'TBA'}
                            </span>
                            {isSlotLive && (
                              <span className="bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                Live Now
                              </span>
                            )}
                            {isSlotCompleted && (
                              <span className="bg-surface-container text-outline text-[10px] font-medium px-1.5 py-0.5 rounded">
                                Ended
                              </span>
                            )}
                            {isSlotUpcoming && (
                              <span className="bg-secondary-fixed/50 text-secondary text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                Upcoming
                              </span>
                            )}
                          </div>
                          <h4 className="font-headline-sm text-sm font-semibold text-on-surface truncate" title={slot.courseTitle || slot.subject}>
                            {slot.courseTitle || slot.subject || slot.courseName || 'Lecture'}
                          </h4>
                          <div className="flex items-center gap-2.5 font-body-sm text-xs text-on-surface-variant mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {slot.room || slot.venue || 'Campus Venue'}
                            </span>
                            <span>{slot.faculty || slot.facultyName || 'Faculty'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        <div className="text-right">
                          {slotAtt && slotAtt.total > 0 ? (
                            <>
                              <span className={`font-tabular-data font-label-md text-xs px-2 py-0.5 rounded font-semibold ${
                                slotAtt.isCritical
                                  ? 'bg-error-container text-error'
                                  : 'text-secondary bg-secondary-fixed/50'
                              }`}>
                                {formatFixed(slotAtt.percentage, 1, '--')}%
                              </span>
                              <span className="block font-label-sm text-[10px] text-outline mt-0.5">
                                Attended: {slotAtt.attended}/{slotAtt.total}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-tabular-data font-label-md text-xs px-2 py-0.5 rounded font-semibold text-outline bg-surface-container">
                                --%
                              </span>
                              <span className="block font-label-sm text-[10px] text-outline mt-0.5">
                                No classes held
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => navigateToAcademics('attendance')}
                          className="bg-surface-container-lowest text-on-surface-variant hover:text-on-surface p-1.5 rounded shadow-sm"
                          title="Inspect Attendance"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              </div>
            )}
          </section>

          {/* Stitch Interactive Absence Risk Telemetry Card */}
          <section className="hidden md:flex rounded-xl bg-surface-container p-4 md:p-5 shadow-xl border border-outline-variant/30 flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-primary" />
                <h3 className="font-headline-sm text-base font-semibold text-on-surface">Absence Simulator</h3>
              </div>
              <span className="font-tabular-data text-[11px] text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded font-medium">
                Threshold: 75% Cutoff
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Simulate prospective leaves or OD clearances to monitor regulatory attendance impact in real-time.
            </p>
            {/* Interactive Steppers Row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeltaLeaves((prev) => (prev + 1) % 4)}
                className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 transition-all active:scale-95 border ${
                  deltaLeaves > 0
                    ? 'bg-error/20 text-error border-error/40 font-bold'
                    : 'bg-surface-container-high hover:bg-surface-bright text-error border-outline-variant/20'
                }`}
                id="btn-leave-sim"
              >
                <Clock size={14} />
                <span>{deltaLeaves > 0 ? `+${deltaLeaves} Leave (-${deltaLeaves * 4}h)` : '+1 Sick Leave (-4h)'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeltaOD((prev) => (prev + 1) % 4)}
                className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 transition-all active:scale-95 border ${
                  deltaOD > 0
                    ? 'bg-secondary/20 text-secondary border-secondary/40 font-bold'
                    : 'bg-surface-container-high hover:bg-surface-bright text-secondary border-outline-variant/20'
                }`}
                id="btn-od-sim"
              >
                <ShieldCheck size={14} />
                <span>{deltaOD > 0 ? `+${deltaOD * 3}d OD (+${deltaOD * 12}h)` : '+3 Days OD (+12h)'}</span>
              </button>
            </div>
            {/* Projected Telemetry Readout */}
            <div className="rounded-lg bg-surface-container-lowest p-3.5 flex items-center justify-between border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-outline">Projected Net Attendance</span>
                <span className={`text-xl font-bold font-tabular-data ${projectedAttendance.isSafe ? 'text-secondary' : 'text-error'}`}>
                  {projectedAttendance.percentage}%
                </span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${projectedAttendance.isSafe ? 'text-secondary' : 'text-error'}`}>
                {projectedAttendance.isSafe ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                <span>{projectedAttendance.statusLabel}</span>
              </div>
            </div>
            {(deltaLeaves > 0 || deltaOD > 0) && (
              <button
                type="button"
                onClick={() => {
                  setDeltaLeaves(0);
                  setDeltaOD(0);
                }}
                className="self-end text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <RotateCcw size={12} /> Reset to actuals
              </button>
            )}
          </section>

          {/* 2. CONTINUOUS ASSESSMENT & CURRICULAR MILESTONES */}
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2 border-b border-outline-variant/20">
              <div>
                <div className="flex items-center gap-2">
                  <Award size={20} className="text-secondary" />
                  <h2 className="font-headline-md text-lg font-semibold text-on-surface">
                    {nextExam ? `${nextExam.examType || 'Examination'} Milestone` : 'Curricular Progress Milestone'}
                  </h2>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  {nextExam
                    ? `${nextExam.courseCode || nextExam.subjectCode || 'Exam'}: ${nextExam.courseTitle || nextExam.subject || nextExam.title || 'Official Exam'} • Venue: ${nextExam.venue || 'Campus Examination Hall'}`
                    : 'Active semester continuous evaluation and curricular course schedules monitored in real time.'}
                </p>
              </div>
              {nextExam && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="bg-surface-container font-tabular-data font-label-sm text-xs px-2.5 py-1 rounded text-on-surface font-semibold">
                    {nextExam.date} {nextExam.time ? `• ${nextExam.time}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Curricular Courses Quick View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {safeCourses.slice(0, 3).map((course, idx) => {
                const attMatch = safeAttendance.find((a) => a?.courseCode === course?.code);
                const pct = attMatch?.percentage ?? attMatch?.attendancePercentage;
                const hasValidPct = pct !== undefined && pct !== null && !isNaN(Number(pct));
                return (
                  <div key={course.id || course.code || idx} className="bg-surface-container-low p-3.5 rounded-lg flex flex-col justify-between gap-3 border border-outline-variant/10">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-xs text-primary font-semibold">{course.code}</span>
                        <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">{course.type || 'Curricular'}</span>
                      </div>
                      <h5 className="font-headline-sm text-xs font-semibold text-on-surface mt-1 truncate" title={course.title}>
                        {course.title}
                      </h5>
                      <p className="font-body-sm text-[11px] text-on-surface-variant mt-1 leading-snug truncate">
                        {course.faculty ? `Faculty: ${course.faculty}` : `${course.credits || 0} Credits`}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-between font-label-sm text-xs border-t border-outline-variant/10">
                      <span className="text-secondary font-semibold font-tabular-data">
                        {hasValidPct ? `${formatFixed(pct, 1)}% Attended` : `${course.credits || 0} Credits`}
                      </span>
                      <button
                        onClick={() => navigateToAcademics('courses')}
                        className="text-primary font-medium flex items-center gap-0.5 hover:underline text-xs"
                      >
                        Details <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {safeCourses.length === 0 && (
                <div className="col-span-3 bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant font-body-sm text-xs border border-outline-variant/10">
                  No courses enrolled for the active semester.
                </div>
              )}
            </div>
          </section>

          {/* 3. COMPREHENSIVE CURRICULAR PERFORMANCE LEDGER TABLE */}
          <section className="bg-surface-container-lowest rounded-xl p-3 sm:p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div>
                <h2 className="font-headline-md text-lg font-semibold text-on-surface">
                  Registered Courses Overview
                </h2>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Active semester continuous evaluation tally
                </p>
              </div>
              <button
                onClick={() => navigateToAcademics('courses')}
                className="bg-surface-container text-on-surface-variant px-3 py-1.5 rounded font-label-sm text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-container-high transition-colors shrink-0"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export Academic Audit</span>
                <span className="sm:hidden">View All</span>
              </button>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-outline-variant/15">
              {safeCourses.length > 0 ? (
                safeCourses.slice(0, 5).map((course, idx) => {
                  const attMatch = safeAttendance.find((a) => a?.courseCode === course?.code);
                  const pct = attMatch?.percentage ?? attMatch?.attendancePercentage;
                  const hasValidPct = pct !== undefined && pct !== null && !isNaN(Number(pct));
                  const status = hasValidPct ? (Number(pct) < 75 ? 'Shortage' : Number(pct) < 85 ? 'Watchlist' : 'Safe') : 'Enrolled';

                  return (
                    <div
                      key={course.id || course.code || idx}
                      onClick={() => navigateToAcademics('courses')}
                      className="py-3 px-1 flex items-center justify-between gap-3 active:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-primary font-label-md text-xs tracking-wide">
                            {course.code}
                          </span>
                          <span className="text-[11px] text-on-surface-variant/80 bg-surface-container px-1.5 py-0.5 rounded">
                            {course.type || 'Theory'} · {formatFixed(course.credits, 0, '--')} cr
                          </span>
                        </div>
                        <p className="font-medium text-on-surface text-xs leading-snug truncate">
                          {course.title}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="font-tabular-data font-bold text-sm text-on-surface">
                          {hasValidPct ? `${formatFixed(pct, 1)}%` : '--'}
                        </span>
                        <span
                          className={`font-label-sm text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            status === 'Shortage'
                              ? 'bg-error-container text-error'
                              : status === 'Watchlist'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-on-surface-variant font-body-sm text-xs">
                  No courses loaded yet.
                </div>
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left font-body-sm text-xs border-collapse">
                <thead>
                  <tr className="text-outline uppercase font-label-sm text-[11px] bg-surface-container-low">
                    <th className="py-2.5 px-3 font-semibold">Course Code</th>
                    <th className="py-2.5 px-3 font-semibold">Title</th>
                    <th className="py-2.5 px-3 font-semibold">Credits</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Attendance</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {safeCourses.length > 0 ? (
                    safeCourses.slice(0, 5).map((course, idx) => {
                      const attMatch = safeAttendance.find((a) => a?.courseCode === course?.code);
                      const pct = attMatch?.percentage ?? attMatch?.attendancePercentage;
                      const hasValidPct = pct !== undefined && pct !== null && !isNaN(Number(pct));
                      const status = hasValidPct ? (Number(pct) < 75 ? 'Shortage' : Number(pct) < 85 ? 'Watchlist' : 'Safe') : 'Enrolled';

                      return (
                        <tr
                          key={course.id || course.code || idx}
                          onClick={() => navigateToAcademics('courses')}
                          className="hover:bg-surface-container-low cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-primary font-label-md text-xs">
                            {course.code}
                          </td>
                          <td className="py-3 px-3 font-medium text-on-surface">
                            {course.title}
                          </td>
                          <td className="py-3 px-3 font-tabular-data text-on-surface-variant">
                            {formatFixed(course.credits, 1, '--')}
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            {course.type || 'Theory'}
                          </td>
                          <td className="py-3 px-3 text-right font-tabular-data font-semibold text-on-surface">
                            {hasValidPct ? `${formatFixed(pct, 1)}%` : '--'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-label-sm text-[11px] px-2 py-0.5 rounded font-medium ${
                                status === 'Shortage'
                                  ? 'bg-error-container text-error'
                                  : status === 'Watchlist'
                                  ? 'bg-surface-container text-on-surface-variant'
                                  : 'bg-secondary-fixed/50 text-on-secondary-fixed font-semibold'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-on-surface-variant font-body-sm text-xs">
                        No courses loaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (4 COLS / SATELLITE INSPECTOR) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. QUICK ATTENDANCE SAFETY WATCH WITH SIMULATOR */}
          <section className="hidden md:flex bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-secondary" />
                <h3 className="font-headline-md text-base font-semibold text-on-surface">
                  Attendance Watch
                </h3>
              </div>
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Cutoff: 75%
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Your lowest attendance, at a glance.
            </p>

            {watchCourses.length > 0 ? (
              watchCourses.map((attCourse, wIdx) => {
                const rawPct = attCourse.percentage ?? attCourse.attendancePercentage ?? 0;
                const pct = Number(rawPct) || 0;
                const conducted = attCourse.total ?? attCourse.classesConducted ?? 0;
                const attended = attCourse.attended ?? attCourse.classesAttended ?? 0;
                const safeMiss = attCourse.safeToMiss ?? 0;
                const needAttend = attCourse.needToAttend ?? 0;
                const isShortage = pct < 75;

                return (
                  <div key={attCourse.courseCode || wIdx} className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-2 border border-outline-variant/10">
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-xs font-semibold text-on-surface truncate max-w-[200px]" title={attCourse.courseTitle || attCourse.courseName}>
                        {attCourse.courseCode} • {attCourse.courseTitle || attCourse.courseName}
                      </span>
                      <span className={`font-tabular-data font-label-md text-xs font-bold ${isShortage ? 'text-error' : 'text-on-surface'}`}>
                        {formatFixed(Math.max(0, Math.min(100, pct + simulatedOffset)), 1)}%
                      </span>
                    </div>
                    {/* Cutoff visual bar with 75% regulatory mark */}
                    <div className="relative w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isShortage ? 'bg-error' : 'bg-secondary'}`}
                        style={{ width: `${Math.max(0, Math.min(100, pct + simulatedOffset))}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-error z-10"
                        title="75% Regulatory Cutoff"
                      />
                    </div>
                    <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
                      <span className="text-outline font-tabular-data">Current: {attended}/{conducted} Sessions</span>
                      {isShortage ? (
                        <span className="text-error font-medium">Need {needAttend} class{needAttend === 1 ? '' : 'es'} to reach 75%</span>
                      ) : (
                        <span className="text-secondary font-medium">Can miss {safeMiss} class{safeMiss === 1 ? '' : 'es'} safely</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant font-body-sm text-xs border border-outline-variant/10">
                No attendance records available.
              </div>
            )}

            {/* Interactive Absence Simulator Box */}
            <div className="bg-surface-container p-3.5 rounded-lg flex flex-col gap-2 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider font-semibold text-on-surface">
                  Absence Simulator
                </span>
                <Calculator size={15} className="text-outline" />
              </div>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Preview leave and OD changes.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSimulatedOffset((prev) => (prev === -3.5 ? 0 : -3.5))}
                  className={`p-2 rounded font-label-sm text-xs text-center font-medium transition-colors ${
                    simulatedOffset === -3.5
                      ? 'bg-error text-white font-bold'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  +1 Day Leave (-4h)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedOffset((prev) => (prev === 2.5 ? 0 : 2.5))}
                  className={`p-2 rounded font-label-sm text-xs text-center font-medium transition-colors ${
                    simulatedOffset === 2.5
                      ? 'bg-secondary text-white font-bold'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  +3 Days OD (+12h)
                </button>
              </div>
            </div>
          </section>

          {/* 2. RECENT MARKS & EVALUATION FEED */}
          <section className="hidden md:flex bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Award size={20} className="text-secondary" />
                <h3 className="font-headline-md text-base font-semibold text-on-surface">
                  Recent marks
                </h3>
              </div>
              <button
                onClick={() => navigateToAcademics('marks')}
                className="font-label-sm text-xs text-primary font-semibold hover:underline"
              >
                All marks
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {evaluatedMarks.length > 0 ? (
                evaluatedMarks.map((ev, eIdx) => {
                  const pct = ev.max > 0 ? Math.round((ev.scored / ev.max) * 100) : 0;
                  return (
                    <div key={eIdx} className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-1.5 border border-outline-variant/10">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-xs font-semibold text-primary truncate max-w-[180px]">
                          {ev.courseCode} • {ev.compTitle}
                        </span>
                        <span className="bg-surface-container text-on-surface font-label-sm text-[10px] px-2 py-0.5 rounded font-semibold font-tabular-data">
                          {ev.status || 'Recorded'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-headline-sm text-base font-bold text-on-surface font-tabular-data">
                          {formatFixed(ev.scored, 1, '0.0')} <span className="text-outline font-label-sm text-xs font-normal">/ {formatFixed(ev.max, 1, '0.0')}</span>
                        </span>
                        <span className="font-headline-sm text-sm text-secondary font-bold font-tabular-data">
                          {pct}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-label-sm text-[11px] text-outline pt-1 border-t border-outline-variant/10">
                        <span>Weightage: {formatFixed(ev.weightage, 1, '-')} / {formatFixed(ev.maxWeightage || 15, 1, '15.0')} pts</span>
                        {ev.average !== null && ev.average !== undefined ? (
                          <span>Class Mean: {formatFixed(ev.average, 1)}</span>
                        ) : (
                          <span className="text-outline">Class Mean: --</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant font-body-sm text-xs border border-outline-variant/10">
                  No marks published yet.
                </div>
              )}
            </div>
          </section>

          {/* 3. CAMPUS FACILITIES & STUDY PODS REAL-TIME VACANCY */}
          <section className="hidden md:flex bg-surface-container-lowest p-5 md:p-6 shadow-sm border border-outline-variant/30 flex-col gap-4 rounded-xl">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-secondary" />
                <h3 className="font-headline-md text-base font-semibold text-on-surface">
                  Campus Pods
                </h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" title="Sensors Online" />
            </div>

            {/* Architectural Library Visual Pod */}
            <div className="relative rounded-lg overflow-hidden h-28 bg-surface-container">
              <img
                className="w-full h-full object-cover"
                alt="Modern quiet library floor"
                src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-on-background/80 via-on-background/40 to-transparent p-3 flex flex-col justify-end text-white">
                <span className="font-label-sm text-[10px] uppercase tracking-wider font-semibold text-primary-fixed">
                  Central Library Level 2
                </span>
                <span className="font-headline-sm text-xs font-semibold">
                  Silence Research Pods
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-lg border border-outline-variant/10">
              <div className="flex flex-col">
                <span className="font-metric-display text-2xl font-bold text-secondary leading-none font-tabular-data">
                  18
                </span>
                <span className="font-label-sm text-[11px] text-on-surface-variant font-medium mt-1">
                  Vacant of 32 Pods
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectView?.('ai-planner')}
                className="bg-primary text-on-primary px-3.5 py-1.5 rounded font-label-md text-xs font-semibold hover:opacity-95 shadow-sm transition-opacity"
              >
                Reserve Pod
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
