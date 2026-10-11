import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Percent,
  Calendar,
  Award,
  FileText,
  Users,
  BookOpen,
  RefreshCw,
  Mail,
  MapPin,
  ExternalLink,
  Search,
  ShieldCheck,
  Calculator,
  TrendingUp,
  Plus,
  Minus,
  Trash2,
  X,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ClipboardCheck,
  History,
  GraduationCap,
  Download,
  CheckSquare,
  BarChart2,
  Activity,
  Star,
  Layers,
} from 'lucide-react';
import {
  StudentProfile,
  Course,
  Attendance,
  Marks,
  Exam,
  Faculty,
  TimetableSlot,
  DayOfWeek,
  AllGradesResponse,
  SemesterGradeItem,
  CalendarResponse,
  ODResponse,
} from '../types';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';
import { getStudyMaterialUrl } from '../services/studyMaterialService';
import { CampusAnalytics } from '../services/analytics';
import { CampusAPI } from '../services/api';
import { ODHoursModal } from '../components/ODHoursModal';
import { CalendarModal } from '../components/CalendarModal';
import { CalendarView } from '../components/CalendarView';
import { CourseAttendanceDetailModal } from '../components/CourseAttendanceDetailModal';
import { WeeklyAttendanceSchedule } from '../components/WeeklyAttendanceSchedule';
import { OverallAttendancePredictorModal } from '../components/OverallAttendancePredictorModal';
import { SLOT_MAP } from '../services/slotMap';

export type AcademicsSubTab =
  | 'profile'
  | 'attendance'
  | 'calendar'
  | 'timetable'
  | 'marks'
  | 'exams'
  | 'grades'
  | 'faculty'
  | 'courses';

