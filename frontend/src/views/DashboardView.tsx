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
  marks: _marks = [],
  exams: _exams = [],
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

  // Calculate overall attendance
  const overallAtt = student?.overallAttendance;
  const overallPct = overallAtt?.percentage !== null && overallAtt?.percentage !== undefined
    ? Number(overallAtt.percentage)
    : (attendance.length > 0
        ? Math.round(
            (attendance.reduce((acc, c) => acc + (c.attended || c.classesAttended || 0), 0) /
              Math.max(1, attendance.reduce((acc, c) => acc + (c.total || c.classesConducted || 0), 0))) * 1000
          ) / 10
        : 90.9);

  const attBufferMargin = Math.round((overallPct - 75.0) * 10) / 10;
  const criticalCount = attendance.filter((a) => {
    const p = a.percentage !== undefined ? a.percentage : 0;
    return p < 75;
  }).length;

  // CGPA calculation
  const cgpaDisplay = student?.cgpa !== null && student?.cgpa !== undefined && !isNaN(Number(student.cgpa))
    ? Number(student.cgpa).toFixed(2)
    : '8.81';

  const earnedCredits = student?.creditsEarned ?? 105;
  const registeredCredits = student?.registeredCredits ?? (courses.length > 0 ? courses.reduce((a, c) => a + (c.credits || 0), 0) : 24.5);
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
              {student?.branch || 'B.Tech CSE (Core)'}
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
              Synced today • Active Session
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
            <span className="font-label-md text-xs text-primary font-semibold font-tabular-data">
              +0.12
            </span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
            <span>{earnedCredits} Credits Completed</span>
            <span className="bg-secondary-fixed/40 text-on-secondary-fixed px-1.5 py-0.5 rounded font-semibold">
              Dean's List Track
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
                  <div className="flex items-center gap-1.5 bg-primary-container px-2 py-0.5 rounded text-on-primary-container font-label-sm text-[11px] font-semibold">
                    <ShieldCheck size={14} />
                    <span>Safe Buffer +8</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-1">
                  <div>
                    <div className="font-label-sm text-xs text-primary-fixed uppercase tracking-wider font-semibold">
                      {nextClass.courseCode || 'BMAT202L'}
                    </div>
                    <h3 className="font-headline-lg text-xl md:text-2xl font-semibold text-on-primary mt-0.5">
                      {nextClass.courseTitle || 'Probability and Statistics'}
                    </h3>
                    <p className="font-body-sm text-xs text-primary-fixed mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Faculty: {nextClass.faculty || 'Prof. Thangaraj M'}</span>
                      <span>•</span>
                      <span>Room {nextClass.room || 'ABI-802 (Academic Block I)'}</span>
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
              {filteredSlots.slice(0, 3).map((slot, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container-low p-3.5 md:p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container transition-colors border border-outline-variant/10"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex flex-col items-center justify-center bg-surface-container-lowest w-14 h-14 rounded shadow-sm shrink-0 border border-outline-variant/20">
                      <span className="font-label-sm text-[10px] text-outline font-semibold uppercase">
                        {slot.slot?.startsWith('L') ? 'Lab' : 'Hour'}
                      </span>
                      <span className="font-headline-sm text-xs md:text-sm text-on-surface font-tabular-data font-semibold">
                        {slot.startTime || '14:55'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-label-sm text-xs font-semibold text-primary">
                          {slot.courseCode || 'BECE355L'}
                        </span>
                        <span className="text-outline-variant text-xs">•</span>
                        <span className="font-label-sm text-xs text-outline">
                          Slot {slot.slot || 'F1+TF1'}
                        </span>
                      </div>
                      <h4 className="font-headline-sm text-sm font-semibold text-on-surface truncate">
                        {slot.courseTitle || 'Advanced Computing Systems'}
                      </h4>
                      <div className="flex items-center gap-2.5 font-body-sm text-xs text-on-surface-variant mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {slot.room || 'ABI-711'}
                        </span>
                        <span>{slot.faculty || 'Faculty in charge'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <div className="text-right">
                      <span className="font-tabular-data font-label-md text-xs text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded font-semibold">
                        92.4%
                      </span>
                      <span className="block font-label-sm text-[10px] text-outline mt-0.5">
                        Attended: 24/26
                      </span>
                    </div>
                    <button
                      onClick={() => navigateToAcademics('timetable')}
                      className="bg-surface-container-lowest text-on-surface-variant hover:text-on-surface p-1.5 rounded shadow-sm"
                      title="Inspect Timetable"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. CONTINUOUS ASSESSMENT (CAT-2) READINESS MILESTONE */}
          <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2 border-b border-outline-variant/20">
              <div>
                <div className="flex items-center gap-2">
                  <Award size={20} className="text-secondary" />
                  <h2 className="font-headline-md text-lg font-semibold text-on-surface">
                    Continuous Assessment Milestone
                  </h2>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  CAT-2 Central Examination Block begins in 14 days • Weightage: 30% of aggregate semester grade
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="bg-surface-container font-tabular-data font-label-sm text-xs px-2.5 py-1 rounded text-on-surface font-semibold">
                  T-minus 14d : 10h
                </span>
              </div>
            </div>

            {/* Syllabus Coverage Progress Indicator */}
            <div className="bg-surface-container-low p-4 rounded-lg flex flex-col gap-2 border border-outline-variant/10">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs font-semibold text-on-surface">
                  Curricular Syllabus Coverage
                </span>
                <span className="font-tabular-data font-label-md text-xs text-primary font-bold">
                  68% Normalized
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '68%' }} />
              </div>
              <div className="flex justify-between font-label-sm text-[11px] text-outline font-tabular-data flex-wrap gap-1">
                <span>Module 1 & 2 Complete (100%)</span>
                <span>Module 3 In Progress (54%)</span>
                <span>Module 4 Scheduled</span>
              </div>
            </div>

            {/* High Yield Revision Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col justify-between gap-3 border border-outline-variant/10">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-xs text-primary font-semibold">BMAT202L</span>
                    <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">High Priority</span>
                  </div>
                  <h5 className="font-headline-sm text-xs font-semibold text-on-surface mt-1">
                    Joint Distributions & Covariance
                  </h5>
                  <p className="font-body-sm text-[11px] text-on-surface-variant mt-1 leading-snug">
                    8 problem sets marked for practice in Tutorial 5.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-xs border-t border-outline-variant/10">
                  <span className="text-secondary font-semibold font-tabular-data">Est. 4.5h review</span>
                  <button
                    onClick={() => navigateToAcademics('courses')}
                    className="text-primary font-medium flex items-center gap-0.5 hover:underline text-xs"
                  >
                    Syllabus <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col justify-between gap-3 border border-outline-variant/10">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-xs text-primary font-semibold">BCSE302L</span>
                    <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">Medium Priority</span>
                  </div>
                  <h5 className="font-headline-sm text-xs font-semibold text-on-surface mt-1">
                    Database Concurrency & Locks
                  </h5>
                  <p className="font-body-sm text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Strict 2PL, Timestamp ordering protocols.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-xs border-t border-outline-variant/10">
                  <span className="text-secondary font-semibold font-tabular-data">Est. 3.0h review</span>
                  <button
                    onClick={() => navigateToAcademics('courses')}
                    className="text-primary font-medium flex items-center gap-0.5 hover:underline text-xs"
                  >
                    Syllabus <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col justify-between gap-3 border border-outline-variant/10">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-xs text-primary font-semibold">BECE355L</span>
                    <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">Review Complete</span>
                  </div>
                  <h5 className="font-headline-sm text-xs font-semibold text-on-surface mt-1">
                    Distributed Consensus (Raft)
                  </h5>
                  <p className="font-body-sm text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Leader election proof cases & heartbeats.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-xs border-t border-outline-variant/10">
                  <span className="text-secondary font-semibold font-tabular-data">Est. 1.5h review</span>
                  <button
                    onClick={() => navigateToAcademics('courses')}
                    className="text-primary font-medium flex items-center gap-0.5 hover:underline text-xs"
                  >
                    Syllabus <ArrowRight size={12} />
                  </button>
                </div>
              </div>
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
                  {(courses.length > 0 ? courses : [
                    { code: 'BMAT202L', title: 'Probability and Statistics', credits: 4.0, type: 'Theory Only' },
                    { code: 'BECE355L', title: 'Adv. Cloud Computing', credits: 3.0, type: 'Embedded Theory' },
                    { code: 'BCSE302L', title: 'Database Systems Design', credits: 4.0, type: 'Theory + Lab' },
                    { code: 'BCSE308L', title: 'Computer Networks Lab', credits: 1.5, type: 'Practical Only' },
                  ]).slice(0, 5).map((course, idx) => {
                    const attMatch = attendance.find((a) => a.courseCode === course.code);
                    const pct = attMatch?.percentage ?? (idx === 0 ? 81.5 : idx === 1 ? 92.4 : idx === 2 ? 96.4 : 100.0);
                    const status = pct < 85 ? 'Watchlist' : pct < 95 ? 'Safe' : 'Exemplary';

                    return (
                      <tr
                        key={idx}
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
                          {course.credits?.toFixed(1) || '3.0'}
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">
                          {course.type || 'Theory'}
                        </td>
                        <td className="py-3 px-3 text-right font-tabular-data font-semibold text-on-surface">
                          {pct}%
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-label-sm text-[11px] px-2 py-0.5 rounded font-medium ${
                              status === 'Watchlist'
                                ? 'bg-surface-container text-on-surface-variant'
                                : 'bg-secondary-fixed/50 text-on-secondary-fixed font-semibold'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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

            {/* Course Risk Tile 1 */}
            <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-2 border border-outline-variant/10">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs font-semibold text-on-surface">
                  BMAT202L • Stats
                </span>
                <span className="font-tabular-data font-label-md text-xs text-on-surface font-bold">
                  {Math.max(60, Math.min(100, 81.5 + simulatedOffset)).toFixed(1)}%
                </span>
              </div>
              {/* Cutoff visual bar with 75% regulatory mark */}
              <div className="relative w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, 81.5 + simulatedOffset))}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-error z-10"
                  title="75% Regulatory Cutoff"
                />
              </div>
              <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
                <span className="text-outline font-tabular-data">Current: 22/27 Sessions</span>
                <span className="text-error font-medium">Can miss 1 class safely</span>
              </div>
            </div>

            {/* Course Risk Tile 2 */}
            <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-2 border border-outline-variant/10">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs font-semibold text-on-surface">
                  BCSE302L • DBMS
                </span>
                <span className="font-tabular-data font-label-md text-xs text-secondary font-bold">
                  96.4%
                </span>
              </div>
              <div className="relative w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: '96.4%' }} />
                <div
                  className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-error z-10"
                  title="75% Regulatory Cutoff"
                />
              </div>
              <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant">
                <span className="text-outline font-tabular-data">Current: 27/28 Sessions</span>
                <span className="text-secondary font-medium">Can miss 8 classes safely</span>
              </div>
            </div>

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
              {/* Evaluation Row 1 */}
              <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-1.5 border border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-xs font-semibold text-primary">
                    BECE355L • CAT-1
                  </span>
                  <span className="bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm text-[10px] px-2 py-0.5 rounded font-semibold font-tabular-data">
                    Top 5% Class Rank
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-sm text-base font-bold text-on-surface font-tabular-data">
                    46.0 <span className="text-outline font-label-sm text-xs font-normal">/ 50.0</span>
                  </span>
                  <span className="font-headline-sm text-sm text-secondary font-bold font-tabular-data">
                    92.0%
                  </span>
                </div>
                <div className="flex items-center justify-between font-label-sm text-[11px] text-outline pt-1 border-t border-outline-variant/10">
                  <span>Weightage: 13.8 / 15.0 pts</span>
                  <span>Class Mean: 34.2</span>
                </div>
              </div>

              {/* Evaluation Row 2 */}
              <div className="bg-surface-container-low p-3.5 rounded-lg flex flex-col gap-1.5 border border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-xs font-semibold text-primary">
                    BCSE302L • CAT-1
                  </span>
                  <span className="bg-surface-container text-on-surface-variant font-label-sm text-[10px] px-2 py-0.5 rounded font-medium font-tabular-data">
                    Above Average
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-headline-sm text-base font-bold text-on-surface font-tabular-data">
                    34.0 <span className="text-outline font-label-sm text-xs font-normal">/ 50.0</span>
                  </span>
                  <span className="font-headline-sm text-sm text-on-surface font-bold font-tabular-data">
                    68.0%
                  </span>
                </div>
                <div className="flex items-center justify-between font-label-sm text-[11px] text-outline pt-1 border-t border-outline-variant/10">
                  <span>Weightage: 10.2 / 15.0 pts</span>
                  <span>Class Mean: 31.8</span>
                </div>
              </div>
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
