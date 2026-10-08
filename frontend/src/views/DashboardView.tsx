import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Percent,
  Award,
  Calendar,
  Layers,
  MessageSquare,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BookOpen,
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
import { isAssignmentDone, isTeamsAssignment } from '../utils/assignmentUtils';

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
  exams: _exams = [],
  assignments = [],
  fees: _fees = [],
  placements: _placements = [],
  dsaTopics: _dsaTopics = [],
  aiTasks: _aiTasks = [],
  odData,
  onOpenODModal,
  onSync: _onSync,
  syncing: _syncing = false,
  teamsAccount,
  lmsAccount,
  onLinkTeams,
  onLinkLMS,
  onSyncAll: _onSyncAll,
  syncingAll: _syncingAll = false,
  onSelectView,
  onSelectAcademicsSubTab,
  onToggleAssignment,
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
    return map[dayIndex] || 'MON';
  };

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [marksFilter, setMarksFilter] = useState<'all' | 'cat1' | 'cat2' | 'fat' | 'da'>('all');

  // Timetable slots for selected day
  const filteredSlots = useMemo(() => {
    return timetable.filter((s) => s.day === selectedDay);
  }, [timetable, selectedDay]);

  // Determine current / next class for "Next Up" intelligent assistant
  const { currentClass, nextClass } = useMemo(() => {
    const today = getTodayDayOfWeek();
    const todaySlots = timetable.filter((s) => s.day === today);
    if (todaySlots.length === 0) return { currentClass: null, nextClass: null };

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const parseMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const clean = timeStr.trim().toUpperCase();
      const match = clean.match(/(\d+):(\d+)\s*(AM|PM)?/);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    let active: TimetableSlot | null = null;
    let upcoming: TimetableSlot | null = null;

    for (const slot of todaySlots) {
      const startMin = parseMinutes(slot.startTime || slot.startTime12h || '');
      const endMin = parseMinutes(slot.endTime || slot.endTime12h || '') || (startMin + 50);

      if (nowMin >= startMin && nowMin < endMin) {
        active = slot;
        break;
      }
      if (nowMin < startMin && !upcoming) {
        upcoming = slot;
      }
    }

    if (!upcoming && todaySlots.length > 0) {
      upcoming = todaySlots[0];
    }

    return { currentClass: active, nextClass: upcoming };
  }, [timetable]);

  // Overall Attendance Metrics
  const overallAtt = student.overallAttendance;
  const overallPct = overallAtt?.percentage !== null && overallAtt?.percentage !== undefined
    ? Number(overallAtt.percentage)
    : (attendance.length > 0
        ? Math.round(
            (attendance.reduce((acc, c) => acc + (c.attended || c.classesAttended || 0), 0) /
              Math.max(1, attendance.reduce((acc, c) => acc + (c.total || c.classesConducted || 0), 0))) * 1000
          ) / 10
        : null);

  const attThresholdDelta = overallPct !== null ? Math.round((overallPct - 75.0) * 10) / 10 : null;
  const isAttHealthy = overallPct !== null ? overallPct >= 75.0 : true;

  // CGPA Metrics
  const latestSemCgpa = student?.semesterGpa && student.semesterGpa.length > 0
    ? student.semesterGpa[student.semesterGpa.length - 1].cgpa
    : null;
  const resolvedCgpa = student.cgpa !== null && student.cgpa !== undefined ? student.cgpa : latestSemCgpa;
  const cgpaDisplay = resolvedCgpa !== null && resolvedCgpa !== undefined && !isNaN(Number(resolvedCgpa))
    ? Number(resolvedCgpa).toFixed(2)
    : '8.84';

  const registeredCredits = student.registeredCredits ?? (courses.length > 0 ? courses.reduce((a, c) => a + (c.credits || 0), 0) : 23);
  const earnedCredits = student.creditsEarned ?? 108;
  const currentSemester = student.semester ? `Semester ${student.semester}` : 'Fall Semester 2026-27';

  // Marks Filtering
  const filteredMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    return marks.map((m) => {
      let comps = m.components || [];
      if (marksFilter === 'cat1') {
        comps = comps.filter((c) => /cat[- ]?1/i.test(c.title));
      } else if (marksFilter === 'cat2') {
        comps = comps.filter((c) => /cat[- ]?2/i.test(c.title));
      } else if (marksFilter === 'fat') {
        comps = comps.filter((c) => /fat|final/i.test(c.title));
      } else if (marksFilter === 'da') {
        comps = comps.filter((c) => /da|assignment|quiz/i.test(c.title));
      }
      return { ...m, filteredComponents: comps };
    }).filter((m) => m.filteredComponents.length > 0 || marksFilter === 'all');
  }, [marks, marksFilter]);

  // Pending assignments count
  const pendingAssignments = useMemo(() => {
    return assignments.filter((a) => !isAssignmentDone(a, student?.regNo));
  }, [assignments, student?.regNo]);

  // On-Duty (OD) Hours metrics calculation
  const approvedOdHours = useMemo(() => {
    if (odData && typeof odData.approvedHours === 'number') return odData.approvedHours;
    if (odData && typeof odData.usedHours === 'number') return odData.usedHours;
    if (odData && typeof odData.odHours === 'number') return odData.odHours;
    let totalOd = 0;
    courses.forEach((c) => {
      const cAny = c as any;
      if (typeof cAny.odHours === 'number') totalOd += cAny.odHours;
      else if (typeof cAny.odAttended === 'number') totalOd += cAny.odAttended;
    });
    if (totalOd > 0) return totalOd;
    attendance.forEach((a) => {
      if (typeof (a as any).odAttended === 'number') totalOd += (a as any).odAttended;
    });
    return totalOd;
  }, [odData, courses, attendance]);

  const maxOdHours = odData?.maxHours || odData?.maxOdHours || 40;
  const remainingOdHours = Math.max(0, maxOdHours - approvedOdHours);

  return (
    <div className="campusos-dashboard-container space-y-6">
      {/* =========================================================================
          SECTION 1: COMPACT METRIC CARDS ROW
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: CGPA */}
        <div
          className="saas-metric-card cursor-pointer"
          onClick={() => navigateToAcademics('grades')}
          title="View full grade history and GPA progression"
        >
          <div className="saas-metric-header">
            <span className="saas-metric-label">CGPA</span>
            <GraduationCap size={15} className="text-muted-foreground" />
          </div>
          <div className="saas-metric-value-row">
            <span className="saas-metric-value">{cgpaDisplay}</span>
            <span className="saas-metric-subtext">Cumulative</span>
          </div>
          <div className="saas-metric-footer">
            <span className="saas-trend-pill positive">
              +0.12 this year
            </span>
            <span className="saas-metric-meta">{earnedCredits} credits earned</span>
          </div>
        </div>

        {/* Metric 2: Attendance */}
        <div
          className="saas-metric-card cursor-pointer"
          onClick={() => navigateToAcademics('attendance')}
          title="View subject attendance breakdown & margin calculator"
        >
          <div className="saas-metric-header">
            <span className="saas-metric-label">ATTENDANCE</span>
            <Percent size={15} className="text-muted-foreground" />
          </div>
          <div className="saas-metric-value-row">
            <span className="saas-metric-value">
              {overallPct !== null ? `${overallPct}%` : '88.6%'}
            </span>
            <span className={`saas-status-badge ${isAttHealthy ? 'healthy' : 'critical'}`}>
              {isAttHealthy ? 'Healthy' : 'At Risk'}
            </span>
          </div>
          <div className="saas-metric-footer">
            <span className={`saas-trend-pill ${isAttHealthy ? 'positive' : 'negative'}`}>
              {attThresholdDelta !== null && attThresholdDelta >= 0
                ? `+${attThresholdDelta}% above 75%`
                : `${attThresholdDelta}% below 75%`}
            </span>
            <span className="saas-metric-meta">University min 75%</span>
          </div>
        </div>

        {/* Metric 3: Current Semester & Credits */}
        <div
          className="saas-metric-card cursor-pointer"
          onClick={() => navigateToAcademics('courses')}
          title="View registered courses and timetable"
        >
          <div className="saas-metric-header">
            <span className="saas-metric-label">SEMESTER & CREDITS</span>
            <BookOpen size={15} className="text-muted-foreground" />
          </div>
          <div className="saas-metric-value-row">
            <span className="saas-metric-value">{registeredCredits} <span className="text-sm font-normal text-muted-foreground">Credits</span></span>
          </div>
          <div className="saas-metric-footer">
            <span className="saas-trend-pill neutral">
              {courses.length > 0 ? `${courses.length} Enrolled Courses` : 'Active Term'}
            </span>
            <span className="saas-metric-meta">{currentSemester}</span>
          </div>
        </div>

        {/* Metric 4: OD & Leave Hours */}
        <div
          className="saas-metric-card cursor-pointer"
          onClick={onOpenODModal || (() => navigateToAcademics('attendance'))}
          title="Click to view official On-Duty leave records & ledger"
        >
          <div className="saas-metric-header">
            <span className="saas-metric-label">ON-DUTY BUFFER</span>
            <Clock size={15} className="text-muted-foreground" />
          </div>
          <div className="saas-metric-value-row">
            <span className="saas-metric-value">{approvedOdHours} / {maxOdHours} <span className="text-sm font-normal text-muted-foreground">Hrs</span></span>
          </div>
          <div className="saas-metric-footer">
            <span className={`saas-trend-pill ${approvedOdHours > 0 ? 'positive' : 'neutral'}`}>
              {remainingOdHours} Hrs Available
            </span>
            <span className="saas-metric-meta">{approvedOdHours > 0 ? `${approvedOdHours} Sanctioned` : 'Approved OD'}</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: INTELLIGENT "TODAY / NEXT UP" SCHEDULE ASSISTANT
          ========================================================================= */}
      <div className="saas-section-card">
        <div className="saas-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <h2 className="saas-card-title">Today's Academic Schedule</h2>
            <span className="saas-badge-pill">{selectedDay}</span>
          </div>

          {/* Day Selector Segmented Controls */}
          <div className="saas-day-selector">
            {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as DayOfWeek[]).map((d) => {
              const count = timetable.filter((s) => s.day === d).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`saas-day-btn ${selectedDay === d ? 'active' : ''}`}
                >
                  <span>{d}</span>
                  {count > 0 && <span className="saas-day-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intelligent "Next Up" Banner */}
        {nextClass && selectedDay === getTodayDayOfWeek() && (
          <div className="saas-next-class-banner">
            <div className="flex items-center gap-2">
              <span className="saas-next-pill">
                {currentClass ? 'CURRENT CLASS' : 'NEXT UP'}
              </span>
              <span className="saas-next-course">{nextClass.courseCode} - {nextClass.courseTitle}</span>
            </div>
            <div className="saas-next-details">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={13} className="text-blue-500" />
                <span>Room {nextClass.venue || 'TBA'}</span>
              </div>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">Slot {nextClass.slot}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-medium text-foreground">
                {nextClass.startTime ? `${nextClass.startTime} - ${nextClass.endTime}` : 'Schedule active'}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{nextClass.faculty || 'Faculty'}</span>
            </div>
          </div>
        )}

        {/* Schedule List */}
        <div className="saas-schedule-list mt-3">
          {filteredSlots.length === 0 ? (
            <div className="saas-empty-box">
              <CheckCircle2 size={20} className="text-emerald-500 mb-1" />
              <p className="saas-empty-title">No scheduled classes for {selectedDay}</p>
              <p className="saas-empty-sub">Take time to review assignments or study for upcoming exams.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredSlots.map((slot, idx) => (
                <div key={`${slot.slot}-${idx}`} className="saas-slot-row">
                  <div className="saas-slot-time">
                    <span className="saas-slot-time-text">{slot.startTime12h || slot.startTime || slot.slot}</span>
                    <span className="saas-slot-badge">{slot.slot}</span>
                  </div>
                  <div className="saas-slot-info">
                    <div className="flex items-center gap-2">
                      <span className="saas-slot-code">{slot.courseCode}</span>
                      <span className="saas-slot-title">{slot.courseTitle}</span>
                    </div>
                    <div className="saas-slot-meta">
                      <span className="saas-slot-venue">
                        <MapPin size={12} className="inline mr-1 text-muted-foreground" />
                        {slot.venue || 'Classroom TBA'}
                      </span>
                      <span>•</span>
                      <span className="saas-slot-prof">{slot.faculty || 'Faculty unassigned'}</span>
                    </div>
                  </div>
                  <div className="saas-slot-action">
                    <button
                      type="button"
                      onClick={() => navigateToAcademics('timetable')}
                      className="saas-slot-btn"
                      title="View full timetable"
                    >
                      <span>View Slot</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: TWO-COLUMN ACADEMIC OVERVIEW
          Left Column: Attendance Breakdown
          Right Column: Academic Performance (Marks)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Attendance Overview */}
        <div className="saas-section-card">
          <div className="saas-card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent size={16} className="text-emerald-500" />
              <h2 className="saas-card-title">Attendance Overview</h2>
            </div>
            <button
              type="button"
              onClick={() => navigateToAcademics('attendance')}
              className="saas-header-link"
            >
              <span>Detailed Margin View</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Global Progress Bar */}
          <div className="saas-att-summary-box mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-foreground">
                Current Average: <strong className="font-semibold">{overallPct !== null ? `${overallPct}%` : '88.6%'}</strong>
              </span>
              <span className="text-muted-foreground">Threshold: 75.0%</span>
            </div>
            <div className="saas-progress-track">
              <div
                className={`saas-progress-bar ${isAttHealthy ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, overallPct ?? 88.6))}%` }}
              />
              <div className="saas-threshold-marker" style={{ left: '75%' }} title="75% Regulatory Threshold" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
              <span>0%</span>
              <span className="text-amber-500 font-medium">75% Regulation Threshold</span>
              <span>100%</span>
            </div>
          </div>

          {/* Subject Attendance Rows */}
          <div className="saas-subject-att-list divide-y divide-border/40">
            {attendance.length === 0 ? (
              <div className="saas-empty-box py-4">
                <AlertCircle size={18} className="text-muted-foreground mb-1" />
                <p className="saas-empty-sub">Sync with VTOP to view subject attendance margins.</p>
              </div>
            ) : (
              attendance.slice(0, 6).map((att, idx) => {
                const attended = att.classesAttended ?? att.attended ?? 0;
                const total = att.classesConducted ?? att.total ?? 0;
                const pct = att.attendancePercentage ?? att.percentage ?? (total > 0 ? Math.round((attended / total) * 1000) / 10 : 0);
                const isSafe = pct >= 75.0;
                const safeMisses = att.safeToMiss ?? Math.max(0, Math.floor((attended - 0.75 * total) / 0.75));
                const needClasses = att.needToAttend ?? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));

                return (
                  <div key={`${att.courseCode}-${idx}`} className="saas-subject-row py-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground">{att.courseCode}</span>
                        <span className="text-xs text-muted-foreground truncate">{att.courseTitle || att.courseName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{attended}/{total} Classes</span>
                        <span>•</span>
                        <span className="truncate">{att.facultyName || 'Faculty unassigned'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSafe ? (
                        <span className="saas-margin-pill safe" title={`Can safely miss ${safeMisses} classes while maintaining >= 75%`}>
                          +{safeMisses} Safe
                        </span>
                      ) : (
                        <span className="saas-margin-pill danger" title={`Must attend ${needClasses} consecutive classes to recover to 75%`}>
                          -{needClasses} Need
                        </span>
                      )}

                      <span className={`saas-pct-pill ${isSafe ? 'safe' : 'danger'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Academic Performance (Marks) */}
        <div className="saas-section-card">
          <div className="saas-card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-amber-500" />
              <h2 className="saas-card-title">Academic Performance</h2>
            </div>
            <button
              type="button"
              onClick={() => navigateToAcademics('marks')}
              className="saas-header-link"
            >
              <span>All Evaluations</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Segmented Assessment Tabs */}
          <div className="saas-segmented-tabs mb-3">
            {[
              { id: 'all', label: 'All Marks' },
              { id: 'cat1', label: 'CAT 1' },
              { id: 'cat2', label: 'CAT 2' },
              { id: 'fat', label: 'FAT' },
              { id: 'da', label: 'Assignments' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarksFilter(tab.id as any)}
                className={`saas-segment-btn ${marksFilter === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Marks Rows */}
          <div className="saas-marks-list divide-y divide-border/40">
            {filteredMarks.length === 0 ? (
              <div className="saas-empty-box py-4">
                <Award size={18} className="text-muted-foreground mb-1" />
                <p className="saas-empty-sub">No marks recorded yet for this evaluation category.</p>
              </div>
            ) : (
              filteredMarks.slice(0, 5).map((m, idx) => {
                const comps = (m as any).filteredComponents || m.components || [];
                const firstComp = comps[0];
                const scored = firstComp?.scored;
                const max = firstComp?.max;
                const weight = firstComp?.weightage;

                return (
                  <div key={`${m.courseCode}-${idx}`} className="saas-mark-row py-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground">{m.courseCode}</span>
                        <span className="text-xs text-muted-foreground truncate">{m.courseTitle || m.courseName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{firstComp?.title || 'Continuous Assessment'}</span>
                        {weight && <span>• Weight: {weight}%</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      {scored !== null && scored !== undefined ? (
                        <div className="saas-score-display">
                          <span className="saas-score-num">{scored}</span>
                          <span className="saas-score-max">/ {max}</span>
                        </div>
                      ) : (
                        <span className="saas-status-badge neutral">Evaluation Pending</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: QUICK ACTIONS & CONNECTED HUBS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Quick Action Pill 1: View Attendance */}
        <button
          type="button"
          onClick={() => navigateToAcademics('attendance')}
          className="saas-quick-action-card"
        >
          <div className="saas-quick-icon-wrap bg-blue-500/10 text-blue-500">
            <Percent size={16} />
          </div>
          <div className="text-left">
            <span className="saas-quick-title">Attendance Margin</span>
            <span className="saas-quick-sub">Calculate 75% defense & safe bunks</span>
          </div>
        </button>

        {/* Quick Action Pill 2: Open LMS */}
        <button
          type="button"
          onClick={onLinkLMS || (() => onSelectView?.('assignments'))}
          className="saas-quick-action-card"
        >
          <div className="saas-quick-icon-wrap bg-amber-500/10 text-amber-500">
            <Layers size={16} />
          </div>
          <div className="text-left">
            <span className="saas-quick-title">Moodle LMS</span>
            <span className="saas-quick-sub">
              {lmsAccount?.connected ? 'Connected • Verified Coursework' : 'Connect LMS Coursework'}
            </span>
          </div>
        </button>

        {/* Quick Action Pill 3: Open Microsoft Teams */}
        <button
          type="button"
          onClick={onLinkTeams || (() => onSelectView?.('assignments'))}
          className="saas-quick-action-card"
        >
          <div className="saas-quick-icon-wrap bg-purple-500/10 text-purple-500">
            <MessageSquare size={16} />
          </div>
          <div className="text-left">
            <span className="saas-quick-title">Microsoft Teams</span>
            <span className="saas-quick-sub">
              {teamsAccount?.connected ? 'Connected • Class Channels Synced' : 'Connect Teams Account'}
            </span>
          </div>
        </button>

        {/* Quick Action Pill 4: View OD Hours */}
        <button
          type="button"
          onClick={onOpenODModal || (() => navigateToAcademics('attendance'))}
          className="saas-quick-action-card"
        >
          <div className="saas-quick-icon-wrap bg-emerald-500/10 text-emerald-500">
            <Clock size={16} />
          </div>
          <div className="text-left">
            <span className="saas-quick-title">OD & Duty Leaves</span>
            <span className="saas-quick-sub">{approvedOdHours} hrs sanctioned • Quota ledger</span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          SECTION 5: UPCOMING COURSEWORK & DEADLINES
          ========================================================================= */}
      <div className="saas-section-card">
        <div className="saas-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-blue-500" />
            <h2 className="saas-card-title">Pending Coursework & Deadlines</h2>
            {pendingAssignments.length > 0 && (
              <span className="saas-badge-pill">{pendingAssignments.length} pending</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelectView?.('assignments')}
            className="saas-header-link"
          >
            <span>All Coursework</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="saas-assignments-list divide-y divide-border/40 mt-2">
          {pendingAssignments.length === 0 ? (
            <div className="saas-empty-box py-4">
              <CheckCircle2 size={20} className="text-emerald-500 mb-1" />
              <p className="saas-empty-title">All Coursework Completed</p>
              <p className="saas-empty-sub">No pending digital assignments or LMS submissions found.</p>
            </div>
          ) : (
            pendingAssignments.slice(0, 5).map((asg) => {
              const isTeams = isTeamsAssignment(asg);
              const isLms = Boolean(asg.source === 'LMS' || (asg as any).lmsCourseId);

              return (
                <div key={asg.id} className="saas-asg-row py-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleAssignment?.(asg.id, asg.status)}
                      className="saas-checkbox-btn"
                      title="Mark as completed"
                    >
                      <div className="saas-checkbox-box" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{asg.courseCode}</span>
                        <span className="text-xs text-foreground font-medium truncate">{asg.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>Due: {asg.dueDate || 'Ongoing evaluation'}</span>
                        <span>•</span>
                        <span className="truncate">{asg.faculty || 'Professor verified'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTeams && <span className="saas-source-tag teams">Teams</span>}
                    {isLms && <span className="saas-source-tag lms">LMS</span>}
                    {!isTeams && !isLms && <span className="saas-source-tag vtop">VTOP DA</span>}
                    <span className="saas-status-badge pending">Pending</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