interface AcademicsViewProps {
  student: StudentProfile;
  courses?: Course[];
  attendance?: Attendance[];
  timetable?: TimetableSlot[];
  marks?: Marks[];
  exams?: Exam[];
  faculty?: Faculty[];
  onForceSync?: () => void;
  syncing?: boolean;
  initialSubTab?: AcademicsSubTab;
  odData?: ODResponse | null;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  student,
  courses = [],
  attendance = [],
  timetable = [],
  marks = [],
  exams = [],
  faculty = [],
  onForceSync,
  syncing = false,
  initialSubTab = 'profile',
  odData: externalOdData,
}) => {
  const getSubTabFromUrl = (): AcademicsSubTab => {
    if (typeof window === 'undefined') return initialSubTab;
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/academics/profile')) return 'profile';
    if (path.includes('/academics/attendance')) return 'attendance';
    if (path.includes('/academics/calendar') || path.includes('/calendar')) return 'calendar';
    if (path.includes('/academics/predictor')) return 'attendance';
    if (path.includes('/academics/timetable')) return 'timetable';
    if (path.includes('/academics/marks')) return 'marks';
    if (path.includes('/academics/exams')) return 'exams';
    if (path.includes('/academics/grades')) return 'grades';
    if (path.includes('/academics/faculty')) return 'faculty';
    if (path.includes('/academics/courses')) return 'courses';
    return initialSubTab;
  };

  const [activeTab, setActiveTab] = useState<AcademicsSubTab>(getSubTabFromUrl());

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // All Grades & CGPA Predictor states
  const [allGradesData, setAllGradesData] = useState<AllGradesResponse | null>(null);
  const [_loadingGrades, setLoadingGrades] = useState(false);
  const [activeGradeSem, setActiveGradeSem] = useState<string>('');
  const [openCourseModal, setOpenCourseModal] = useState<SemesterGradeItem | null>(null);
  useLockBodyScroll(Boolean(openCourseModal));
  const [predictedGrades, setPredictedGrades] = useState<Record<string, string>>({});
  const [extraSemesters, setExtraSemesters] = useState<Array<{ id: number; name: string; credits: number; gpa: number }>>([]);

  // Attendance Safety Engine states
  const [targetAttendance, setTargetAttendance] = useState<number>(75);
  const [simAttendedGlobalDelta, setSimAttendedGlobalDelta] = useState<number>(0);
  const [simMissedGlobalDelta, setSimMissedGlobalDelta] = useState<number>(0);
  const [courseSimulations, setCourseSimulations] = useState<Record<string, { attendedDelta: number; missedDelta: number }>>({});
  const [drilldownCourseCode, setDrilldownCourseCode] = useState<string | null>(null);

  // Marks Tab states
  const [isGpaPlannerOpen, setIsGpaPlannerOpen] = useState(false);
  const [targetGpaInput, setTargetGpaInput] = useState<number>(student?.cgpa ? Math.min(10, Math.round((Number(student.cgpa) + 0.2) * 100) / 100) : 9.00);
  const [cohortCurveMultiplier, setCohortCurveMultiplier] = useState<string>('Rigorous Curve (Mean 52% - CSE Specialization)');
  const [marksSearchQuery, setMarksSearchQuery] = useState('');

  // Attendance Tab states
  const [attendanceViewMode, setAttendanceViewMode] = useState<'cards' | 'weekly' | 'table'>('table');
  const [selectedAttDetail, setSelectedAttDetail] = useState<Attendance | null>(null);
  const [isPredictorModalOpen, setIsPredictorModalOpen] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);

  // OD Hours & Academic Calendar modal states
  const [isODModalOpen, setIsODModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarType, setCalendarType] = useState<string>('ALL');
  const [odData, setOdData] = useState<ODResponse | null>(externalOdData || null);

  useEffect(() => {
    if (externalOdData) {
      setOdData(externalOdData);
    }
  }, [externalOdData]);

  const handleCalendarFetch = async (fnCalendarType?: string) => {
    const typeToUse = fnCalendarType || calendarType || 'ALL';
    try {
      const semToUse = student?.semesterId || (student as any)?.semester || undefined;
      const data = await CampusAPI.getCalendar(semToUse, typeToUse);
      if (data && data.calendars && data.calendars.length > 0) {
        setCalendarData(data);
        setCalendarType(typeToUse);
      }
    } catch (err) {
      console.error('[AcademicsView] Failed to fetch calendar:', err);
    }
  };

  useEffect(() => {
    const loadCalendar = async () => {
      try {
        const semToUse = student?.semesterId || (student as any)?.semester || undefined;
        const data = await CampusAPI.getCalendar(semToUse);
        if (data && data.calendars) {
          setCalendarData(data);
        }
      } catch (err) {
        console.warn('[AcademicsView] Failed to fetch calendar:', err);
      }
    };
    const loadOD = async () => {
      try {
        const data = await CampusAPI.getOD();
        if (data && (data.records?.length || !externalOdData?.records?.length)) {
          setOdData(data);
        }
      } catch (err) {
        console.warn('[AcademicsView] Failed to fetch OD data:', err);
      }
    };
    loadCalendar();
    loadOD();
  }, [externalOdData]);

  const effectiveOdData = externalOdData ?? odData;
  const approvedOdHours = useMemo(() => {
    return (
      effectiveOdData?.approvedHours ??
      effectiveOdData?.usedHours ??
      (student as any)?.odHours ??
      (student as any)?.approvedOdHours ??
      0
    );
  }, [effectiveOdData, student]);

  const maxOdHours = effectiveOdData?.maxHours ?? effectiveOdData?.maxOdHours ?? 40;
  const remainingOdHours = Math.max(0, maxOdHours - approvedOdHours);

  const days: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'> = [
    'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
  ];

  const dayCardsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach((day) => (map[day] = []));

    if (timetable && timetable.length > 0) {
      timetable.forEach((t) => {
        const day = (t.day || '').toUpperCase() as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
        if (day && map[day]) {
          const matchingAtt = attendance.find((a) =>
            (a.courseCode && t.courseCode && a.courseCode.trim().toUpperCase() === t.courseCode.trim().toUpperCase())
          ) || attendance.find((a) =>
            (a.slot && t.slot && (a.slot === t.slot || a.slots?.includes(t.slot)))
          ) || attendance.find((a) =>
            a.courseTitle && t.courseTitle && a.courseTitle.trim().toLowerCase() === t.courseTitle.trim().toLowerCase()
          );
          const pct = matchingAtt?.percentage ?? matchingAtt?.attendancePercentage ?? 0;
          const cls = pct < 75 ? 'low' : pct < 85 ? 'medium' : 'high';
          map[day].push({
            ...t,
            ...(matchingAtt || {}),
            courseCode: t.courseCode,
            courseTitle: t.courseTitle,
            slotName: t.slot,
            time: `${t.startTime}-${t.endTime}`,
            cls,
          });
        }
      });
    } else {
      attendance.forEach((a) => {
        const slots: string[] = String(a.slots || a.slot || '').split('+');
        slots.forEach((slotName: string) => {
          const cleanSlot = slotName.trim();
          for (const day of days) {
            if (SLOT_MAP[day] && SLOT_MAP[day][cleanSlot]) {
              const info = SLOT_MAP[day][cleanSlot];
              const pct = a.percentage ?? a.attendancePercentage ?? 0;
              const cls = pct < 75 ? 'low' : pct < 85 ? 'medium' : 'high';
              map[day].push({
                ...a,
                courseCode: a.courseCode,
                courseTitle: a.courseTitle,
                slotName: cleanSlot,
                time: info.time,
                cls,
              });
            }
          }
        });
      });
    }

    const parseTime = (timeStr: string) => {
      if (!timeStr) return 0;
      const parts = timeStr.trim().split(':').map(Number);
      let h = parts[0] || 0;
      const m = parts[1] || 0;
      if (h >= 1 && h <= 7) h += 12;
      return h * 60 + m;
    };

    const getTimeRange = (time: string) => {
      if (!time || !time.includes('-')) return { start: 0, end: 0 };
      const [start, end] = time.split('-').map((t) => t.trim());
      return {
        start: parseTime(start),
        end: parseTime(end),
      };
    };

    for (const day of days) {
      if (!map[day]) map[day] = [];

      map[day].sort((a, b) => {
        const timeA = getTimeRange(a.time);
        const timeB = getTimeRange(b.time);
        if (timeA.start !== timeB.start) return timeA.start - timeB.start;
        return (a.slotName || '').localeCompare(b.slotName || '', undefined, { numeric: true });
      });

      const merged: any[] = [];
      for (let i = 0; i < map[day].length; i++) {
        const current = map[day][i];
        const next = map[day][i + 1];

        if (
          next &&
          (current.courseCode === next.courseCode || current.courseTitle === next.courseTitle) &&
          current.faculty === next.faculty
        ) {
          const currentRange = getTimeRange(current.time);
          const nextRange = getTimeRange(next.time);
          const gapInMinutes = nextRange.start - currentRange.end;

          if (gapInMinutes >= 0 && gapInMinutes <= 15) {
            const mergedSlotName = `${current.slotName}+${next.slotName}`;
            const mergedSlotTime = `${current.time.split('-')[0]}-${next.time.split('-')[1]}`;
            merged.push({
              ...current,
              slotName: mergedSlotName,
              time: mergedSlotTime,
            });
            i++;
          } else {
            merged.push(current);
          }
        } else {
          merged.push(current);
        }
      }

      merged.sort((a, b) => {
        const startA = parseTime(a.time.split('-')[0]);
        const startB = parseTime(b.time.split('-')[0]);
        return startA - startB;
      });

      map[day] = merged;
    }

    return map;
  }, [attendance, timetable]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam === 'od') {
        setIsODModalOpen(true);
      } else if (tabParam === 'calendar') {
        setIsCalendarModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    const loadGrades = async () => {
      setLoadingGrades(true);
      try {
        const data = await CampusAPI.getAllGrades();
        if (data && data.grades) {
          setAllGradesData(data);
          const sems = Object.keys(data.grades);
          if (sems.length > 0) {
            setActiveGradeSem(sems[sems.length - 1]);
          }
        }
      } catch (err) {
        console.warn('[AcademicsView] All grades fetch error:', err);
      } finally {
        setLoadingGrades(false);
      }
    };
    loadGrades();
  }, []);

  useEffect(() => {
    CampusAnalytics.trackEvent(`${activeTab}_viewed`, `/academics/${activeTab}`);
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getSubTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleTabChange = (tab: AcademicsSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const targetUrl = tab === 'profile' ? '/academics' : `/academics/${tab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  };

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
  const filteredSlots = timetable.filter((slot) => slot.day === selectedDay);

  const dayClassCounts: Record<DayOfWeek, number> = {
    MON: timetable.filter((s) => s.day === 'MON').length,
    TUE: timetable.filter((s) => s.day === 'TUE').length,
    WED: timetable.filter((s) => s.day === 'WED').length,
    THU: timetable.filter((s) => s.day === 'THU').length,
    FRI: timetable.filter((s) => s.day === 'FRI').length,
    SAT: timetable.filter((s) => s.day === 'SAT').length,
    SUN: timetable.filter((s) => s.day === 'SUN').length,
  };

  const dayTitles: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
  };

  const [examFilter, setExamFilter] = useState<'ALL' | 'CAT 1' | 'CAT 2' | 'FAT' | 'LAB FAT'>('ALL');
  const filteredExams = useMemo(() => {
    if (examFilter === 'ALL') return exams;
    return exams.filter((ex) => {
      const type = (ex.examType || ex.title || '').toUpperCase();
      if (examFilter === 'CAT 1') return type.includes('CAT 1') || type.includes('CAT-1') || type.includes('CAT1');
      if (examFilter === 'CAT 2') return type.includes('CAT 2') || type.includes('CAT-2') || type.includes('CAT2');
      if (examFilter === 'FAT') return (type.includes('FAT') || type.includes('FINAL')) && !type.includes('LAB');
      if (examFilter === 'LAB FAT') return type.includes('LAB') && (type.includes('FAT') || type.includes('FINAL'));
      return true;
    });
  }, [exams, examFilter]);
  // Track manual exam completion status overrides
  const [manualExamCompleted, setManualExamCompleted] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const reg = student?.regNo || 'default';
      const raw = localStorage.getItem(`campus_exam_completed_${reg}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const isExamDone = (ex: Exam, examKey: string): boolean => {
    if (manualExamCompleted[examKey] !== undefined) {
      return manualExamCompleted[examKey];
    }
    if ((ex as any).isCompleted || (ex as any).status === 'Completed' || (ex as any).status === 'Done') {
      return true;
    }
    const dateStr = ex.date;
    if (!dateStr) return false;
    try {
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) {
        return new Date(parsed).setHours(23, 59, 59, 999) < Date.now();
      }
      const parts = dateStr.trim().split(/[-/ ]+/);
      if (parts.length === 3) {
        const monthNames: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        let day = parseInt(parts[0], 10);
        let year = parseInt(parts[2], 10);
        let month = monthNames[parts[1].toLowerCase().slice(0, 3)];
        if (month === undefined && !isNaN(parseInt(parts[1], 10))) {
          month = parseInt(parts[1], 10) - 1;
        }
        if (year < 100) year += 2000;
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          const d = new Date(year, month, day, 23, 59, 59, 999);
          return d.getTime() < Date.now();
        }
      }
    } catch (e) {}
    return false;
  };

  const toggleExamCompleted = (examKey: string, currentDone: boolean) => {
    const next = !currentDone;
    setManualExamCompleted((prev) => {
      const updated = { ...prev, [examKey]: next };
      if (typeof window !== 'undefined') {
        try {
          const reg = student?.regNo || 'default';
          localStorage.setItem(`campus_exam_completed_${reg}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const [marksFilter, setMarksFilter] = useState<'ALL' | 'CAT 1' | 'CAT 2' | 'DA' | 'LAB' | 'FAT'>('ALL');
  const [courseSearch, setCourseSearch] = useState('');

  const filteredMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    return marks.filter((m) => {
      // 1. Search Query filter
      if (marksSearchQuery.trim()) {
        const q = marksSearchQuery.toLowerCase();
        const matchesCode = (m.courseCode || '').toLowerCase().includes(q);
        const matchesTitle = (m.courseTitle || m.courseName || '').toLowerCase().includes(q);
        const matchesFaculty = (m.faculty || m.facultyName || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesFaculty) return false;
      }
      // 2. Category filter
      if (marksFilter === 'ALL') return true;
      if (m.components && m.components.length > 0) {
        return m.components.some((c) => {
          const t = (c.title || '').toUpperCase();
          if (marksFilter === 'CAT 1') return t.includes('CAT 1') || t.includes('CAT-1') || t.includes('TEST - I') || t.includes('TEST 1');
          if (marksFilter === 'CAT 2') return t.includes('CAT 2') || t.includes('CAT-2') || t.includes('TEST - II') || t.includes('TEST 2');
          if (marksFilter === 'FAT') return t.includes('FAT') || t.includes('FINAL');
          if (marksFilter === 'DA') return t.includes('ASSIGNMENT') || t.includes('DA') || t.includes('QUIZ');
          if (marksFilter === 'LAB') return t.includes('LAB') || t.includes('PRACTICAL') || t.includes('VIVA');
          return true;
        });
      }
      if (marksFilter === 'CAT 1') return m.cat1 && m.cat1.scored !== null && m.cat1.scored !== undefined;
      if (marksFilter === 'CAT 2') return m.cat2 && m.cat2.scored !== null && m.cat2.scored !== undefined;
      if (marksFilter === 'FAT') return m.fat && m.fat.scored !== null && m.fat.scored !== undefined;
      if (marksFilter === 'DA') return Boolean(m.da1 || m.da2 || m.quiz || (m as any).quiz1 || (m as any).quiz2);
      if (marksFilter === 'LAB') return (m.courseCode || '').endsWith('P');
      return true;
    });
  }, [marks, marksFilter, marksSearchQuery]);

  const handleExportMarksCSV = () => {
    if (!marks || marks.length === 0) return;
    const headers = ['Course Code', 'Course Title', 'Faculty', 'CAT 1', 'CAT 2', 'FAT', 'Weightage Scored', 'Max Weightage'];
    const rows = marks.map((m) => [
      `"${m.courseCode || ''}"`,
      `"${m.courseTitle || m.courseName || ''}"`,
      `"${m.faculty || ''}"`,
      `"${m.cat1?.scored ?? ''}"`,
      `"${m.cat2?.scored ?? ''}"`,
      `"${m.fat?.scored ?? ''}"`,
      `"${m.weightageScored ?? ''}"`,
      `"${m.weightageGraded ?? m.weightageTotal ?? 15}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CampusOS_Marks_Ledger_${student.regNo || 'student'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navTabs: { id: AcademicsSubTab; label: string; icon: React.ComponentType<any>; count?: number | string }[] = [
    { id: 'profile', label: 'Profile', icon: User, count: student.regNo || undefined },
    { id: 'attendance', label: 'Attendance', icon: Percent, count: attendance.length ? `${attendance.length}` : undefined },
    { id: 'calendar', label: 'Academic Calendar', icon: CalendarDays, count: 'Semester' },
    { id: 'timetable', label: 'Timetable', icon: Calendar, count: timetable.length ? `${timetable.length} Slots` : undefined },
    { id: 'marks', label: 'Marks', icon: Award, count: marks.length ? `${marks.length}` : undefined },
    { id: 'exams', label: 'Exams', icon: FileText, count: exams.length ? `${exams.length}` : undefined },
    { id: 'grades', label: 'All Grades & CGPA', icon: TrendingUp, count: student.cgpa ? `${student.cgpa} CGPA` : undefined },
    { id: 'faculty', label: 'Faculty', icon: Users, count: faculty.length ? `${faculty.length}` : undefined },
    { id: 'courses', label: 'Courses & Study', icon: BookOpen, count: courses.length ? `${courses.length}` : undefined },
  ];

  return (
    <div className="page-container">
      {/* 1. Academics Hero Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <ShieldCheck size={14} />
              <span>VTOP ACADEMIC SYSTEM</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>{student.program || 'VIT Chennai'}</span>
            </div>
            <h2 className="hero-heading">Academics Command Center</h2>
            <p className="hero-desc">
              Authoritative university ledger for attendance thresholds, continuous assessments, faculty directory, and exam schedules.
            </p>
          </div>

          <button
            onClick={onForceSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Academic Data'}</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Segmented Navigation Bar */}
      <nav className="academic-nav-bar" role="tablist" aria-label="Academics Sub-navigation">
        {navTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              className={`academic-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.count && <span className="academic-nav-badge">{t.count}</span>}
            </button>
          );
        })}
      </nav>

      {/* 3. Sub-View Content */}

      {/* === 3.1 PROFILE SUB-TAB === */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
          <div className="card">
            <div className="card-header-bar">
              <h3 className="card-title">
                <User size={19} color="var(--accent-cyan)" />
                <span>Student Identity</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Full Name</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.name || 'Not available'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Registration Number</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '0.94rem' }}>
                  {student.regNo || 'Not available'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Degree &amp; Program</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.program || 'Not available'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Branch / School</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.branch || 'Not available'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Academic Batch</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.batch || 'Not available'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-bar">
              <h3 className="card-title">
                <Award size={19} color="var(--accent-blue)" />
                <span>Academic Progression</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Cumulative CGPA</span>
                <span style={{ fontWeight: 800, color: 'var(--success-emerald)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                  {student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Credits Completed</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem', fontFamily: 'var(--font-mono)' }}>
                  {student.creditsEarned !== null && student.creditsEarned !== undefined ? `${student.creditsEarned} Credits` : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Current Semester</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>Semester {student.semester || '1'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Proctor / Advisor</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{student.proctor?.name || 'Assigned by School'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.90rem' }}>Proctor Email</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.94rem' }}>{student.proctor?.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === 3.2 ATTENDANCE SUB-TAB (STITCH REDESIGN) === */}
      {activeTab === 'attendance' && (() => {
        const overallAtt = student?.overallAttendance;
        const canonicalOverallPct = overallAtt?.percentage !== null && overallAtt?.percentage !== undefined
          ? Number(overallAtt.percentage)
          : (attendance.length > 0
              ? Math.round(
                  (attendance.reduce((acc, c) => acc + (c.attended || c.classesAttended || 0), 0) /
                    Math.max(1, attendance.reduce((acc, c) => acc + (c.total || c.classesConducted || 0), 0))) * 1000
                ) / 10
              : 0);

        const baseAttended = overallAtt?.attended !== null && overallAtt?.attended !== undefined
          ? Number(overallAtt.attended)
          : attendance.reduce((acc, a) => acc + (a.attended ?? a.classesAttended ?? 0), 0);

        const baseConducted = overallAtt?.total !== null && overallAtt?.total !== undefined
          ? Number(overallAtt.total)
          : attendance.reduce((acc, a) => acc + (a.conducted ?? a.classesConducted ?? a.total ?? 0), 0);

        // Course-level simulations mapped
        const coursesWithSim = attendance.map((att) => {
          const code = att.courseCode || 'COURSE';
          const sim = courseSimulations[code] || { attendedDelta: 0, missedDelta: 0 };
          const cAttendedBase = att.attended ?? att.classesAttended ?? 0;
          const cConductedBase = att.conducted ?? att.classesConducted ?? att.total ?? 0;
          const cAttended = Math.max(0, cAttendedBase + sim.attendedDelta);
          const cConducted = Math.max(0, cConductedBase + sim.attendedDelta + sim.missedDelta);
          const cPct = cConducted > 0 ? Math.round((cAttended / cConducted) * 1000) / 10 : (att.percentage ?? att.attendancePercentage ?? 0);
          const targetRatio = targetAttendance / 100;
          const safeBunks = Math.max(0, Math.floor((cAttended - targetRatio * cConducted) / targetRatio));
          const recoveryNeeded = cPct < targetAttendance ? Math.ceil((targetRatio * cConducted - cAttended) / (1 - targetRatio)) : 0;
          const isLab = (att.courseCode || '').endsWith('P') || (att.courseType || '').toLowerCase().includes('lab');

          return {
            ...att,
            courseCode: code,
            simAttended: cAttended,
            simConducted: cConducted,
            simPct: cPct,
            safeBunks,
            recoveryNeeded,
            isLab,
            hasSim: sim.attendedDelta !== 0 || sim.missedDelta !== 0,
            attendedDelta: sim.attendedDelta,
            missedDelta: sim.missedDelta,
          };
        });

        const courseAttDelta = Object.values(courseSimulations).reduce((sum, s) => sum + (s.attendedDelta || 0), 0);
        const courseMissDelta = Object.values(courseSimulations).reduce((sum, s) => sum + (s.missedDelta || 0), 0);

        const totalSimAttended = baseAttended + courseAttDelta + simAttendedGlobalDelta;
        const totalSimConducted = baseConducted + courseAttDelta + courseMissDelta + simAttendedGlobalDelta + simMissedGlobalDelta;

        const hasActiveSimulation = (
          simAttendedGlobalDelta !== 0 ||
          simMissedGlobalDelta !== 0 ||
          courseAttDelta !== 0 ||
          courseMissDelta !== 0
        );

        const simOverallPct = hasActiveSimulation
          ? (totalSimConducted > 0 ? Math.round((totalSimAttended / totalSimConducted) * 1000) / 10 : canonicalOverallPct)
          : canonicalOverallPct;

        const headroom = Math.round((simOverallPct - targetAttendance) * 10) / 10;
        const totalRegisteredCourses = courses.length > 0 ? courses.length : attendance.length;

        const safeCoursesCount = coursesWithSim.filter((c) => c.simPct >= targetAttendance).length;
        const criticalCoursesCount = coursesWithSim.filter((c) => c.simPct < targetAttendance).length;
        const firstCriticalCourse = coursesWithSim.find((c) => c.simPct < targetAttendance) || coursesWithSim[0];
        const activeDrilldownCourse = coursesWithSim.find((c) => c.courseCode === drilldownCourseCode) || firstCriticalCourse;

        const handleSimulateCourse = (code: string, delta: 1 | -1) => {
          setCourseSimulations((prev) => {
            const cur = prev[code] || { attendedDelta: 0, missedDelta: 0 };
            if (delta === 1) {
              return { ...prev, [code]: { ...cur, attendedDelta: cur.attendedDelta + 1 } };
            } else {
              return { ...prev, [code]: { ...cur, missedDelta: cur.missedDelta + 1 } };
            }
          });
        };

        const handleResetSimulations = () => {
          setCourseSimulations({});
          setSimAttendedGlobalDelta(0);
          setSimMissedGlobalDelta(0);
        };

        return (
          <div className="flex flex-col w-full gap-space-lg">
            {/* TOP EDITORIAL HEADER & POLICY SWITCHER */}
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-outline-variant/20">
              <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-secondary-fixed/20 blur-3xl pointer-events-none" />
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md relative z-10">
                <div className="flex flex-col gap-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-sm uppercase tracking-wider font-semibold">
                      <ShieldCheck size={14} className="shrink-0" />
                      Regulatory Engine
                    </span>
                    <span className="font-tabular-data text-label-sm text-outline">VTOP API v4.2.8 • Strict {targetAttendance}.00% Clause</span>
                  </div>
                  <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
                    Attendance Safety Engine &amp; Margin Forecaster
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Predictive simulation model for institutional minimum-attendance guidelines. Calibrate your absence headroom across regular instruction, On-Duty buffers, and laboratory mandates.
                  </p>
                </div>

                {/* Policy Switcher & Sync Meta */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md shrink-0">
                  <div className="flex flex-col p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 shadow-sm">
                    <span className="font-label-sm text-label-sm text-outline px-2 pb-1 uppercase font-semibold">Target Baseline Cutoff</span>
                    <div className="inline-flex rounded-lg bg-surface-container p-0.5">
                      {[75, 80, 85, 90].map((cutoff) => {
                        const isCutoffActive = targetAttendance === cutoff;
                        return (
                          <button
                            key={cutoff}
                            onClick={() => setTargetAttendance(cutoff)}
                            className={`px-3 py-1.5 rounded font-label-md text-label-md transition-all font-semibold ${
                              isCutoffActive
                                ? 'bg-primary-container text-on-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {cutoff}% {cutoff === 75 ? 'Mandatory' : cutoff === 80 ? 'Safety Buffer' : cutoff === 85 ? 'Distinction' : 'Vanguard'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">Sync Active</span>
                      <span className="font-tabular-data text-label-sm text-outline">Direct Ledger Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AGGREGATE INTELLIGENCE STRIP (4 METRIC TILES) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
              {/* Overall Metric */}
              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Aggregate Attendance</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-primary font-bold tracking-tight">
                        {simOverallPct.toFixed(1)}%
                      </span>
                      <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded font-semibold ${
                        headroom >= 0 ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'
                      }`}>
                        {headroom >= 0 ? `+${headroom.toFixed(1)}% headroom` : `${headroom.toFixed(1)}% shortage`}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed/40 flex items-center justify-center text-primary">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 flex items-center justify-between font-tabular-data text-tabular-data text-on-surface-variant border-t border-outline-variant/10">
                  <span>{totalSimAttended} Attended / {totalSimConducted} Held</span>
                  <span className="text-secondary font-semibold">
                    {Math.max(0, totalSimConducted - totalSimAttended)} Classes Forfeited
                  </span>
                </div>
                {/* Tiny Sparkline SVG */}
                <svg className="w-full h-4 mt-2 text-primary opacity-60" preserveAspectRatio="none" viewBox="0 0 100 16">
                  <path d="M0,14 Q20,12 35,6 T65,8 T85,3 T100,2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </div>

              {/* Safe Band Courses */}
              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Safe Band Courses</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-on-surface font-bold">{safeCoursesCount}</span>
                      <span className="font-label-sm text-label-sm text-outline">/ {totalRegisteredCourses} registered</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                    <Layers size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full"
                      style={{ width: `${totalRegisteredCourses > 0 ? (safeCoursesCount / totalRegisteredCourses) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-tabular-data text-label-sm text-on-surface-variant">
                    <span>Well above {targetAttendance}% target cutoff</span>
                    <span className="font-semibold text-secondary">
                      {totalRegisteredCourses > 0 ? Math.round((safeCoursesCount / totalRegisteredCourses) * 100) : 0}% Coverage
                    </span>
                  </div>
                </div>
              </div>

              {/* Watchlist Margin Courses */}
              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Watchlist &amp; Caution</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-tertiary-container font-bold">
                        {criticalCoursesCount}
                      </span>
                      {criticalCoursesCount > 0 && firstCriticalCourse && (
                        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                          {firstCriticalCourse.courseCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/40 flex items-center justify-center text-tertiary">
                    <AlertTriangle size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-outline-variant/10">
                  <span>0 Debarred • {criticalCoursesCount} on Critical Edge</span>
                  <span className="text-tertiary font-semibold">
                    {criticalCoursesCount === 0 ? 'All Safe' : `Delta: ${firstCriticalCourse?.recoveryNeeded || 1} Abs. max`}
                  </span>
                </div>
              </div>

              {/* Approved OD Buffer Credit */}
              <div
                onClick={() => setIsODModalOpen(true)}
                className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col justify-between cursor-pointer hover:border-outline-variant/40 transition-colors"
                title="Click to view sanctioned On-Duty leave records"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Approved OD Allowance</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-on-surface font-bold">
                        {approvedOdHours}h
                      </span>
                      <span className="font-label-sm text-label-sm text-outline">/ {maxOdHours}h semester cap</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                    <ClipboardCheck size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${maxOdHours > 0 ? Math.min(100, (approvedOdHours / maxOdHours) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-tabular-data text-label-sm text-on-surface-variant">
                    <span>Approved Sanction Credit</span>
                    <span className="font-semibold text-primary">
                      {remainingOdHours}h Bank Remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN TWO-COLUMN WORKSPACE: MATRIX & FORECASTER */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
              {/* LEFT PANEL: COURSE MATRIX & REAL-TIME SIMULATOR (8 COLS) */}
              <div className="xl:col-span-8 flex flex-col gap-space-md">
                {/* Table Controls Bar */}
                <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-wrap items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Registered Roster Matrix</span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-tabular-data text-label-sm font-semibold">
                      {coursesWithSim.length} Courses Tracked
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View mode toggle */}
                    <div className="inline-flex rounded-lg bg-surface-container p-0.5 border border-outline-variant/20">
                      <button
                        onClick={() => setAttendanceViewMode('table')}
                        className={`px-2.5 py-1 rounded font-label-md text-label-md transition-all ${
                          attendanceViewMode === 'table' ? 'bg-primary-container text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Table
                      </button>
                      <button
                        onClick={() => setAttendanceViewMode('cards')}
                        className={`px-2.5 py-1 rounded font-label-md text-label-md transition-all ${
                          attendanceViewMode === 'cards' ? 'bg-primary-container text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Cards
                      </button>
                      <button
                        onClick={() => setAttendanceViewMode('weekly')}
                        className={`px-2.5 py-1 rounded font-label-md text-label-md transition-all ${
                          attendanceViewMode === 'weekly' ? 'bg-primary-container text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Weekly
                      </button>
                    </div>

                    {(Object.keys(courseSimulations).length > 0 || simAttendedGlobalDelta !== 0 || simMissedGlobalDelta !== 0) && (
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-label-md text-label-md text-outline hover:text-on-surface hover:bg-surface-container transition-all"
                        onClick={handleResetSimulations}
                      >
                        <RotateCcw size={14} className="shrink-0" />
                        <span>Reset Simulations</span>
                      </button>
                    )}

                    <div className="h-4 w-px bg-outline-variant/40" />

                    <button
                      onClick={() => setIsPredictorModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-all border border-outline-variant/20 shadow-sm"
                    >
                      <Calendar size={14} className="text-primary shrink-0" />
                      <span>Forecaster (Till CAT/FAT)</span>
                    </button>
                  </div>
                </div>

                {/* View rendering: Table, Cards, or Weekly */}
                {attendance.length === 0 ? (
                  <div className="rounded-xl bg-surface-container-lowest p-space-xl border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-3">
                    <CalendarDays size={36} className="text-outline" />
                    <h3 className="font-headline-sm text-on-surface">No Attendance Records Synced</h3>
                    <p className="font-body-md text-on-surface-variant max-w-md">Click "Sync Academic Data" to pull live institutional records from VTOP.</p>
                    <button onClick={onForceSync} disabled={syncing} className="btn btn-primary btn-sm mt-2">
                      {syncing ? 'Syncing...' : 'Sync Academic Data'}
                    </button>
                  </div>
                ) : attendanceViewMode === 'weekly' ? (
                  <div className="rounded-xl bg-surface-container-lowest p-space-md border border-outline-variant/20 shadow-sm">
                    <WeeklyAttendanceSchedule
                      dayCardsMap={dayCardsMap}
                      onSelectCourse={(att) => setSelectedAttDetail(att)}
                      targetAttendance={targetAttendance}
                    />
                  </div>
                ) : attendanceViewMode === 'cards' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                    {coursesWithSim.map((course, idx) => (
                      <div
                        key={course.courseCode || idx}
                        className={`p-space-md rounded-xl bg-surface-container-lowest border shadow-sm flex flex-col justify-between gap-4 transition-all ${
                          course.simPct < targetAttendance
                            ? 'border-error/40 bg-error/5'
                            : course.simPct < 80
                            ? 'border-tertiary-fixed bg-tertiary-fixed/10'
                            : 'border-outline-variant/20 hover:border-outline-variant/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                                {course.courseCode}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                                {course.isLab ? 'Lab • 1.5 Cr' : 'Theory • 3-4 Cr'}
                              </span>
                            </div>
                            <h4 className="font-body-sm font-semibold text-on-surface mt-1 truncate max-w-[220px]">
                              {course.courseTitle || course.courseName || 'Subject Title'}
                            </h4>
                            <span className="font-label-sm text-outline font-tabular-data block mt-0.5">
                              {course.slot || 'Regular'} • {course.facultyName || course.faculty || 'Professor'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`font-metric-display text-[26px] leading-tight font-bold font-tabular-data ${
                              course.simPct < targetAttendance ? 'text-error' : course.simPct < 80 ? 'text-tertiary' : 'text-primary'
                            }`}>
                              {course.simPct.toFixed(1)}%
                            </span>
                            <span className="font-label-sm text-outline block">Min {targetAttendance}%</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              course.simPct < targetAttendance ? 'bg-error' : course.simPct < 80 ? 'bg-tertiary' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, course.simPct))}%` }}
                          />
                        </div>

                        {/* Card bottom actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold ${
                            course.simPct >= targetAttendance ? 'bg-secondary-fixed/50 text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'
                          }`}>
                            {course.simPct >= targetAttendance ? (
                              <CheckCircle2 size={13} className="shrink-0" />
                            ) : (
                              <AlertTriangle size={13} className="shrink-0" />
                            )}
                            <span>
                              {course.simPct >= targetAttendance
                                ? `Can miss ${course.safeBunks} ${course.isLab ? 'labs' : 'classes'}`
                                : `Must attend ${course.recoveryNeeded} ${course.isLab ? 'labs' : 'classes'}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSimulateCourse(course.courseCode, 1)}
                              className="w-7 h-7 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface flex items-center justify-center transition-all shadow-sm"
                              title="Simulate Attend (+1)"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => handleSimulateCourse(course.courseCode, -1)}
                              className="w-7 h-7 rounded bg-surface-container hover:bg-tertiary-container hover:text-on-tertiary-container text-on-surface flex items-center justify-center transition-all shadow-sm"
                              title="Simulate Miss (-1)"
                            >
                              <Minus size={14} />
                            </button>
                            <button
                              onClick={() => setSelectedAttDetail(course)}
                              className="p-1 rounded text-outline hover:text-primary transition-colors ml-1"
                              title="View deep analysis"
                            >
                              <ExternalLink size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Data Table Card */
                  <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" id="coursesTable">
                        <thead>
                          <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider border-b border-outline-variant/20">
                            <th className="py-3 px-4 font-semibold">Course Code &amp; Faculty</th>
                            <th className="py-3 px-4 font-semibold text-center">Sessions</th>
                            <th className="py-3 px-4 font-semibold">Attendance Gauge</th>
                            <th className="py-3 px-4 font-semibold">Absence Margin</th>
                            <th className="py-3 px-4 font-semibold text-center">Simulate Next</th>
                            <th className="py-3 px-4 text-right">Log</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 font-body-md text-body-md">
                          {coursesWithSim.map((course, idx) => {
                            const isCritical = course.simPct < targetAttendance;
                            const isBorderline = !isCritical && course.simPct < 80;

                            return (
                              <tr
                                key={course.courseCode || idx}
                                className={`transition-colors group ${
                                  isCritical
                                    ? 'bg-error/5 hover:bg-error/10'
                                    : isBorderline
                                    ? 'bg-tertiary-fixed/15 hover:bg-tertiary-fixed/25'
                                    : 'hover:bg-surface-container-low/60'
                                }`}
                              >
                                <td className="py-3.5 px-4">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-headline-sm text-headline-sm font-semibold ${
                                        isCritical ? 'text-error' : isBorderline ? 'text-tertiary' : 'text-on-surface'
                                      }`}>
                                        {course.courseCode}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded font-label-sm text-label-sm ${
                                        course.isLab ? 'bg-secondary-fixed/60 text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'
                                      }`}>
                                        {course.isLab ? 'Lab • 1.5 Cr' : 'Theory • 4 Cr'}
                                      </span>
                                    </div>
                                    <span className="font-body-sm text-body-sm text-on-surface truncate max-w-xs font-medium">
                                      {course.courseTitle || course.courseName || 'Course Title'}
                                    </span>
                                    <span className="font-label-sm text-label-sm text-outline font-tabular-data">
                                      Slot {course.slot || 'Regular'} • {course.facultyName || course.faculty || 'Faculty'} {course.venue ? `(${course.venue})` : ''}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-center">
                                  <span className="font-tabular-data text-tabular-data font-semibold text-on-surface count-label">
                                    {course.simAttended} / {course.simConducted}
                                  </span>
                                  <div className="font-label-sm text-label-sm text-outline">Held to date</div>
                                </td>

                                <td className="py-3.5 px-4 w-44">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-baseline font-tabular-data text-label-md">
                                      <span className={`font-semibold ${
                                        isCritical ? 'text-error' : isBorderline ? 'text-tertiary' : 'text-primary'
                                      }`}>
                                        {course.simPct.toFixed(1)}%
                                      </span>
                                      <span className="text-outline font-normal text-label-sm">Min {targetAttendance}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isCritical ? 'bg-error' : isBorderline ? 'bg-tertiary' : 'bg-primary'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(0, course.simPct))}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-label-md text-label-md ${
                                    isCritical
                                      ? 'bg-error-container text-on-error-container font-semibold'
                                      : isBorderline
                                      ? 'bg-tertiary-fixed text-on-tertiary-fixed font-semibold'
                                      : 'bg-secondary-fixed/50 text-on-secondary-fixed font-semibold'
                                  }`}>
                                    {isCritical ? (
                                      <AlertTriangle size={14} className="text-error shrink-0" />
                                    ) : isBorderline ? (
                                      <AlertTriangle size={14} className="text-tertiary shrink-0" />
                                    ) : (
                                      <CheckCircle2 size={14} className="text-secondary shrink-0" />
                                    )}
                                    <span className="margin-text">
                                      {isCritical
                                        ? `Must attend ${course.recoveryNeeded} ${course.isLab ? 'labs' : 'classes'}`
                                        : `Can miss ${course.safeBunks} ${course.isLab ? 'labs' : 'classes'}`}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      className="w-8 h-8 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface flex items-center justify-center transition-all shadow-sm"
                                      onClick={() => handleSimulateCourse(course.courseCode, 1)}
                                      title="Simulate Attend (+1)"
                                    >
                                      <Plus size={14} />
                                    </button>
                                    <button
                                      className="w-8 h-8 rounded bg-surface-container hover:bg-tertiary-container hover:text-on-tertiary-container text-on-surface flex items-center justify-center transition-all shadow-sm"
                                      onClick={() => handleSimulateCourse(course.courseCode, -1)}
                                      title="Simulate Miss (-1)"
                                    >
                                      <Minus size={14} />
                                    </button>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    className="p-1 rounded text-outline hover:text-primary transition-colors"
                                    onClick={() => setDrilldownCourseCode(course.courseCode)}
                                    title="View audit drilldown"
                                  >
                                    <History size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ABSENCE DRILLDOWN DRAWER/CONTAINER (Interactive Expandable) */}
                {activeDrilldownCourse && (
                  <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm border border-outline-variant/20">
                    <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
                      <div className="flex items-center gap-2">
                        <Search size={18} className="text-secondary shrink-0" />
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          {activeDrilldownCourse.courseCode} Absence Log Drill-Down
                        </span>
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                          {Math.max(0, activeDrilldownCourse.simConducted - activeDrilldownCourse.simAttended)} Absences Registered
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedAttDetail(activeDrilldownCourse)}
                          className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <span>Full Modal View</span>
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                      {activeDrilldownCourse.viewLink && activeDrilldownCourse.viewLink.length > 0 ? (
                        activeDrilldownCourse.viewLink.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/10 flex flex-col gap-1.5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-label-sm text-label-sm text-outline font-tabular-data">{item.date}</span>
                              <span className="px-1.5 py-0.5 rounded bg-error/10 text-error font-label-sm text-label-sm font-semibold">
                                {item.status || 'Absent'}
                              </span>
                            </div>
                            <span className="font-body-sm text-body-sm text-on-surface font-medium">Session Recorded</span>
                            <span className="font-label-sm text-label-sm text-outline">Marked by {activeDrilldownCourse.facultyName || 'Faculty'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full p-4 rounded-lg bg-surface-container-low border border-outline-variant/10 text-center text-outline font-body-sm text-xs">
                          No individual session attendance exceptions or leave records published for this course in the official VTOP ledger.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: SEMESTER FORECASTER & ACADEMIC CALENDAR (4 COLS) */}
              <div className="xl:col-span-4 flex flex-col gap-space-md">
                {/* Editorial Forecaster Card */}
                <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Simulation Engine</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">End-of-Term Projection</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-primary-fixed/40 flex items-center justify-center text-primary">
                      <Activity size={18} />
                    </div>
                  </div>

                  {/* Forecaster Metric Box */}
                  <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-label-md text-label-md text-on-surface-variant font-medium">Projected Final Aggregate</span>
                      <span className="font-headline-lg text-headline-lg text-primary font-bold">
                        {Math.max(70, Math.min(100, Math.round((simOverallPct - 0.4) * 10) / 10)).toFixed(1)}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-outline">
                      Factoring remaining instructional hours, scheduled academic holidays, and current absence velocity.
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, simOverallPct - 0.4))}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPredictorModalOpen(true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded bg-primary text-on-primary font-label-md hover:bg-primary-container transition-colors shadow-sm font-semibold"
                  >
                    <Calendar size={18} />
                    <span>Launch Deep Calendar Forecaster</span>
                  </button>
                </div>

                {/* Key Calendar Milestones */}
                <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Upcoming Non-Instructional Days</span>
                    <button onClick={() => handleTabChange('calendar')} className="text-primary hover:underline font-label-sm font-medium">
                      View All
                    </button>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                    <div className="w-10 h-10 rounded bg-surface-container flex flex-col items-center justify-center shrink-0">
                      <span className="font-label-sm text-label-sm uppercase text-outline">Nov</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-none">01</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">Diwali Extended Break</span>
                      <span className="font-label-sm text-label-sm text-outline">Institutional Holiday • No classes scheduled</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                    <div className="w-10 h-10 rounded bg-surface-container flex flex-col items-center justify-center shrink-0">
                      <span className="font-label-sm text-label-sm uppercase text-outline">Nov</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-none">18</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">FAT Study &amp; Prep Leave</span>
                      <span className="font-label-sm text-label-sm text-outline">All classroom rosters frozen for assessments</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                    <div className="w-10 h-10 rounded bg-surface-container flex flex-col items-center justify-center shrink-0">
                      <span className="font-label-sm text-label-sm uppercase text-outline">Nov</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-none">25</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">Final Assessment Tests (FAT)</span>
                      <span className="font-label-sm text-label-sm text-outline">Hall Ticket Issuance gated at 75.00%</span>
                    </div>
                  </div>
                </div>

                {/* Academic Advisor Context Note */}
                <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">info</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">Pro-Vice Chancellor Rule 12(B)</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Failure to sustain ≥75% attendance forfeits internal continuous grading (CAT-1/CAT-2) eligibility and prompts systemic Course Debarment.
                    </span>
                  </div>
                </div>

                {/* Campus Image Card */}
                <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm h-48 group">
                  <div
                    className="bg-cover bg-center w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                    style={{
                      backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAlOexSxdVUD8gAplaB6X9vrMA-UIesdTORjuAtWGZRr2jCLItup-zr4avL4TOoELaTf6o7nNEAHIFzpLD_nDt-kNu2vXfmwlpL1RdzayTQcP-fRallg-RojshWhZurXZzCElE-yBDtg7SdV-G3DH1e9uBLCqrYjEvL_uQ_WFpdqDp-5AvuqaONWYKmxnpie66TfMkCP-YPouTBtacPnWbaklBPlxmlpc_2zzg2gYAjV81PO7Ht2iE')`,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-inverse-surface/30 to-transparent flex flex-col justify-end p-space-md text-inverse-on-surface">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider opacity-80">CampusOS Study Environment</span>
                    <span className="font-headline-sm text-headline-sm font-semibold">Central Library &amp; Analytical Lab 4</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Attendance Detail & Simulator Modal (PopupCard from CampusOS) */}
            <CourseAttendanceDetailModal
              isOpen={selectedAttDetail !== null}
              onClose={() => setSelectedAttDetail(null)}
              course={selectedAttDetail}
              dayCardsMap={dayCardsMap}
              calendars={calendarData?.calendars}
              targetAttendance={targetAttendance}
            />
          </div>
        );
      })()}

      {/* === 3.3 TIMETABLE SUB-TAB === */}
      {activeTab === 'timetable' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Calendar size={19} color="var(--accent-cyan)" />
                <span>Weekly Timetable Schedule ({dayTitles[selectedDay]})</span>
              </h3>
              <p className="card-description">Official VTOP slot allocations, classroom venues, and faculty assignments.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="View university monthly instructional days and holidays calendar"
              >
                <Calendar size={14} />
                <span>Academic Calendar</span>
              </button>
              <WeekSelector
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                dayClassCounts={dayClassCounts}
              />
            </div>
          </div>

          {filteredSlots.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Calendar size={26} />
              </div>
              <div className="empty-state-title">No scheduled classes for {dayTitles[selectedDay]}</div>
              <p className="empty-state-desc">No academic routine scheduled on this day.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredSlots.map((slot, idx) => (
                <TimetableSlotCard key={slot.id || idx} slot={slot} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 3.4 MARKS SUB-TAB (STITCH REDESIGN) === */}
      {activeTab === 'marks' && (() => {
        const currentCgpa = student.cgpa !== null && student.cgpa !== undefined && !isNaN(Number(student.cgpa)) ? Number(student.cgpa) : 0;
        const targetGpa = targetGpaInput || 9.00;
        const gpaDelta = Math.max(0, Math.round((targetGpa - currentCgpa) * 100) / 100);

        // Count assessments evaluated
        let totalAssessments = 0;
        let evaluatedCount = 0;
        marks.forEach((m) => {
          if (m.components && m.components.length > 0) {
            totalAssessments += m.components.length;
            evaluatedCount += m.components.filter((c) => c.scored !== null && c.scored !== undefined).length;
          } else {
            totalAssessments += 3;
            if (m.cat1?.scored !== null && m.cat1?.scored !== undefined) evaluatedCount++;
            if (m.cat2?.scored !== null && m.cat2?.scored !== undefined) evaluatedCount++;
            if (m.fat?.scored !== null && m.fat?.scored !== undefined) evaluatedCount++;
          }
        });
        const evaluatedPct = totalAssessments > 0 ? Math.round((evaluatedCount / totalAssessments) * 1000) / 10 : 50.0;

        let totalScoredWeightage = 0;
        let totalGradedWeightage = 0;
        marks.forEach((m) => {
          if (m.components && m.components.length > 0) {
            m.components.forEach((c) => {
              if (c.scored !== null && c.scored !== undefined && c.weightage !== undefined && c.weightage !== null) {
                totalScoredWeightage += c.weightage;
                totalGradedWeightage += c.maxWeightage || c.max || 15;
              }
            });
          } else if (m.weightageScored !== undefined && m.weightageScored !== null) {
            totalScoredWeightage += m.weightageScored;
            totalGradedWeightage += m.weightageGraded || m.weightageTotal || 15;
          } else if (m.cat1?.scored !== null && m.cat1?.scored !== undefined) {
            totalScoredWeightage += m.cat1.weightage || ((m.cat1.scored / (m.cat1.max || 50)) * 15);
            totalGradedWeightage += 15;
          }
        });

        // Find top performing course
        const topCourse = marks.reduce((best, cur) => {
          const curScore = cur.weightageScored ?? (cur.cat1?.scored ? (cur.cat1.scored / (cur.cat1.max || 50)) * 15 : 0);
          const bestScore = best ? (best.weightageScored ?? (best.cat1?.scored ? (best.cat1.scored / (best.cat1.max || 50)) * 15 : 0)) : 0;
          return curScore > bestScore ? cur : best;
        }, marks[0] || null);

        // Required FAT score computation
        const requiredFatScore = Math.min(100, Math.max(50, Math.round((70 + gpaDelta * 45) * 10) / 10));
        const requiredFatScaled = Math.round((requiredFatScore * 0.4) * 10) / 10;

        return (
          <div className="flex flex-col w-full space-y-space-lg">
            {/* Top Utility Bar: Semester Context & Strategic Tooling */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
              <div className="flex items-center gap-space-md flex-wrap">
                <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant/20">
                  <GraduationCap size={18} className="text-primary shrink-0" />
                  <select
                    className="bg-transparent font-headline-sm text-headline-sm text-on-surface focus:outline-none cursor-pointer font-semibold"
                    defaultValue="fall-26"
                  >
                    <option value="fall-26">Fall Semester 2026-27</option>
                    <option value="winter-25">Winter Semester 2025-26</option>
                    <option value="fall-25">Fall Semester 2025-26</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
                  <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                  <span>VTOP Sync: Real-Time Active Ledger</span>
                </div>

                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container text-on-surface font-label-md text-label-md border border-outline-variant/20">
                  <BookOpen size={16} />
                  <span>Reg 2024-Relative Scale</span>
                </div>
              </div>

              <div className="flex items-center gap-space-sm flex-wrap">
                <button
                  onClick={() => setIsGpaPlannerOpen(!isGpaPlannerOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg transition-colors shadow-sm font-semibold"
                >
                  <Calculator size={18} />
                  <span>{isGpaPlannerOpen ? 'Hide FAT Goals' : 'Simulate CGPA / FAT Goals'}</span>
                </button>

                <button
                  onClick={handleExportMarksCSV}
                  className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/20"
                  title="Export Ledger as CSV"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>

            {/* Metric Snapshot Row (Bento Style 4 tiles) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              {/* Cumulative GPA Projection */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Projected CGPA</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-on-surface font-tabular-data font-bold">
                        {currentCgpa.toFixed(2)}
                      </span>
                      <span className="font-label-md text-label-md text-on-surface-variant">/ 10.00</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed/50 flex items-center justify-center text-primary">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 bg-surface-container-low -mx-space-md -mb-space-md px-space-md py-2 flex items-center justify-between border-t border-outline-variant/10">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Goal: {targetGpa.toFixed(2)} Magna Cum Laude</span>
                  <span className="font-label-sm text-label-sm text-primary font-semibold font-tabular-data">
                    {gpaDelta > 0 ? `Δ +${gpaDelta.toFixed(2)} needed` : 'Goal Achieved'}
                  </span>
                </div>
              </div>

              {/* Evaluated Weightage Status */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Evaluated Cycle</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-on-surface font-tabular-data font-bold">
                        {evaluatedPct.toFixed(1)}%
                      </span>
                      <span className="font-label-md text-label-md text-outline">Complete</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                    <CheckSquare size={20} />
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${evaluatedPct}%` }} />
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-tabular-data">
                    {evaluatedCount} of {totalAssessments || 28} Assessments Recorded
                  </span>
                </div>
              </div>

              {/* Top Scored Course */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Apex Performance</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface mt-1 truncate max-w-[190px] font-semibold">
                      {topCourse?.courseTitle || topCourse?.courseName || 'Adv. Cloud Computing'}
                    </span>
                    <span className="font-tabular-data text-tabular-data text-on-surface-variant mt-0.5">
                      {topCourse?.courseCode || '--'} • {topCourse?.courseTitle || 'All Courses'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
                    <Award size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 bg-surface-container-low -mx-space-md -mb-space-md px-space-md py-2 flex items-center justify-between border-t border-outline-variant/10">
                  <span className="font-label-sm text-label-sm text-secondary font-semibold font-tabular-data">
                    {topCourse?.weightageScored !== undefined && topCourse?.weightageScored !== null ? `${topCourse.weightageScored.toFixed(1)} / ${(topCourse.weightageGraded || 15).toFixed(1)} Pts` : 'Recorded'}
                  </span>
                  <span className="font-label-sm text-label-sm bg-secondary-container/40 text-on-secondary-container px-1.5 py-0.5 rounded font-semibold">
                    Top Assessment
                  </span>
                </div>
              </div>

              {/* Assessment Score Average */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Internal Score Average</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-metric-display text-metric-display text-primary font-tabular-data font-bold">
                        {totalGradedWeightage > 0 ? `${((totalScoredWeightage / totalGradedWeightage) * 100).toFixed(1)}%` : '--'}
                      </span>
                      <span className="font-label-md text-label-md text-outline">Recorded</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed/40 flex items-center justify-center text-primary">
                    <BarChart2 size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 bg-surface-container-low -mx-space-md -mb-space-md px-space-md py-2 flex items-center justify-between border-t border-outline-variant/10">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Continuous Assessment Weight</span>
                  <span className="font-label-sm text-label-sm text-primary font-semibold font-tabular-data">
                    {totalScoredWeightage.toFixed(1)} / {totalGradedWeightage.toFixed(1)} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Simulator Drawer / Modal (Calibrated Target CGPA & FAT Goal Planner) */}
            {isGpaPlannerOpen && (
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/20 transition-all">
                <div className="flex items-center justify-between pb-3 bg-surface-container-low -mx-space-lg -mt-space-lg px-space-lg py-3 rounded-t-xl border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <Activity size={22} className="text-primary shrink-0" />
                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Target CGPA &amp; Final Assessment Theory (FAT) Goal Planner
                      </h2>
                      <span className="font-label-sm text-label-sm text-outline">
                        Calibrated against Target CGPA Requirements
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGpaPlannerOpen(false)}
                    className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg mt-space-md">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-label-md text-on-surface-variant font-medium">Desired Target CGPA</label>
                    <div className="flex items-center bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/20">
                      <input
                        className="bg-transparent font-metric-display text-metric-display text-primary w-full focus:outline-none font-tabular-data font-bold"
                        step="0.05"
                        type="number"
                        min="5.0"
                        max="10.0"
                        value={targetGpaInput}
                        onChange={(e) => setTargetGpaInput(parseFloat(e.target.value) || 9.0)}
                      />
                      <span className="font-label-lg text-label-lg text-outline">Scale 10</span>
                    </div>
                    <span className="font-body-sm text-body-sm text-outline">Magna Cum Laude benchmark requires ≥ 9.00 without arrears.</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-label-md text-on-surface-variant font-medium">Target Letter Grade Tier</label>
                    <select
                      value={cohortCurveMultiplier}
                      onChange={(e) => setCohortCurveMultiplier(e.target.value)}
                      className="bg-surface-container text-on-surface px-3 py-3 rounded-lg font-label-md text-label-md focus:outline-none border border-outline-variant/20 cursor-pointer"
                    >
                      <option value="S Grade (10.0 GP • Outstanding)">S Grade (10.0 GP • Outstanding)</option>
                      <option value="A Grade (9.0 GP • Excellent)">A Grade (9.0 GP • Excellent)</option>
                      <option value="B Grade (8.0 GP • Very Good)">B Grade (8.0 GP • Very Good)</option>
                      <option value="C Grade (7.0 GP • Good)">C Grade (7.0 GP • Good)</option>
                    </select>
                    <span className="font-body-sm text-body-sm text-outline">Standard VIT 10-point academic grading scale.</span>
                  </div>

                  <div className="bg-surface-container p-space-md rounded-xl border border-outline-variant/20 flex flex-col justify-between">
                    <div>
                      <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Required Avg FAT Score</span>
                      <div className="font-metric-display text-metric-display text-primary font-tabular-data font-bold mt-1">
                        {requiredFatScore} <span className="font-label-md text-label-md text-on-surface-variant font-normal">/ 100</span>
                      </div>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                      Maintaining current internal score requires{' '}
                      <span className="text-primary font-semibold font-tabular-data">{requiredFatScaled} / 50 (FAT 40% weightage)</span> on final written examinations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Assessment Category Tabs */}
            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20">
              <button
                onClick={() => setMarksFilter('ALL')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md font-semibold transition-all shrink-0 flex items-center gap-2 ${
                  marksFilter === 'ALL'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${marksFilter === 'ALL' ? 'bg-primary' : 'bg-outline'}`} />
                <span>All Continuous Assessments</span>
                <span className="font-tabular-data bg-primary-fixed text-on-primary-fixed px-1.5 py-0.5 rounded text-[11px]">
                  {marks.length}
                </span>
              </button>

              <button
                onClick={() => setMarksFilter('CAT 1')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors ${
                  marksFilter === 'CAT 1' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                CAT 1 Examinations
              </button>

              <button
                onClick={() => setMarksFilter('CAT 2')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors ${
                  marksFilter === 'CAT 2' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                CAT 2 Examinations
              </button>

              <button
                onClick={() => setMarksFilter('DA')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors ${
                  marksFilter === 'DA' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                Digital Assignments (DA)
              </button>

              <button
                onClick={() => setMarksFilter('LAB')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors ${
                  marksFilter === 'LAB' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                Lab Assessments &amp; Practicals
              </button>

              <button
                onClick={() => setMarksFilter('FAT')}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors ${
                  marksFilter === 'FAT' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                Final FAT Weightage
              </button>
            </div>

            {/* Interactive Ledger Table Container */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden">
              {/* Table Sub-toolbar */}
              <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface-container-low border-b border-outline-variant/10">
                <div className="flex items-center gap-space-sm w-full sm:w-auto">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Registered Assessments Matrix</span>
                  <span className="bg-secondary-fixed text-on-secondary-fixed text-[11px] font-semibold px-2 py-0.5 rounded-full font-tabular-data">
                    {filteredMarks.length} Enrolled Courses
                  </span>
                </div>

                <div className="flex items-center gap-space-sm w-full sm:w-auto justify-end">
                  <div className="relative w-full sm:w-72">
                    <Search size={16} className="text-outline absolute left-3 top-2.5" />
                    <input
                      value={marksSearchQuery}
                      onChange={(e) => setMarksSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-lowest rounded-lg pl-9 pr-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none border border-outline-variant/20"
                      placeholder="Filter code, faculty, type..."
                      type="text"
                    />
                  </div>
                </div>
              </div>

              {filteredMarks.length === 0 ? (
                <div className="p-space-xl text-center flex flex-col items-center justify-center gap-2">
                  <Star size={36} className="text-outline" />
                  <span className="font-headline-sm text-on-surface font-semibold">No Assessments Found</span>
                  <p className="font-body-md text-on-surface-variant">No marks records matching your filter parameters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container text-outline font-label-sm text-label-sm uppercase tracking-wider border-b border-outline-variant/20">
                        <th className="py-3 px-space-md font-semibold">Course Code &amp; Title</th>
                        <th className="py-3 px-space-md font-semibold">Credits / Type</th>
                        <th className="py-3 px-space-md font-semibold">Faculty</th>
                        <th className="py-3 px-space-md font-semibold">Assessment Details</th>
                        <th className="py-3 px-space-md text-right font-semibold">Max</th>
                        <th className="py-3 px-space-md text-right font-semibold">Scored</th>
                        <th className="py-3 px-space-md text-right font-semibold">Weightage (Scaled)</th>
                        <th className="py-3 px-space-md font-semibold">Percentile / Benchmark</th>
                        <th className="py-3 px-space-md text-center font-semibold">Rubric Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface font-body-md text-body-md">
                      {filteredMarks.map((courseMark, idx) => {
                        const isLab = (courseMark.courseCode || '').endsWith('P');
                        const components = (courseMark.components && courseMark.components.length > 0)
                          ? courseMark.components
                          : (courseMark.cat1 ? [{
                              title: 'Continuous Assessment Test - I',
                              scored: courseMark.cat1.scored,
                              max: courseMark.cat1.max || 50.0,
                              weightage: courseMark.cat1.weightage,
                              maxWeightage: 15.0,
                              average: null,
                              status: 'Published',
                            }] : []);

                        const firstComp = components[0] || null;
                        const subComponents = components.slice(1);

                        return (
                          <React.Fragment key={courseMark.id || courseMark.courseCode || idx}>
                            {/* Course Primary Row (First Assessment Component or Summary) */}
                            <tr className="hover:bg-surface-container-low transition-colors group">
                              <td className="py-3 px-space-md font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-6 rounded bg-primary" />
                                  <div>
                                    <div className="font-headline-sm text-headline-sm text-primary font-semibold">
                                      {courseMark.courseCode}
                                    </div>
                                    <div className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-xs">
                                      {courseMark.courseTitle || courseMark.courseName}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-space-md">
                                <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm font-semibold">
                                  {isLab ? '1.5 Cr • Lab' : '4.0 Cr • Theory'}
                                </span>
                              </td>

                              <td className="py-3 px-space-md text-on-surface-variant font-label-md text-label-md">
                                {courseMark.faculty || courseMark.facultyName || 'Professor'}
                              </td>

                              <td className="py-3 px-space-md">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-label-md text-label-md font-semibold">
                                    {firstComp ? firstComp.title : 'Continuous Assessment'}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-space-md text-right font-tabular-data text-outline">
                                {firstComp?.max !== undefined && firstComp?.max !== null ? firstComp.max.toFixed(1) : '-'}
                              </td>

                              <td className="py-3 px-space-md text-right font-tabular-data font-semibold text-on-surface">
                                {firstComp?.scored !== null && firstComp?.scored !== undefined ? firstComp.scored.toFixed(1) : '-'}
                              </td>

                              <td className="py-3 px-space-md text-right font-tabular-data">
                                {firstComp?.weightage !== undefined && firstComp?.weightage !== null ? (
                                  <>
                                    <span className="text-primary font-semibold">
                                      {firstComp.weightage.toFixed(1)}
                                    </span>
                                    <span className="text-outline text-label-sm font-label-sm">
                                      {' '}/ {(firstComp.maxWeightage || firstComp.max || 15).toFixed(1)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-outline">-</span>
                                )}
                              </td>

                              <td className="py-3 px-space-md">
                                {firstComp?.average !== null && firstComp?.average !== undefined ? (
                                  <div className="flex items-center gap-2 font-tabular-data text-body-sm">
                                    <span className="text-secondary font-medium">Class Avg: {firstComp.average.toFixed(1)}</span>
                                  </div>
                                ) : (
                                  <span className="text-outline text-body-sm font-tabular-data">-</span>
                                )}
                              </td>

                              <td className="py-3 px-space-md text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary-fixed/40 text-on-primary-fixed font-label-sm text-label-sm font-medium">
                                  <CheckCircle2 size={13} className="shrink-0" />
                                  {firstComp?.status || 'Published'}
                                </span>
                              </td>
                            </tr>

                            {/* Sub-rows for Remaining Components (DAs, Quizzes, Other Assessments) */}
                            {subComponents.map((comp, sIdx) => (
                              <tr key={sIdx} className="hover:bg-surface-container-low transition-colors bg-surface-container-lowest/50">
                                <td className="py-2 px-space-md pl-10 text-outline font-label-sm text-label-sm">
                                  └ Assessment item
                                </td>
                                <td className="py-2 px-space-md text-outline font-label-sm text-label-sm">
                                  Evaluation Component
                                </td>
                                <td className="py-2 px-space-md text-on-surface-variant font-label-md text-label-md">
                                  {courseMark.faculty || courseMark.facultyName || '--'}
                                </td>
                                <td className="py-2 px-space-md">
                                  <span className="font-label-md text-label-md">{comp.title}</span>
                                </td>
                                <td className="py-2 px-space-md text-right font-tabular-data text-outline">
                                  {comp.max !== undefined && comp.max !== null ? comp.max.toFixed(1) : '-'}
                                </td>
                                <td className="py-2 px-space-md text-right font-tabular-data font-semibold text-primary">
                                  {comp.scored !== null && comp.scored !== undefined ? comp.scored.toFixed(1) : '-'}
                                </td>
                                <td className="py-2 px-space-md text-right font-tabular-data">
                                  {comp.weightage !== undefined && comp.weightage !== null ? (
                                    <>
                                      <span className="text-primary font-semibold">
                                        {comp.weightage.toFixed(1)}
                                      </span>
                                      <span className="text-outline text-label-sm font-label-sm">
                                        {' '}/ {(comp.maxWeightage || comp.max || 10).toFixed(1)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-outline">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-space-md">
                                  {comp.average !== null && comp.average !== undefined ? (
                                    <span className="font-tabular-data text-body-sm text-secondary font-medium">
                                      Class Avg: {comp.average.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="font-tabular-data text-body-sm text-outline">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-space-md text-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary-fixed/40 text-on-primary-fixed font-label-sm text-label-sm font-medium">
                                    <ShieldCheck size={13} className="shrink-0" />
                                    {comp.status || 'Verified'}
                                  </span>
                                </td>
                              </tr>
                            ))}

                            {/* Cumulative Summary Row for Course */}
                            {courseMark.weightageScored !== undefined && courseMark.weightageScored !== null && (
                              <tr className="bg-surface-container-high/40 font-semibold border-b border-outline-variant/20">
                                <td className="py-2.5 px-space-md text-right font-label-sm text-label-sm text-on-surface-variant" colSpan={6}>
                                  {courseMark.courseCode} Cumulative Internal Score To Date:
                                </td>
                                <td className="py-2.5 px-space-md text-right font-tabular-data text-primary">
                                  {courseMark.weightageScored.toFixed(1)}{' '}
                                  <span className="text-outline font-normal">/ {(courseMark.weightageGraded || courseMark.weightageTotal || 15).toFixed(1)}</span>
                                </td>
                                <td className="py-2.5 px-space-md text-left font-label-sm text-label-sm text-on-surface-variant" colSpan={2}>
                                  {courseMark.weightageGraded && courseMark.weightageGraded > 0
                                    ? `${((courseMark.weightageScored / courseMark.weightageGraded) * 100).toFixed(1)}% scored of evaluated weight`
                                    : 'Recorded in active ledger'}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Individual Evaluation Breakdown Cards (Responsive Card Matrix) */}
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">grading</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Course Component Rubric Breakdown
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
                {filteredMarks.map((courseMark, cIdx) => (
                  <div
                    key={courseMark.id || cIdx}
                    className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col justify-between gap-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-label-sm text-label-sm font-bold text-primary font-tabular-data">
                          {courseMark.courseCode}
                        </span>
                        <h5 className="font-headline-sm text-headline-sm font-semibold text-on-surface mt-0.5 truncate max-w-[220px]">
                          {courseMark.courseTitle || courseMark.courseName}
                        </h5>
                        {courseMark.faculty && (
                          <span className="font-label-sm text-label-sm text-outline block mt-0.5">
                            {courseMark.faculty}
                          </span>
                        )}
                      </div>

                      {courseMark.weightageScored !== undefined && (
                        <div className="text-right">
                          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline block font-semibold">Weightage</span>
                          <span className="font-metric-display text-[22px] font-bold text-primary font-tabular-data">
                            {courseMark.weightageScored}{' '}
                            <span className="font-label-sm text-outline font-normal">/ {courseMark.weightageGraded || 15}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {courseMark.components && courseMark.components.length > 0 ? (
                      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
                        {courseMark.components.map((comp, k) => {
                          const pct = comp.scored !== null && comp.max ? Math.round((comp.scored / comp.max) * 100) : 0;
                          return (
                            <div key={k} className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/10">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-label-md text-label-md font-semibold text-on-surface">
                                  {comp.title}
                                </span>
                                <span className="font-tabular-data font-semibold text-primary text-label-md">
                                  {comp.scored !== null ? comp.scored : '-'} <span className="text-outline font-normal">/ {comp.max}</span>
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                              </div>
                              {comp.weightage !== undefined && (
                                <div className="flex justify-between font-label-sm text-label-sm text-outline mt-1 font-tabular-data">
                                  <span>Scaled: {comp.weightage} / {comp.maxWeightage || 15}</span>
                                  <span>{comp.status || 'Graded'}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="font-body-sm text-body-sm text-outline italic pt-2 border-t border-outline-variant/10">
                        No individual component evaluations published yet.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* === 3.5 EXAMS SUB-TAB === */}
      {activeTab === 'exams' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <FileText size={19} color="var(--accent-purple)" />
                <span>Examination Schedule</span>
              </h3>
              <p className="card-description">Official university examination timetables, seat venues, and reporting timings.</p>
            </div>

            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value as any)}
              className="custom-select-control"
              style={{ minWidth: '180px' }}
            >
              <option value="ALL">All Examinations</option>
              <option value="CAT 1">CAT 1 Exams</option>
              <option value="CAT 2">CAT 2 Exams</option>
              <option value="FAT">FAT (Finals)</option>
              <option value="LAB FAT">Lab FATs</option>
            </select>
          </div>

          {filteredExams.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <FileText size={26} />
              </div>
              <div className="empty-state-title">No Exams Found</div>
              <p className="empty-state-desc">No examination schedules published under the selected filter.</p>
            </div>
          ) : (
            <div className="table-responsive-wrapper">
              <table className="academic-data-table table-exams">
                <thead>
                  <tr>
                    <th style={{ minWidth: '95px' }}>Exam Type</th>
                    <th style={{ minWidth: '95px' }}>Course Code</th>
                    <th style={{ minWidth: '170px' }}>Course Title</th>
                    <th style={{ minWidth: '110px' }}>Exam Date</th>
                    <th style={{ minWidth: '95px' }}>Time</th>
                    <th style={{ minWidth: '115px' }}>Venue</th>
                    <th style={{ minWidth: '85px', textAlign: 'center' }}>Row</th>
                    <th style={{ minWidth: '85px', textAlign: 'center' }}>Column</th>
                    <th style={{ minWidth: '85px', textAlign: 'center' }}>Seat No.</th>
                    <th style={{ minWidth: '95px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((ex, idx) => {
                    const extractRowCol = (seatLoc?: string | null): { row?: string; column?: string } => {
                      if (!seatLoc) return {};
                      const text = String(seatLoc).slice(0, 100).trim();
                      const mRow = text.match(/\b(?:Row|R)\s*[:#-]?\s*([A-Za-z0-9]{1,10})\b/i);
                      const mCol = text.match(/\b(?:Column|Col|C)\s*[:#-]?\s*([A-Za-z0-9]{1,10})\b/i);
                      return {
                        row: mRow ? mRow[1] : undefined,
                        column: mCol ? mCol[1] : undefined,
                      };
                    };

                    const derived = extractRowCol(ex.seatLocation);
                    const rowVal = ex.row ?? ex.seatRow ?? derived.row;
                    const colVal = ex.column ?? ex.seatColumn ?? derived.column;
                    const seatNum = ex.seatNumber;

                    const examKey = `${ex.courseCode || ''}-${ex.examType || ''}-${ex.date || ''}-${idx}`;
                    const isDone = isExamDone(ex, examKey);

                    return (
                      <tr key={idx} className={isDone ? 'exam-row-completed' : ''} style={isDone ? { opacity: 0.6 } : undefined}>
                        <td style={isDone ? { textDecoration: 'line-through', textDecorationColor: 'rgba(239, 68, 68, 0.75)' } : undefined}>
                          <span className={`status-badge ${isDone ? 'success' : 'info'}`} style={{ textDecoration: 'none' }}>
                            {ex.examType || 'CAT 1'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--accent-cyan)', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>
                          {ex.courseCode}
                        </td>
                        <td style={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>{ex.courseTitle || ex.title}</td>
                        <td style={{ fontWeight: 700, textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>{ex.date}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>{ex.time || '9:30 AM'}</td>
                        <td style={isDone ? { textDecoration: 'line-through', textDecorationColor: 'rgba(239, 68, 68, 0.75)' } : undefined}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} color="var(--accent-orange)" />
                            <span>{ex.venue || 'Academic Block'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>
                          {rowVal ? (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                fontSize: '0.80rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              Row {rowVal}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>
                          {colVal ? (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                fontSize: '0.80rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              Col {colVal}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'rgba(239, 68, 68, 0.75)' }}>
                          {seatNum ? (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                fontSize: '0.80rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              #{seatNum}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }} className="no-strike">
                          <button
                            type="button"
                            onClick={() => toggleExamCompleted(examKey, isDone)}
                            className={`status-badge ${isDone ? 'success' : 'info'}`}
                            style={{
                              cursor: 'pointer',
                              border: isDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                              background: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: isDone ? '#34d399' : '#60a5fa',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={isDone ? 'Mark as upcoming' : 'Mark as completed'}
                          >
                            {isDone ? 'Done ✓' : 'Upcoming'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === ALL GRADES & CGPA PREDICTOR SUB-TAB === */}
      {activeTab === 'grades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(() => {
            const gradePointMap: Record<string, number> = {
              S: 10,
              A: 9,
              B: 8,
              C: 7,
              D: 6,
              E: 5,
              F: 0,
              N: 0,
            };

            const normalizeCourseCode = (courseCode?: string) => courseCode?.slice(0, 8) ?? '';

            const curr = attendance
              .filter((a) => a.category !== 'Non-graded Core Requirement' && (a.courseName || a.courseTitle) !== '')
              .map((a) => ({
                courseCode: normalizeCourseCode(a.courseCode),
                courseTitle: a.courseName || a.courseTitle || 'Course Title',
                credits: Number(a.credits) || 3,
              }));

            const enrolledList =
              curr.length > 0
                ? curr
                : courses.length > 0
                ? courses.map((c) => ({
                    courseCode: normalizeCourseCode(c.code),
                    courseTitle: c.title,
                    credits: c.credits || 3,
                  }))
                : [];

            const allSemesterGrades = Object.values(allGradesData?.grades || {}) as Array<{
              grades?: Array<{ courseCode?: string; grade?: string }>;
            }>;

            const gradePool = allSemesterGrades
              .flatMap((semester) => semester?.grades || [])
              .reduce((pool: Record<string, string>, course) => {
                const code = normalizeCourseCode(course?.courseCode || '');
                if (code && course?.grade) {
                  pool[code] = course.grade;
                }
                return pool;
              }, {});

            const currentCgpa = Number(allGradesData?.cgpa ?? student.cgpa ?? 0);
            const currentCredits = Number(allGradesData?.creditsEarned ?? student.creditsEarned ?? 0);
            const semestersCompleted = Object.values(allGradesData?.grades || {}).filter(Boolean).length;

            const predictedSemesterCreditPoints = enrolledList.reduce((sum, course, idx) => {
              const key = `${course.courseCode}-${idx}`;
              const matchedGrade = gradePool[course.courseCode];
              const selectedGrade = predictedGrades[key] || matchedGrade || 'A';
              const gradePoint = gradePointMap[selectedGrade] ?? 9;
              return sum + (course.credits || 0) * gradePoint;
            }, 0);

            const predictedCreditPoints = enrolledList.reduce((sum, course, idx) => {
              const key = `${course.courseCode}-${idx}`;
              const matchedGrade = gradePool[course.courseCode];
              const selectedGrade = predictedGrades[key] || matchedGrade || 'A';
              const selectedGradePoint = gradePointMap[selectedGrade] ?? 9;

              if (matchedGrade) {
                const matchedGradePoint = gradePointMap[matchedGrade] ?? 9;
                return sum + (course.credits || 0) * (selectedGradePoint - matchedGradePoint);
              }
              return sum + (course.credits || 0) * selectedGradePoint;
            }, 0);

            const predictedAddedCredits = enrolledList.reduce((sum, course) => {
              const matchedGrade = gradePool[course.courseCode];
              if (matchedGrade) return sum;
              return sum + (course.credits || 0);
            }, 0);

            const extraSemesterCredits = extraSemesters.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
            const extraSemesterCreditPoints = extraSemesters.reduce(
              (sum, s) => sum + (Number(s.credits) || 0) * (Number(s.gpa) || 0),
              0
            );

            const predictedSemesterCredits = enrolledList.reduce((sum, course) => sum + (course.credits || 0), 0);
            const predictedTotalCredits = currentCredits + predictedAddedCredits + extraSemesterCredits;
            const predictedCgpa =
              predictedTotalCredits > 0
                ? (currentCgpa * currentCredits + predictedCreditPoints + extraSemesterCreditPoints) /
                  predictedTotalCredits
                : currentCgpa;
            const predictedGpa =
              predictedSemesterCredits > 0 ? predictedSemesterCreditPoints / predictedSemesterCredits : 0;

            const semesterKeys = allGradesData?.grades ? Object.keys(allGradesData.grades) : [];
            const activeSem = activeGradeSem || (semesterKeys.length > 0 ? semesterKeys[semesterKeys.length - 1] : '');
            const semesterData = activeSem && activeSem !== 'predict' ? allGradesData?.grades?.[activeSem] : null;

            const formatSemLabel = (sem: string) => {
              if (sem.endsWith('1')) {
                return `FALLSEM ${sem.slice(4, -4)}-${sem.slice(6, -2)}`;
              }
              if (sem.endsWith('5')) {
                return `WINTERSEM ${sem.slice(4, -4)}-${sem.slice(6, -2)}`;
              }
              return sem;
            };

            return (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={22} color="#10b981" />
                      <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Academic Grades &amp; CGPA Simulator</h2>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Authoritative VTOP grade records, cutoff boundaries, component breakdown, and real-time GPA/CGPA projection engine.
                    </p>
                  </div>
                </div>

                {/* Semester & Predictor Tab Strip */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-color)',
                    overflowX: 'auto',
                    marginBottom: '20px',
                  }}
                >
                  {semesterKeys.map((sem) => {
                    const isSelected = activeSem === sem;
                    return (
                      <button
                        key={sem}
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setActiveGradeSem(sem);
                          setOpenCourseModal(null);
                        }}
                        style={{ minWidth: '150px', textAlign: 'center', fontWeight: 600 }}
                      >
                        {formatSemLabel(sem)}
                      </button>
                    );
                  })}

                  <button
                    className={`btn btn-sm ${activeSem === 'predict' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setActiveGradeSem('predict');
                      setOpenCourseModal(null);
                    }}
                    style={{ minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    <Calculator size={14} />
                    <span>Predict CGPA</span>
                  </button>
                </div>

                {/* ACTIVE VIEW: HISTORICAL SEMESTER COURSE CARDS GRID */}
                {activeSem !== 'predict' && semesterData && (
                  <div>
                    {semesterData.gpa && (
                      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <span
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            color: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            padding: '6px 20px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          Semester GPA: {semesterData.gpa}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '16px',
                      }}
                    >
                      {semesterData.grades.map((course, idx) => (
                        <div
                          key={course.courseId || course.courseCode || idx}
                          className="card"
                          onClick={() => setOpenCourseModal(course)}
                          style={{
                            cursor: 'pointer',
                            padding: '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            transition: 'transform 0.15s ease, border-color 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                                <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontWeight: 700 }}>{course.courseCode}</span>
                                <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&bull;</span>
                                <span>{course.courseTitle}</span>
                              </h4>
                              <div
                                style={{
                                  display: 'inline-block',
                                  marginTop: '8px',
                                  fontSize: '0.725rem',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {course.courseType}
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                              <span
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  color: '#60a5fa',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Grade: {course.grade}
                              </span>
                              {course.grandTotal && (
                                <span
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Total: {course.grandTotal}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--border-color)',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <span>Click for cutoffs &amp; component breakdown</span>
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>View Details &rarr;</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ACTIVE VIEW: INTERACTIVE CGPA PREDICTOR */}
                {activeSem === 'predict' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Top 4 Summary Cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '14px',
                      }}
                    >
                      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>Current CGPA</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>{currentCgpa.toFixed(2)}</div>
                      </div>

                      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Current Credits</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>{currentCredits.toFixed(1)}</div>
                      </div>

                      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 600 }}>Predicted Term GPA</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: '#818cf8' }}>{predictedGpa.toFixed(2)}</div>
                      </div>

                      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Predicted Cumulative CGPA</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: '#10b981' }}>{predictedCgpa.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Per-Sem Future Predictor */}
                    <div
                      style={{
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Per Sem Graduation Planner</h3>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Add future upcoming semesters to project your graduation CGPA.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            const nextId = Math.max(0, ...extraSemesters.map((s) => s.id)) + 1;
                            setExtraSemesters((prev) => [
                              ...prev,
                              { id: nextId, name: `Semester ${semestersCompleted + prev.length + 1}`, credits: 20, gpa: 9.0 },
                            ]);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Plus size={14} />
                          <span>Add Sem</span>
                        </button>
                      </div>

                      {extraSemesters.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                          No upcoming semesters added yet. Click &ldquo;Add Sem&rdquo; to simulate future semesters.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                          {extraSemesters.map((sem, sIdx) => (
                            <div
                              key={sem.id}
                              style={{
                                padding: '14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  Semester {semestersCompleted + sIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setExtraSemesters((prev) => prev.filter((s) => s.id !== sem.id))}
                                  style={{ color: '#ef4444', padding: '4px' }}
                                  title="Remove semester"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                    Credits
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={35}
                                    value={sem.credits}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setExtraSemesters((prev) =>
                                        prev.map((s) => (s.id === sem.id ? { ...s, credits: val } : s))
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--input-bg)',
                                      color: 'inherit',
                                      fontSize: '0.85rem',
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                    Target GPA
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={sem.gpa}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setExtraSemesters((prev) =>
                                        prev.map((s) => (s.id === sem.id ? { ...s, gpa: val } : s))
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--input-bg)',
                                      color: 'inherit',
                                      fontSize: '0.85rem',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Enrolled Courses Target Grade Simulator */}
                    <div>
                      <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 600 }}>
                        Current Semester Registered Courses ({enrolledList.length} Courses, {predictedSemesterCredits} Credits)
                      </h3>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                          gap: '14px',
                        }}
                      >
                        {enrolledList.map((course, idx) => {
                          const key = `${course.courseCode}-${idx}`;
                          const matchedGrade = gradePool[course.courseCode];
                          const selectedGrade = predictedGrades[key] || matchedGrade || 'A';

                          return (
                            <div
                              key={key}
                              style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: matchedGrade ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}
                            >
                              <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.35 }}>
                                  <span style={{ color: '#3b82f6', fontFamily: 'monospace' }}>{course.courseCode}</span>
                                  <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&bull;</span>
                                  <span>{course.courseTitle}</span>
                                </h4>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  Credits: {course.credits}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: 'auto' }}>
                                <label htmlFor={`grade-${key}`} style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                  Target Grade:
                                </label>
                                <select
                                  id={`grade-${key}`}
                                  value={selectedGrade}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPredictedGrades((prev) => ({
                                      ...prev,
                                      [key]: value,
                                    }));
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'inherit',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  <option value="S">S (10 pts)</option>
                                  <option value="A">A (9 pts)</option>
                                  <option value="B">B (8 pts)</option>
                                  <option value="C">C (7 pts)</option>
                                  <option value="D">D (6 pts)</option>
                                  <option value="E">E (5 pts)</option>
                                  <option value="F">F (0 pts)</option>
                                  <option value="N">N (0 pts)</option>
                                </select>
                              </div>

                              {matchedGrade && !predictedGrades[key] && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Already recorded in ledger: Grade {matchedGrade}
                                </span>
                              )}
                              {matchedGrade && predictedGrades[key] && predictedGrades[key] !== matchedGrade && (
                                <span style={{ fontSize: '0.72rem', color: '#60a5fa' }}>
                                  Overridden from {matchedGrade} to {predictedGrades[key]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL: COURSE CUTOFF BOUNDARIES & COMPONENT MARKS BREAKDOWN */}
                {openCourseModal && (
                  <div
                    className="modal-backdrop overscroll-contain"
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
                      overscrollBehavior: 'contain',
                    }}
                    onClick={() => setOpenCourseModal(null)}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div
                      className="card overscroll-contain"
                      onWheel={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        maxWidth: '720px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        position: 'relative',
                        backgroundColor: 'var(--bg-card, #121826)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        borderRadius: '16px',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                        overscrollBehavior: 'contain',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setOpenCourseModal(null)}
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          borderRadius: '50%',
                          padding: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={20} />
                      </button>

                      <h3 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700 }}>
                        <span style={{ color: '#3b82f6', fontFamily: 'monospace' }}>{openCourseModal.courseCode}</span>
                        <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>–</span>
                        <span>{openCourseModal.courseTitle}</span>
                      </h3>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '20px', fontSize: '0.875rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Course Type: </span>
                          <strong>{openCourseModal.courseType}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Grade: </span>
                          <strong style={{ color: '#10b981' }}>{openCourseModal.grade}</strong>
                        </div>
                        {openCourseModal.grandTotal && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Grand Total: </span>
                            <strong style={{ color: '#60a5fa' }}>{openCourseModal.grandTotal}</strong>
                          </div>
                        )}
                      </div>

                      {/* Grade Cutoffs Range Table */}
                      {openCourseModal.range && Object.keys(openCourseModal.range).length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                            Grade Cutoff Range Criteria
                          </h4>
                          <div className="table-responsive-wrapper">
                            <table className="academic-data-table">
                              <thead>
                                <tr>
                                  {Object.keys(openCourseModal.range).map((grade) => (
                                    <th key={grade} style={{ textAlign: 'center' }}>
                                      {grade}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {Object.values(openCourseModal.range).map((rangeVal, rIdx) => (
                                    <td key={rIdx} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                                      {rangeVal}
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Continuous Assessment Component Breakdown Table */}
                      {openCourseModal.details && openCourseModal.details.length > 0 ? (
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                            Continuous Assessment Component Breakdown
                          </h4>
                          <div className="table-responsive-wrapper">
                            <table className="academic-data-table">
                              <thead>
                                <tr>
                                  <th>Component Name</th>
                                  <th style={{ textAlign: 'center' }}>Max Marks</th>
                                  <th style={{ textAlign: 'center' }}>Scored Marks</th>
                                  <th style={{ textAlign: 'center' }}>Weightage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {openCourseModal.details.map((d, dIdx) => (
                                  <tr key={dIdx}>
                                    <td style={{ fontWeight: 500 }}>{d.component}</td>
                                    <td style={{ textAlign: 'center' }}>{Number(d.maxMark).toFixed(1)}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#10b981' }}>
                                      {Number(d.scoredMark).toFixed(1)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{Number(d.weightageMark).toFixed(1)}</td>
                                  </tr>
                                ))}
                                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                                  <td>Total</td>
                                  <td style={{ textAlign: 'center' }}>
                                    {openCourseModal.details.reduce((sum, d) => sum + (Number(d.maxMark) || 0), 0).toFixed(1)}
                                  </td>
                                  <td style={{ textAlign: 'center', color: '#10b981' }}>
                                    {openCourseModal.details.reduce((sum, d) => sum + (Number(d.scoredMark) || 0), 0).toFixed(1)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {openCourseModal.details.reduce((sum, d) => sum + (Number(d.weightageMark) || 0), 0).toFixed(1)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                          No individual continuous assessment component breakdown recorded for this course.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'faculty' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Users size={19} color="var(--accent-cyan)" />
                <span>Course Faculty &amp; Instructors Directory</span>
              </h3>
              <p className="card-description">Faculty contact details, office cabins, and assigned course subjects.</p>
            </div>
          </div>

          {faculty.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Users size={26} />
              </div>
              <div className="empty-state-title">No Faculty Directory Synced</div>
              <p className="empty-state-desc">Sync your VTOP profile to extract instructors assigned to your registered courses.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {faculty.map((fac, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-input)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {fac.name}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        {fac.courseCode || 'COURSE'} • {fac.designation || 'Faculty Instructor'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {fac.courseTitle || 'Assigned Subject'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    {fac.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <Mail size={13} color="var(--accent-blue)" />
                        <a href={`mailto:${fac.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                          {fac.email}
                        </a>
                      </div>
                    )}
                    {fac.cabin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <MapPin size={13} color="var(--accent-orange)" />
                        <span>Cabin: {fac.cabin}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 3.7 COURSES & STUDY MATERIAL SUB-TAB === */}
      {activeTab === 'courses' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <BookOpen size={19} color="var(--accent-cyan)" />
                <span>Registered Courses &amp; Study Repository</span>
              </h3>
              <p className="card-description">Official course syllabus, reference textbooks, lecture slides, and question banks.</p>
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search course code..."
                className="input-field"
                style={{ paddingLeft: '36px', height: '40px', fontSize: '0.86rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <BookOpen size={26} />
              </div>
              <div className="empty-state-title">No Enrolled Courses Found</div>
              <p className="empty-state-desc">Synchronize with VTOP to load all semester curriculum courses.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {courses
                .filter(
                  (c) =>
                    !courseSearch ||
                    (c.code || '').toLowerCase().includes(courseSearch.toLowerCase()) ||
                    (c.title || '').toLowerCase().includes(courseSearch.toLowerCase())
                )
                .map((course, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--surface-input)',
                      border: '1px solid var(--border-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {course.code}
                        </span>
                        <span className="status-badge info">{course.credits ? `${course.credits} Credits` : '3 Credits'}</span>
                      </div>

                      <h4 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                        {course.title}
                      </h4>

                      <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                        Slot: {course.slot || 'Regular'} • Faculty: {course.faculty || 'Assigned Professor'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                      <a
                        href={getStudyMaterialUrl({ code: course.code, title: course.title })}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        title={`Open official VHelp study materials for ${course.code}`}
                      >
                        <ExternalLink size={13} />
                        <span>VHelp Study Materials</span>
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* === 3.10 SEMESTER ACADEMIC CALENDAR (CAMPUSOS IN-PAGE COMPONENT) === */}
      {activeTab === 'calendar' && (
        <CalendarView
          calendars={calendarData?.calendars}
          calendarType={calendarType}
          semesterId={student?.semesterId}
          handleCalendarFetch={handleCalendarFetch}
          exams={exams}
          attendance={attendance}
        />
      )}

      {/* On-Duty (OD) Hours Breakdown Modal */}
      <ODHoursModal
        isOpen={isODModalOpen}
        onClose={() => setIsODModalOpen(false)}
        attendance={attendance}
        odData={effectiveOdData}
      />

      {/* VTOP Academic Calendar Modal */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        exams={exams}
        attendance={attendance}
        calendars={calendarData?.calendars}
        calendarType={calendarType}
        semesterId={student?.semesterId}
        handleCalendarFetch={handleCalendarFetch}
      />

      {/* Overall Attendance Predictor Modal (CampusOS calendar days simulator) */}
      <OverallAttendancePredictorModal
        isOpen={isPredictorModalOpen}
        onClose={() => setIsPredictorModalOpen(false)}
        attendance={attendance}
        calendars={calendarData?.calendars}
        dayCardsMap={dayCardsMap}
        exams={exams}
      />
    </div>
  );
};
