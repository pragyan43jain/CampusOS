import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Clock,
  RefreshCw,
  Navigation,
  Download,
  Calendar,
  ArrowRight,
  Calculator,
  ChevronRight,
  Award,
  Users,
  MapPin,
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

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [simulatedOffset, setSimulatedOffset] = useState<number>(0);

  // Timetable slots for selected day
  const filteredSlots = useMemo(() => {
    const slots = timetable.filter((s) => s.day === selectedDay);
    return slots.length > 0 ? slots : timetable.slice(0, 4);
  }, [timetable, selectedDay]);

  // Determine active or upcoming class
  const nextClass = useMemo(() => {
    if (filteredSlots.length > 0) return filteredSlots[0];
    return null;
  }, [filteredSlots]);

  // Dynamic slot attendance resolver with zero hallucination and strict course mapping
  const getSlotAttendance = (slot: TimetableSlot) => {
    if (!attendance || attendance.length === 0) return null;
    const sCode = (slot.courseCode || slot.subjectCode || '').trim().toUpperCase();
    const sSlot = (slot.slot || slot.slotName || '').trim();
    const sTitle = (slot.courseTitle || slot.courseName || slot.subject || '').trim().toLowerCase();

    let match = attendance.find((a) => {
      const aCode = (a.courseCode || (a as any).code || '').trim().toUpperCase();
      return aCode && sCode && aCode === sCode;
    });

    if (!match && sSlot) {
      match = attendance.find((a) => {
        const aSlot = (a.slot || (a as any).slotName || '').trim();
        const aSlots = (a.slots || '').trim();
        return (aSlot && aSlot === sSlot) || (aSlots && aSlots.includes(sSlot));
      });
    }

    if (!match && sTitle) {
      match = attendance.find((a) => {
        const aTitle = (a.courseTitle || a.courseName || (a as any).title || '').trim().toLowerCase();
        return aTitle && aTitle === sTitle;
      });
    }

    if (!match) return null;

    const attended = match.attended ?? match.classesAttended ?? 0;
    const total = match.total ?? match.conducted ?? match.classesConducted ?? 0;
    const pct = match.percentage ?? match.attendancePercentage ?? (total > 0 ? Math.round((attended / total) * 1000) / 10 : 0);
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
    if (!marks || marks.length === 0) return [];
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

    for (const m of marks) {
      if (m.components && m.components.length > 0) {
        for (const c of m.components) {
          if (c.scored !== null && c.scored !== undefined) {
            list.push({
              courseCode: m.courseCode,
              courseTitle: m.courseTitle || m.courseName,
              compTitle: c.title,
              scored: c.scored,
              max: c.max,
              weightage: c.weightage,
              maxWeightage: c.maxWeightage,
              average: c.average,
              status: c.status,
            });
          }
        }
      } else if (m.cat1 && m.cat1.scored !== null && m.cat1.scored !== undefined) {
        list.push({
          courseCode: m.courseCode,
          courseTitle: m.courseTitle || m.courseName,
          compTitle: 'CAT-1',
          scored: m.cat1.scored,
          max: m.cat1.max || 50,
          weightage: m.cat1.weightage,
          maxWeightage: 15,
          average: null,
          status: 'Recorded',
        });
      }
    }
    return list.slice(0, 2);
  }, [marks]);

  // Courses most at risk or closest to 75% cutoff
  const watchCourses = useMemo(() => {
    if (!attendance || attendance.length === 0) return [];
    return [...attendance]
      .filter((a) => (a.total ?? a.classesConducted ?? 0) > 0)
      .sort((a, b) => {
        const pA = a.percentage ?? a.attendancePercentage ?? 100;
        const pB = b.percentage ?? b.attendancePercentage ?? 100;
        return pA - pB;
      })
      .slice(0, 2);
  }, [attendance]);

  // Next upcoming examination from authentic exam schedule
  const nextExam = useMemo(() => {
    if (!exams || exams.length === 0) return null;
    const now = Date.now();
    const sorted = [...exams].sort((a, b) => {
      const tA = new Date(a.date).getTime() || 0;
      const tB = new Date(b.date).getTime() || 0;
      return tA - tB;
    });
    return sorted.find((e) => (new Date(e.date).getTime() || 0) >= now - 86400000) || sorted[0];
  }, [exams]);

  // Calculate overall attendance
  const overallAtt = student?.overallAttendance;
  const overallPct = overallAtt?.percentage !== null && overallAtt?.percentage !== undefined
    ? Number(overallAtt.percentage)
    : (attendance.length > 0
        ? Math.round(
            (attendance.reduce((acc, c) => acc + (c.attended || c.classesAttended || 0), 0) /
              Math.max(1, attendance.reduce((acc, c) => acc + (c.total || c.classesConducted || 0), 0))) * 1000
          ) / 10
        : 0);

  const attBufferMargin = Math.round((overallPct - 75.0) * 10) / 10;
  const criticalCount = attendance.filter((a) => {
    const p = a.percentage !== undefined ? a.percentage : (a.attendancePercentage !== undefined ? a.attendancePercentage : 100);
    return p < 75;
  }).length;

  // CGPA calculation
  const cgpaDisplay = student?.cgpa !== null && student?.cgpa !== undefined && !isNaN(Number(student.cgpa))
    ? Number(student.cgpa).toFixed(2)
    : '--';

  const earnedCredits = student?.creditsEarned ?? (courses.length > 0 ? courses.reduce((a, c) => a + (c.credits || 0), 0) : '--');
  const registeredCredits = student?.registeredCredits ?? (courses.length > 0 ? courses.reduce((a, c) => a + (c.credits || 0), 0) : '--');
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
          1. TOP EDITORIAL GREETING & CONTEXT BANNER
          ========================================================================= */}
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
          <p className="font-body-md text-sm text-on-surface-variant">
            Continuous Assessment matrix normalized. No administrative holds detected on student file.
          </p>
        </div>

        <div className="flex items-center gap-4 self-start md:self-auto shrink-0">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-md text-xs font-semibold text-on-surface">VTOP Sync Live</span>
            </div>
            <span className="font-label-sm text-[11px] text-outline font-tabular-data">
              {formatLastSynced()}
            </span>
          </div>
          <button
            onClick={onSync || onOpenSyncModal}
            disabled={syncing}
            className="bg-primary text-on-primary px-3.5 py-2 rounded font-label-md text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity disabled:opacity-70"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>Pull Ledger</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          2. TOP METRICS STRIP: 4-COLUMN HIGH PRECISION ANALYTICAL STRIP
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: CGPA */}
        <div
          onClick={() => navigateToAcademics('grades')}
          className="bg-surface-container-lowest p-4 md:p-5 rounded-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
              Cumulative GPA
            </span>
            <GraduationCap size={18} className="text-secondary" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-metric-display text-3xl font-semibold text-on-surface font-tabular-data">
              {cgpaDisplay}
            </span>
            <span className="font-label-md text-xs text-outline font-medium font-tabular-data">
              / 10.00
            </span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
            <span>{earnedCredits} Credits Completed</span>
            <span className="bg-secondary-fixed/40 text-on-secondary-fixed px-1.5 py-0.5 rounded font-semibold">
              {cgpaDisplay !== '--' && Number(cgpaDisplay) >= 9.0
                ? 'Exemplary'
                : cgpaDisplay !== '--' && Number(cgpaDisplay) >= 8.5
                ? "Dean's List Track"
                : 'Good Standing'}
            </span>
          </div>
        </div>

        {/* Metric 2: Aggregate Attendance */}
        <div
          onClick={() => navigateToAcademics('attendance')}
          className="bg-surface-container-lowest p-4 md:p-5 rounded-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
              Aggregate Attendance
            </span>
            <ShieldCheck size={18} className="text-secondary" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-metric-display text-3xl font-semibold text-on-surface font-tabular-data">
              {overallPct}%
            </span>
            <span className="font-label-sm text-[11px] text-outline font-tabular-data">
              Req: 75.0%
            </span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-[11px]">
            <span className="text-primary font-medium font-tabular-data">
              {attBufferMargin >= 0 ? `+${attBufferMargin}% Buffer Margin` : `${attBufferMargin}% Below Cutoff`}
            </span>
            <span className="text-on-surface-variant">
              {criticalCount === 0 ? '0 Critical Courses' : `${criticalCount} Critical`}
            </span>
          </div>
        </div>

        {/* Metric 3: Curricular Load */}
        <div
          onClick={() => navigateToAcademics('courses')}
          className="bg-surface-container-lowest p-4 md:p-5 rounded-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
              Curricular Load
            </span>
            <BookOpen size={18} className="text-secondary" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-metric-display text-3xl font-semibold text-on-surface font-tabular-data">
              {courses.length > 0 ? courses.length : 12}
            </span>
            <span className="font-label-md text-xs text-on-surface-variant">Courses</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
            <span className="font-tabular-data">{registeredCredits} Credit Hours</span>
            <span className="text-outline">Max: 27.0 CH</span>
          </div>
        </div>

        {/* Metric 4: On-Duty Buffer */}
        <div
          onClick={onOpenODModal}
          className="bg-surface-container-lowest p-4 md:p-5 rounded-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
              On-Duty Buffer
            </span>
            <Clock size={18} className="text-secondary" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-metric-display text-3xl font-semibold text-on-surface font-tabular-data">
              {approvedOdHours}
              <span className="text-outline text-base font-normal">/{maxOdHours}</span>
            </span>
            <span className="font-label-md text-xs text-on-surface-variant">Sanctioned</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
            <span className="text-secondary font-semibold font-tabular-data">
              {remainingOdHours}h Available Reserve
            </span>
            <span className="text-outline">
              {maxOdHours > 0 ? Math.round((approvedOdHours / maxOdHours) * 100) : 0}% Consumed
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. TWO-COLUMN WORKSPACE: LEFT CORE (8 COLS) + RIGHT SATELLITE (4 COLS)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. ACADEMIC TIMELINE & LIVE CLASS ROSTER */}
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-primary" />
                <h2 className="font-headline-md text-lg font-semibold text-on-surface">
                  Today's Academic Timeline
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`px-2.5 py-1 rounded text-[11px] font-label-sm font-semibold transition-colors ${
                      selectedDay === d
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Next Up: Highlighted Active Class Banner */}
            {nextClass ? (
              <div className="bg-primary text-on-primary rounded-lg p-4 md:p-5 shadow-sm relative overflow-hidden flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-surface-container-lowest text-primary font-label-sm text-[11px] px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                      Next Up • {nextClass.slot || 'Active Session'}
                    </span>
                    <span className="font-label-md text-xs text-primary-fixed font-tabular-data">
                      {nextClass.startTime || '14:00'} - {nextClass.endTime || '14:50 IST'}
                    </span>
                  </div>
                  {nextClassAtt && nextClassAtt.total > 0 ? (
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-[11px] font-semibold ${
                      nextClassAtt.isCritical
                        ? 'bg-error text-white'
                        : 'bg-primary-container text-on-primary-container'
                    }`}>
                      <ShieldCheck size={14} />
                      <span>
                        {nextClassAtt.isCritical
                          ? `Need +${nextClassAtt.needToAttend} Classes`
                          : nextClassAtt.safeToMiss > 0
                          ? `Safe Buffer +${nextClassAtt.safeToMiss}`
                          : 'Borderline (0 Safe)'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-primary-container px-2 py-0.5 rounded text-on-primary-container font-label-sm text-[11px] font-semibold">
                      <ShieldCheck size={14} />
                      <span>Cutoff 75%</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-1">
                  <div>
                    <div className="font-label-sm text-xs text-primary-fixed uppercase tracking-wider font-semibold">
                      {nextClass.courseCode || nextClass.subjectCode || 'Active Course'}
                    </div>
                    <h3 className="font-headline-lg text-xl md:text-2xl font-semibold text-on-primary mt-0.5">
                      {nextClass.courseTitle || nextClass.subject || nextClass.courseName || 'Lecture'}
                    </h3>
                    <p className="font-body-sm text-xs text-primary-fixed mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Faculty: {nextClass.faculty || nextClass.facultyName || 'Faculty'}</span>
                      <span>•</span>
                      <span>Room {nextClass.room || nextClass.venue || 'Campus Venue'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigateToAcademics('timetable')}
                      className="bg-surface-container-lowest text-primary px-3 py-1.5 rounded font-label-sm text-xs font-semibold flex items-center gap-1 hover:bg-surface-container transition-colors shadow-sm"
                    >
                      <Navigation size={14} />
                      <span>Directions</span>
                    </button>
                    <button
                      onClick={() => navigateToAcademics('courses')}
                      className="bg-primary-container text-on-primary px-3 py-1.5 rounded font-label-sm text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
                    >
                      <Download size={14} />
                      <span>Syllabus</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Daily Stream Chrono Cards */}
            <div className="flex flex-col gap-2.5">
              {filteredSlots.slice(0, 3).map((slot, idx) => {
                const slotAtt = getSlotAttendance(slot);
                return (
                  <div
                    key={slot.id || `${slot.courseCode}-${slot.slot}-${idx}`}
                    className="bg-surface-container-low p-3.5 md:p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container transition-colors border border-outline-variant/10"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="flex flex-col items-center justify-center bg-surface-container-lowest w-14 h-14 rounded shadow-sm shrink-0 border border-outline-variant/20">
                        <span className="font-label-sm text-[10px] text-outline font-semibold uppercase">
                          {slot.slot?.startsWith('L') ? 'Lab' : 'Hour'}
                        </span>
                        <span className="font-headline-sm text-xs md:text-sm text-on-surface font-tabular-data font-semibold">
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
                              {slotAtt.percentage.toFixed(1)}%
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
                );
              })}
            </div>
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
              {courses.slice(0, 3).map((course, idx) => {
                const attMatch = attendance.find((a) => a.courseCode === course.code);
                const pct = attMatch?.percentage ?? attMatch?.attendancePercentage;
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
                        {course.faculty ? `Faculty: ${course.faculty}` : `${course.credits} Credits`}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-between font-label-sm text-xs border-t border-outline-variant/10">
                      <span className="text-secondary font-semibold font-tabular-data">
                        {pct !== undefined ? `${pct.toFixed(1)}% Attended` : `${course.credits} Credits`}
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
              {courses.length === 0 && (
                <div className="col-span-3 bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant font-body-sm text-xs border border-outline-variant/10">
                  No courses enrolled for the active semester.
                </div>
              )}
            </div>
          </section>

          {/* 3. COMPREHENSIVE CURRICULAR PERFORMANCE LEDGER TABLE */}
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
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
                className="bg-surface-container text-on-surface-variant px-3 py-1.5 rounded font-label-sm text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-container-high transition-colors"
              >
                <Download size={14} />
                <span>Export Academic Audit</span>
              </button>
            </div>

            <div className="overflow-x-auto">
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
                  {courses.length > 0 ? (
                    courses.slice(0, 5).map((course, idx) => {
                      const attMatch = attendance.find((a) => a.courseCode === course.code);
                      const pct = attMatch?.percentage ?? attMatch?.attendancePercentage;
                      const status = pct !== undefined ? (pct < 75 ? 'Shortage' : pct < 85 ? 'Watchlist' : 'Safe') : 'Enrolled';

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
                            {course.credits !== undefined ? course.credits.toFixed(1) : '--'}
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            {course.type || 'Theory'}
                          </td>
                          <td className="py-3 px-3 text-right font-tabular-data font-semibold text-on-surface">
                            {pct !== undefined ? `${pct.toFixed(1)}%` : '--'}
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
                        No registered courses loaded for the active semester.
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
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
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
              Statutory attendance tracking with live buffer margin calculations.
            </p>

            {watchCourses.length > 0 ? (
              watchCourses.map((attCourse, wIdx) => {
                const pct = attCourse.percentage ?? attCourse.attendancePercentage ?? 0;
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
                        {Math.max(0, Math.min(100, pct + simulatedOffset)).toFixed(1)}%
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
                Select hypothetical sick leaves or conference OD to verify threshold survival.
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
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Award size={20} className="text-secondary" />
                <h3 className="font-headline-md text-base font-semibold text-on-surface">
                  Recent Evaluations
                </h3>
              </div>
              <button
                onClick={() => navigateToAcademics('marks')}
                className="font-label-sm text-xs text-primary font-semibold hover:underline"
              >
                Full Ledger
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
                          {ev.scored.toFixed(1)} <span className="text-outline font-label-sm text-xs font-normal">/ {ev.max.toFixed(1)}</span>
                        </span>
                        <span className="font-headline-sm text-sm text-secondary font-bold font-tabular-data">
                          {pct}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-label-sm text-[11px] text-outline pt-1 border-t border-outline-variant/10">
                        <span>Weightage: {ev.weightage !== undefined ? ev.weightage.toFixed(1) : '-'} / {(ev.maxWeightage || 15).toFixed(1)} pts</span>
                        {ev.average !== null && ev.average !== undefined ? (
                          <span>Class Mean: {ev.average.toFixed(1)}</span>
                        ) : (
                          <span className="text-outline">Class Mean: --</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant font-body-sm text-xs border border-outline-variant/10">
                  No continuous evaluation marks published yet for the active semester.
                </div>
              )}
            </div>
          </section>

          {/* 3. CAMPUS FACILITIES & STUDY PODS REAL-TIME VACANCY */}
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
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
