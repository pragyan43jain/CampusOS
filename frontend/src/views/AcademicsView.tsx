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
  AlertTriangle,
  Mail,
  MapPin,
  ExternalLink,
  Search,
  BookMarked,
  ShieldCheck,
  Calculator,
  TrendingUp,
  Plus,
  Trash2,
  Clock,
  X,
  CalendarDays,
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
import { MetricCard } from '../components/MetricCard';
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

  // Attendance Tab states
  const [attendanceViewMode, setAttendanceViewMode] = useState<'cards' | 'weekly' | 'table'>('cards');
  const [selectedAttDetail, setSelectedAttDetail] = useState<Attendance | null>(null);
  const [isPredictorModalOpen, setIsPredictorModalOpen] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);

  // OD Hours & Academic Calendar modal states
  const [isODModalOpen, setIsODModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarType, setCalendarType] = useState<string>('ALL');
  const [odData, setOdData] = useState<ODResponse | null>(null);

  const handleCalendarFetch = async (fnCalendarType?: string) => {
    const typeToUse = fnCalendarType || calendarType || 'ALL';
    try {
      const data = await CampusAPI.getCalendar(undefined, typeToUse);
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
        const data = await CampusAPI.getCalendar();
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
        if (data) {
          setOdData(data);
        }
      } catch (err) {
        console.warn('[AcademicsView] Failed to fetch OD data:', err);
      }
    };
    loadCalendar();
    loadOD();
  }, []);

  const approvedOdHours = useMemo(() => {
    if (odData && typeof odData.approvedHours === 'number') {
      return odData.approvedHours;
    }
    if (odData && typeof odData.usedHours === 'number') {
      return odData.usedHours;
    }
    return 0;
  }, [odData]);

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
          const matchingAtt = attendance.find(
            (a) => a.courseCode === t.courseCode || a.courseTitle === t.courseTitle
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

  const [marksFilter, setMarksFilter] = useState<'ALL' | 'CAT 1' | 'CAT 2' | 'FAT' | 'DA'>('ALL');
  const [courseSearch, setCourseSearch] = useState('');

  const filteredMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    if (marksFilter === 'ALL') return marks;
    return marks.filter((m) => {
      if (m.components && m.components.length > 0) {
        return m.components.some((c) => {
          const t = (c.title || '').toUpperCase();
          if (marksFilter === 'CAT 1') return t.includes('CAT 1') || t.includes('CAT-1') || t.includes('TEST - I') || t.includes('TEST 1');
          if (marksFilter === 'CAT 2') return t.includes('CAT 2') || t.includes('CAT-2') || t.includes('TEST - II') || t.includes('TEST 2');
          if (marksFilter === 'FAT') return t.includes('FAT') || t.includes('FINAL');
          if (marksFilter === 'DA') return t.includes('ASSIGNMENT') || t.includes('DA') || t.includes('QUIZ');
          return true;
        });
      }
      if (marksFilter === 'CAT 1') return m.cat1 && m.cat1.scored !== null && m.cat1.scored !== undefined;
      if (marksFilter === 'CAT 2') return m.cat2 && m.cat2.scored !== null && m.cat2.scored !== undefined;
      if (marksFilter === 'FAT') return m.fat && m.fat.scored !== null && m.fat.scored !== undefined;
      if (marksFilter === 'DA') return Boolean(m.da1 || m.da2 || m.quiz || (m as any).quiz1 || (m as any).quiz2);
      return true;
    });
  }, [marks, marksFilter]);

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

      {/* === 3.2 ATTENDANCE SUB-TAB === */}
      {activeTab === 'attendance' && (() => {
        const baseAttended = attendance.reduce((acc, a) => acc + (a.attended ?? a.classesAttended ?? 0), 0);
        const baseConducted = attendance.reduce((acc, a) => acc + (a.conducted ?? a.classesConducted ?? a.total ?? 0), 0);
        const basePct = baseConducted > 0 ? Math.round((baseAttended / baseConducted) * 1000) / 10 : 0;
        const actualOverallPct = student.overallAttendance?.percentage ?? (attendance.length > 0 ? basePct : null);

        // Simulated values if user tests hypothetical future bunks or attended classes
        const simAttended = Math.max(0, baseAttended + simAttendedGlobalDelta);
        const simConducted = Math.max(0, baseConducted + simAttendedGlobalDelta + simMissedGlobalDelta);
        const simOverallPct = simConducted > 0 ? Math.round((simAttended / simConducted) * 1000) / 10 : (actualOverallPct ?? 0);

        const targetRatio = targetAttendance / 100;
        const totalSafeBunks = Math.max(0, Math.floor((baseAttended - targetRatio * baseConducted) / targetRatio));
        const simSafeBunksRemaining = Math.max(0, Math.floor((simAttended - targetRatio * simConducted) / targetRatio));
        const totalRecoveryNeeded = simOverallPct < targetAttendance
          ? Math.ceil((targetRatio * simConducted - simAttended) / (1 - targetRatio))
          : 0;

        const safeCoursesCount = attendance.filter((a) => (a.percentage ?? a.attendancePercentage ?? 0) >= targetAttendance).length;
        const criticalCoursesCount = attendance.filter((a) => (a.percentage ?? a.attendancePercentage ?? 0) < targetAttendance).length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* CampusOS Sub-Tab Switcher: Attendance vs Semester Calendar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-primary"
                style={{ padding: '6px 16px', fontWeight: 600, borderRadius: '8px' }}
              >
                Attendance Analytics
              </button>
              <button
                onClick={() => handleTabChange('calendar')}
                className="btn btn-sm btn-ghost"
                style={{ padding: '6px 16px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarDays size={14} />
                <span>Semester Academic Calendar</span>
              </button>
            </div>

            {/* Top Card: Attendance Safety Engine & Safe Margin Calculator */}
            <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
              <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h3 className="card-title">
                    <Percent size={19} color="var(--accent-cyan)" />
                    <span>{targetAttendance}% Attendance Safety Engine &amp; Safe Margin Calculator</span>
                  </h3>
                  <p className="card-description">
                    Continuous mathematical calculation of safe leave margins and recovery hours across all registered courses.
                  </p>
                </div>

                {/* Target Margin Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Threshold:</span>
                  <div className="btn-group" style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
                    {[75, 80, 85, 90].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTargetAttendance(t)}
                        className={`btn btn-sm ${targetAttendance === t ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '3px 10px', fontSize: '0.78rem', borderRadius: '6px' }}
                      >
                        {t}% {t === 75 ? '(VTOP)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4 Core Metric Cards (matching screenshot) */}
              <div className="metrics-stat-grid" style={{ marginBottom: '16px' }}>
                <MetricCard
                  label="Overall Attendance"
                  value={simOverallPct !== null ? `${simOverallPct.toFixed(1)}%` : 'N/A'}
                  subtext={
                    simAttendedGlobalDelta !== 0 || simMissedGlobalDelta !== 0
                      ? `Simulated: ${simAttended} / ${simConducted} classes (Base: ${actualOverallPct}%)`
                      : baseConducted > 0
                      ? `${baseAttended} / ${baseConducted} classes attended`
                      : "Mandatory university threshold: 75.0%"
                  }
                  icon={<Percent size={18} />}
                  progressPercent={simOverallPct || 0}
                  variant={(simOverallPct || 0) >= 80 ? 'emerald' : (simOverallPct || 0) >= targetAttendance ? 'amber' : 'crimson'}
                />
                <MetricCard
                  label="Safe Status Courses"
                  value={safeCoursesCount}
                  subtext={`Courses safely above ${targetAttendance}%`}
                  icon={<ShieldCheck size={18} />}
                  variant="emerald"
                />
                <MetricCard
                  label="Critical Watchlist"
                  value={criticalCoursesCount}
                  subtext={criticalCoursesCount > 0 ? `Immediate recovery required (<${targetAttendance}%)` : 'All registered courses safe'}
                  icon={<AlertTriangle size={18} />}
                  variant={criticalCoursesCount > 0 ? 'crimson' : 'emerald'}
                />
                <div
                  onClick={() => setIsODModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view official on-duty leave records"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setIsODModalOpen(true)}
                >
                  <MetricCard
                    label="On-Duty (OD) Hours"
                    value={`${approvedOdHours} / ${odData?.maxHours || 40} hrs`}
                    subtext={approvedOdHours > 0 ? `${approvedOdHours} hrs sanctioned & credited` : 'No OD leaves recorded'}
                    icon={<Clock size={18} />}
                    variant="blue"
                  />
                </div>
              </div>

              {/* Interactive Safe Margin Calculator Engine & Quick Simulator */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calculator size={18} color="var(--accent-cyan)" />
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Interactive Attendance &amp; Safe Absence Margin Simulator
                    </span>
                    {(simAttendedGlobalDelta !== 0 || simMissedGlobalDelta !== 0) && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(45, 231, 211, 0.15)',
                          color: 'var(--accent-cyan)',
                          fontWeight: 700,
                        }}
                      >
                        SIMULATION ACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setIsPredictorModalOpen(true)}
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Calendar size={14} />
                      <span>📅 Attendance Forecaster (Till CAT/FAT)</span>
                    </button>

                    <button
                      onClick={() => setIsCalendarModalOpen(true)}
                      className="btn btn-sm btn-ghost"
                      style={{ border: '1px solid var(--border-color)', fontSize: '0.78rem', padding: '5px 10px' }}
                    >
                      🗓️ Academic Calendar
                    </button>

                    {(simAttendedGlobalDelta !== 0 || simMissedGlobalDelta !== 0) && (
                      <button
                        onClick={() => {
                          setSimAttendedGlobalDelta(0);
                          setSimMissedGlobalDelta(0);
                        }}
                        className="btn btn-sm btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', color: 'var(--text-muted)' }}
                      >
                        Reset Simulation
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Recalculation Summary Banner */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: simOverallPct >= targetAttendance ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${simOverallPct >= targetAttendance ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {simOverallPct >= targetAttendance ? (
                      <span>
                        🛡️ <strong>Safe Absence Buffer:</strong> You can safely miss up to{' '}
                        <strong style={{ color: 'var(--success-emerald)', fontFamily: 'var(--font-mono)' }}>
                          +{simSafeBunksRemaining} class{simSafeBunksRemaining !== 1 ? 'es' : ''}
                        </strong>{' '}
                        across your timetable and remain above <strong>{targetAttendance}%</strong> threshold.
                        {simMissedGlobalDelta > 0 && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                            (Simulated missing {simMissedGlobalDelta} classes: dropped from {actualOverallPct}% to {simOverallPct}%. Base safe buffer: +{totalSafeBunks} classes)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>
                        ⚠️ <strong>Attendance Shortage Alert:</strong> You must attend next{' '}
                        <strong style={{ color: 'var(--danger-crimson)', fontFamily: 'var(--font-mono)' }}>
                          {totalRecoveryNeeded} class{totalRecoveryNeeded !== 1 ? 'es' : ''}
                        </strong>{' '}
                        continuously to restore your overall percentage back to <strong>{targetAttendance}%</strong>.
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Projected:</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        color: simOverallPct >= 80 ? 'var(--success-emerald)' : simOverallPct >= targetAttendance ? 'var(--warning-amber)' : 'var(--danger-crimson)',
                      }}
                    >
                      {simOverallPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Click any course card below for subject-specific calculations &amp; exam countdowns.
                  </div>
                </div>
              </div>
            </div>

            {/* Course-Wise Attendance Breakdown */}
            <div className="card">
              <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 className="card-title">
                  <BookMarked size={19} color="var(--accent-blue)" />
                  <span>Course-Wise Attendance Breakdown ({attendance.length} Courses)</span>
                </h3>

                {attendance.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="btn-group" style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
                      <button
                        onClick={() => setAttendanceViewMode('cards')}
                        className={`btn btn-sm ${attendanceViewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                      >
                        Cards View
                      </button>
                      <button
                        onClick={() => setAttendanceViewMode('weekly')}
                        className={`btn btn-sm ${attendanceViewMode === 'weekly' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                      >
                        Weekly Schedule
                      </button>
                      <button
                        onClick={() => setAttendanceViewMode('table')}
                        className={`btn btn-sm ${attendanceViewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                      >
                        Table View
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {attendance.length === 0 ? (
                <div className="empty-state-card">
                  <div className="empty-state-icon">
                    <Percent size={26} />
                  </div>
                  <div className="empty-state-title">No Attendance Records Synced</div>
                  <p className="empty-state-desc">Click "Sync Academic Data" to fetch live attendance from VTOP.</p>
                  <button
                    onClick={onForceSync}
                    disabled={syncing}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '12px' }}
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                    <span>{syncing ? 'Syncing...' : 'Sync Academic Data'}</span>
                  </button>
                </div>
              ) : attendanceViewMode === 'weekly' ? (
                <div style={{ marginTop: '12px' }}>
                  <WeeklyAttendanceSchedule
                    dayCardsMap={dayCardsMap}
                    onSelectCourse={(att) => setSelectedAttDetail(att)}
                    targetAttendance={targetAttendance}
                  />
                </div>
              ) : attendanceViewMode === 'cards' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginTop: '12px' }}>
                  {attendance.map((att, idx) => {
                    const conducted = att.conducted ?? att.classesConducted ?? att.total ?? 0;
                    const attended = att.attended ?? att.classesAttended ?? 0;
                    const pct = att.percentage ?? att.attendancePercentage ?? (conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 0);
                    const targetRatio = targetAttendance / 100;
                    const safeBunks = Math.max(0, Math.floor((attended - targetRatio * conducted) / targetRatio));
                    const recoveryNeeded = pct < targetAttendance ? Math.ceil((targetRatio * conducted - attended) / (1 - targetRatio)) : 0;
                    const isLab = (att.courseCode || '').endsWith('P') || (att.courseType || '').toLowerCase().includes('lab');

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedAttDetail(att)}
                        className="card hover-trigger"
                        style={{
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          cursor: 'pointer',
                          borderRadius: '12px',
                          border: `1px solid ${pct < targetAttendance ? 'rgba(239, 68, 68, 0.4)' : pct < 85 ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'}`,
                          background: pct < targetAttendance ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-secondary)',
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                        }}
                      >
                        {/* Top row */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '0.92rem' }}>
                                {att.courseCode || 'COURSE'}
                              </span>
                              <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {isLab ? 'Lab' : 'Theory'}
                              </span>
                            </div>
                            <span className={`status-badge ${pct >= 80 ? 'safe' : pct >= targetAttendance ? 'warning' : 'critical'}`} style={{ fontSize: '0.74rem' }}>
                              {pct >= 80 ? 'Safe' : pct >= targetAttendance ? 'Borderline' : 'Shortage'}
                            </span>
                          </div>

                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                            {att.courseTitle || att.courseName || 'Subject Title'}
                          </h4>
                        </div>

                        {/* Middle info & gauge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={13} color="var(--accent-blue)" />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                                {att.facultyName || att.faculty || 'Faculty'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={13} color="var(--accent-cyan)" />
                              <span>{att.slot || 'Slot TBA'} • {att.venue || att.slotVenue || 'Room TBA'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {attended} / {conducted}
                              </strong>
                              <span>classes attended</span>
                            </div>
                          </div>

                          {/* Mini SVG circular ring */}
                          <div style={{ position: 'relative', width: '66px', height: '66px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                stroke={pct >= 80 ? 'var(--success-emerald, #10b981)' : pct >= targetAttendance ? 'var(--warning-amber, #f59e0b)' : 'var(--danger-crimson, #ef4444)'}
                                strokeWidth="3.2"
                                strokeDasharray={`${Math.min(100, Math.max(0, pct))}, 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span style={{ position: 'absolute', fontSize: '0.82rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: pct >= 80 ? 'var(--success-emerald)' : pct >= targetAttendance ? 'var(--warning-amber)' : 'var(--danger-crimson)' }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Bottom action bar */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.80rem', fontWeight: 600, color: pct >= targetAttendance ? 'var(--success-emerald)' : 'var(--danger-crimson)' }}>
                            {pct >= targetAttendance ? (
                              safeBunks > 0 ? `+${safeBunks} safe to miss` : 'Borderline (Attend next)'
                            ) : (
                              `Attend next ${recoveryNeeded} class${recoveryNeeded > 1 ? 'es' : ''}`
                            )}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                            Drill Down &amp; Calculator →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="academic-data-table table-attendance">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '95px' }}>Course Code</th>
                        <th style={{ minWidth: '180px' }}>Course Title</th>
                        <th style={{ minWidth: '100px' }}>Slot / Venue</th>
                        <th style={{ minWidth: '140px' }}>Faculty</th>
                        <th style={{ minWidth: '110px' }}>Attended / Total</th>
                        <th style={{ minWidth: '90px' }}>Percentage</th>
                        <th style={{ minWidth: '150px' }}>Safe Margin</th>
                        <th style={{ minWidth: '90px' }}>Status</th>
                        <th style={{ minWidth: '80px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((att, idx) => {
                        const conducted = att.conducted ?? att.classesConducted ?? att.total ?? 0;
                        const attended = att.attended ?? att.classesAttended ?? 0;
                        const pct = att.percentage ?? att.attendancePercentage ?? (conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 0);
                        const targetRatio = targetAttendance / 100;
                        const safeBunks = Math.max(0, Math.floor((attended - targetRatio * conducted) / targetRatio));
                        const recoveryNeeded = pct < targetAttendance ? Math.ceil((targetRatio * conducted - attended) / (1 - targetRatio)) : 0;

                        return (
                          <tr
                            key={idx}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAttDetail(att)}
                          >
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                              {att.courseCode || 'COURSE'}
                            </td>
                            <td style={{ fontWeight: 600 }}>{att.courseTitle || att.courseName || 'Subject Title'}</td>
                            <td style={{ fontSize: '0.82rem' }}>
                              <span>{att.slot || '-'}</span>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>{att.venue || att.slotVenue || ''}</span>
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{att.facultyName || att.faculty || '-'}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {attended} / {conducted}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontFamily: 'var(--font-mono)',
                                  color: pct >= 80 ? 'var(--success-emerald)' : pct >= targetAttendance ? 'var(--warning-amber)' : 'var(--danger-crimson)',
                                }}
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                            <td>
                              {pct >= targetAttendance ? (
                                <span style={{ color: 'var(--success-emerald)', fontWeight: 600, fontSize: '0.84rem' }}>
                                  +{safeBunks} safe to miss
                                </span>
                              ) : (
                                <span style={{ color: 'var(--danger-crimson)', fontWeight: 600, fontSize: '0.84rem' }}>
                                  Attend next {recoveryNeeded} classes
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${pct >= 80 ? 'safe' : pct >= targetAttendance ? 'warning' : 'critical'}`}>
                                {pct >= 80 ? 'Safe Buffer' : pct >= targetAttendance ? 'Borderline' : 'Debarment Risk'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAttDetail(att);
                                }}
                              >
                                Drill Down →
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

      {/* === 3.4 MARKS SUB-TAB === */}
      {activeTab === 'marks' && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Award size={19} color="var(--accent-cyan)" />
                <span>Continuous Assessment &amp; Marks Ledger</span>
              </h3>
              <p className="card-description">Internal assessment scores, CAT evaluations, quizzes, and digital assignments.</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['ALL', 'CAT 1', 'CAT 2', 'FAT', 'DA'] as const).map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${marksFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMarksFilter(f)}
                >
                  {f === 'ALL' ? 'All Assessments' : f}
                </button>
              ))}
            </div>
          </div>

          {filteredMarks.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <Award size={26} />
              </div>
              <div className="empty-state-title">No Marks Records Available</div>
              <p className="empty-state-desc">No assessment marks matching "{marksFilter}" found for this semester.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="table-responsive-wrapper">
                <table className="academic-data-table table-marks">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '95px' }}>Course Code</th>
                      <th style={{ minWidth: '190px' }}>Course Title</th>
                      <th style={{ minWidth: '150px' }}>Faculty</th>
                      <th style={{ minWidth: '110px' }}>CAT 1 Score</th>
                      <th style={{ minWidth: '110px' }}>CAT 2 Score</th>
                      <th style={{ minWidth: '110px' }}>FAT / Final</th>
                      <th style={{ minWidth: '120px' }}>Weightage Scored</th>
                      <th style={{ minWidth: '95px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMarks.map((m, idx) => {
                      const cat1Comp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('CAT 1') || t.includes('CAT-1') || t.includes('TEST - I') || t.includes('TEST 1');
                      });
                      const cat1Score = cat1Comp
                        ? `${cat1Comp.scored ?? '-'} / ${cat1Comp.max}`
                        : (m.cat1?.scored !== null && m.cat1?.scored !== undefined ? `${m.cat1.scored} / ${m.cat1.max}` : '-');
                      const cat1Wt = cat1Comp?.weightage !== undefined ? `(Wt: ${cat1Comp.weightage} / ${cat1Comp.maxWeightage || 15})` : '';

                      const cat2Comp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('CAT 2') || t.includes('CAT-2') || t.includes('TEST - II') || t.includes('TEST 2');
                      });
                      const cat2Score = cat2Comp
                        ? `${cat2Comp.scored ?? '-'} / ${cat2Comp.max}`
                        : (m.cat2?.scored !== null && m.cat2?.scored !== undefined ? `${m.cat2.scored} / ${m.cat2.max}` : '-');

                      const fatComp = m.components?.find((c) => {
                        const t = (c.title || '').toUpperCase();
                        return t.includes('FAT') || t.includes('FINAL');
                      });
                      const fatScore = fatComp
                        ? `${fatComp.scored ?? '-'} / ${fatComp.max}`
                        : (m.fat?.scored !== null && m.fat?.scored !== undefined ? `${m.fat.scored} / ${m.fat.max || 100}` : '-');

                      const totalScore = m.weightageScored !== undefined
                        ? `${m.weightageScored} / ${m.weightageGraded || m.weightageTotal || 15}`
                        : (m.totalInternal?.scored !== undefined ? `${m.totalInternal.scored} / ${m.totalInternal.max}` : '-');

                      return (
                        <tr key={m.id || idx}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {m.courseCode || 'COURSE'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.courseTitle || m.courseName || 'Subject Title'}</td>
                          <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{m.faculty || 'Assigned Professor'}</td>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {cat1Score}
                            </div>
                            {cat1Wt && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                                {cat1Wt}
                              </div>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cat2Score}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fatScore}
                          </td>
                          <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald, #10b981)' }}>
                            {totalScore}
                          </td>
                          <td>
                            <span className="status-badge safe">Published</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assessment Components Breakdown Cards */}
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={16} color="var(--accent-cyan)" />
                  <span>Individual Evaluation Breakdown</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {filteredMarks.map((courseMark, cIdx) => (
                    <div
                      key={courseMark.id || cIdx}
                      style={{
                        backgroundColor: 'var(--surface-input)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                            {courseMark.courseCode}
                          </span>
                          <h5 style={{ margin: '2px 0 0 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {courseMark.courseTitle || courseMark.courseName}
                          </h5>
                          {courseMark.faculty && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Faculty: {courseMark.faculty}
                            </div>
                          )}
                        </div>

                        {courseMark.weightageScored !== undefined && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weightage</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald, #10b981)' }}>
                              {courseMark.weightageScored} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {courseMark.weightageGraded || courseMark.weightageTotal || 15}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {courseMark.components && courseMark.components.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                          {courseMark.components.map((comp, k) => {
                            const pct = comp.scored !== null && comp.max ? Math.round((comp.scored / comp.max) * 100) : 0;
                            return (
                              <div
                                key={k}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  border: '1px solid rgba(255, 255, 255, 0.04)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {comp.title}
                                  </span>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                                    {comp.scored !== null ? comp.scored : '-'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {comp.max}</span>
                                  </span>
                                </div>

                                <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--surface-input)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      backgroundColor: pct >= 80 ? 'var(--accent-emerald, #10b981)' : pct >= 60 ? 'var(--accent-cyan)' : 'var(--accent-orange, #f59e0b)',
                                      borderRadius: '3px',
                                    }}
                                  />
                                </div>

                                {comp.weightage !== undefined && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                    <span>Weightage: {comp.weightage} / {comp.maxWeightage || 15}</span>
                                    <span>{comp.status || 'Graded'}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                          No individual component evaluations published yet.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

                    return (
                      <tr key={idx}>
                        <td>
                          <span className="status-badge info">{ex.examType || 'CAT 1'}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {ex.courseCode}
                        </td>
                        <td style={{ fontWeight: 600 }}>{ex.courseTitle || ex.title}</td>
                        <td style={{ fontWeight: 700 }}>{ex.date}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{ex.time || '9:30 AM'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} color="var(--accent-orange)" />
                            <span>{ex.venue || 'Academic Block'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
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
                              }}
                            >
                              Row {rowVal}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
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
                              }}
                            >
                              Col {colVal}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
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
                              }}
                            >
                              #{seatNum}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
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
                      >
                        <ExternalLink size={13} />
                        <span>Study Materials</span>
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
      />

      {/* VTOP Academic Calendar Modal */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        exams={exams}
        attendance={attendance}
        calendars={calendarData?.calendars}
        calendarType={calendarType}
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
