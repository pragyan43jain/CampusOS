import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, X, RefreshCw } from 'lucide-react';
import {
  StudentProfile,
  Course,
  TimetableSlot,
  Assignment,
  FeeItem,
  PlacementDrive,
  DSACategory,
  AIStudyTask,
  Attendance,
  Marks,
  Exam,
  Faculty,
  SubjectAssignmentGroup,
  ODResponse,
} from './types';
import { CampusAPI } from './services/api';
import { Header, ThemeType } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMoreDrawer } from './components/MobileMoreDrawer';
import { VtopLoginModal } from './components/VtopLoginModal';
import { TeamsLoginModal } from './components/TeamsLoginModal';
import { LMSLoginModal } from './components/LMSLoginModal';
import { AdminAnalyticsModal } from './components/AdminAnalyticsModal';
import { ODHoursModal } from './components/ODHoursModal';
import { CampusAnalytics } from './services/analytics';
import { DashboardView } from './views/DashboardView';
import { AcademicsView, AcademicsSubTab } from './views/AcademicsView';
import { AssignmentsView } from './views/AssignmentsView';
import { FeesView } from './views/FeesView';
import { PlacementsView } from './views/PlacementsView';
import { AIPlannerView } from './views/AIPlannerView';
import { LandingPageView } from './views/LandingPageView';
import { FeatureAvailabilityModal } from './components/FeatureAvailabilityModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { isAssignmentDone, isTeamsAssignment } from './utils/assignmentUtils';

interface RouteInfo {
  isLanding: boolean;
  isLogin: boolean;
  isAdmin: boolean;
  view: NavView;
  academicsSubTab?: AcademicsSubTab;
}

const getRouteFromPath = (path: string): RouteInfo => {
  const clean = (path || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/admin') {
    return { isLanding: false, isLogin: false, isAdmin: true, view: 'dashboard' };
  }
  if (clean === '' || clean === '/' || clean === '/home' || clean === '/landing') {
    return { isLanding: true, isLogin: false, isAdmin: false, view: 'dashboard' };
  }
  if (clean === '/login') {
    return { isLanding: true, isLogin: true, isAdmin: false, view: 'dashboard' };
  }
  if (clean === '/dashboard') {
    return { isLanding: false, isLogin: false, isAdmin: false, view: 'dashboard' };
  }
  if (
    clean === '/vtop-sync' ||
    clean === '/vtop' ||
    clean === '/sync' ||
    clean === '/academics' ||
    clean.startsWith('/academics/') ||
    clean === '/attendance' ||
    clean === '/calendar' ||
    clean === '/timetable' ||
    clean === '/marks' ||
    clean === '/exams' ||
    clean === '/faculty' ||
    clean === '/profile' ||
    clean === '/courses' ||
    clean === '/grades' ||
    clean === '/predictor'
  ) {
    let subTab: AcademicsSubTab = 'profile';
    if (clean.startsWith('/academics/')) {
      const part = clean.replace('/academics/', '').split('/')[0] as AcademicsSubTab;
      if (['profile', 'attendance', 'calendar', 'timetable', 'marks', 'exams', 'grades', 'faculty', 'courses'].includes(part)) {
        subTab = part;
      }
    } else if (clean === '/attendance') subTab = 'attendance';
    else if (clean === '/calendar') subTab = 'calendar';
    else if (clean === '/timetable') subTab = 'timetable';
    else if (clean === '/marks') subTab = 'marks';
    else if (clean === '/exams') subTab = 'exams';
    else if (clean === '/grades' || clean === '/predictor') subTab = 'grades';
    else if (clean === '/faculty') subTab = 'faculty';
    else if (clean === '/courses') subTab = 'courses';

    return { isLanding: false, isLogin: false, isAdmin: false, view: 'academics', academicsSubTab: subTab };
  }
  if (clean === '/assignments' || clean === '/tasks' || clean === '/deadlines') {
    return { isLanding: false, isLogin: false, isAdmin: false, view: 'assignments' };
  }
  if (clean === '/fees' || clean === '/receipts' || clean === '/dues') {
    return { isLanding: false, isLogin: false, isAdmin: false, view: 'fees' };
  }
  if (clean === '/placements' || clean === '/dsa' || clean === '/leetcode') {
    return { isLanding: false, isLogin: false, isAdmin: false, view: 'placements' };
  }
  if (clean === '/ai-planner' || clean === '/planner') {
    return { isLanding: false, isLogin: false, isAdmin: false, view: 'ai-planner' };
  }
  return { isLanding: true, isLogin: false, isAdmin: false, view: 'dashboard' };
};

const applyManualStatusOverrides = (items: Assignment[], regNo?: string): Assignment[] => {
  if (typeof window === 'undefined' || !items || items.length === 0) return items;
  try {
    const reg = regNo || window.localStorage.getItem('campus_current_reg_no') || 'default';
    const raw = window.localStorage.getItem(`campus_manual_assignment_status_${reg}`);
    const overrides = raw ? JSON.parse(raw) : {};
    return items.map((a) => {
      let manualDone: boolean | undefined = undefined;
      if (a.id && overrides[a.id] !== undefined) {
        manualDone = overrides[a.id];
      } else if (a.id && a.id.startsWith('unified-')) {
        for (const p of a.id.replace('unified-', '').split('-')) {
          if (p && overrides[p] !== undefined) {
            manualDone = overrides[p];
            break;
          }
        }
      } else if (a.title && overrides[a.title] !== undefined) {
        // Only fall back to title override if no conflicting verified Teams submission
        const isTeams = isTeamsAssignment(a);
        const rawTeamsState = String((a as any).teamsSubmissionState || (a as any).submissionStatus || '').trim().toLowerCase();
        const hasVerifiedTeamsSubmission = isTeams && (
          ['submitted', 'turnedin', 'returned', 'released'].includes(rawTeamsState) ||
          Boolean((a as any).submittedAt)
        );
        if (!hasVerifiedTeamsSubmission) {
          manualDone = overrides[a.title];
        }
      }

      const done = manualDone !== undefined ? manualDone : isAssignmentDone(a, reg);
      const isTeams = isTeamsAssignment(a);

      return {
        ...a,
        isDone: done,
        isSubmitted: done,
        status: done ? (isTeams ? 'Turned in' : 'Submitted') : 'Pending',
        displayStatus: done ? 'DONE' : 'PENDING',
        applicationStatus: done ? 'DONE' : 'PENDING',
      };
    });
  } catch {
    return items;
  }
};

export const App: React.FC = () => {
  // Navigation & Theme States
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campusos_theme');
      if (saved) return saved as ThemeType;
    }
    return 'editorial-dark';
  });
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [academicsSubTab, setAcademicsSubTab] = useState<AcademicsSubTab>('profile');
  const [showVtopModal, setShowVtopModal] = useState<boolean>(false);
  const [vtopModalNotice, setVtopModalNotice] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showMobileMore, setShowMobileMore] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showODModal, setShowODModal] = useState<boolean>(false);
  const [odData, setOdData] = useState<ODResponse | null>(null);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('campusos_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Teams & LMS Integration States
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState<boolean>(false);
  const [isLMSModalOpen, setIsLMSModalOpen] = useState<boolean>(false);
  const [teamsAccount, setTeamsAccount] = useState<any>({ connected: false, status: 'disconnected' });
  const [lmsAccount, setLmsAccount] = useState<any>({ connected: false, status: 'disconnected' });
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

  // Floating Sync Toast Notification State
  const [syncToast, setSyncToast] = useState<{ visible: boolean; message: string; time: string }>({
    visible: false,
    message: 'Synced Successfully',
    time: '',
  });
  const syncToastTimerRef = useRef<any>(null);

  const triggerSyncToast = (message: string = 'Synced Successfully') => {
    if (syncToastTimerRef.current) {
      clearTimeout(syncToastTimerRef.current);
    }
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncToast({
      visible: true,
      message,
      time: timeStr,
    });
    syncToastTimerRef.current = setTimeout(() => {
      setSyncToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Core Academic Data States
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [marks, setMarks] = useState<Marks[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [placements, setPlacements] = useState<PlacementDrive[]>([]);
  const [dsaTopics, setDsaTopics] = useState<DSACategory[]>([]);
  const [aiTasks, setAiTasks] = useState<AIStudyTask[]>([]);

  // Apply theme to HTML root & persist in localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('campusos_theme', currentTheme);
    }
  }, [currentTheme]);

  // Track high-level view navigation with CampusAnalytics
  useEffect(() => {
    if (isAuthenticated && !showLanding) {
      CampusAnalytics.trackPageView(activeView);
    }
  }, [activeView, isAuthenticated, showLanding]);

  // Secret admin modal shortcut (Ctrl+Shift+A or Cmd+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowAdminModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Interactive RGB outline cursor tracking: calculates pointer angle and position on the deepest hovered card
  useEffect(() => {
    let ticking = false;

    const handlePointerMove = (e: PointerEvent) => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const hoveredCards = document.querySelectorAll('.card-hover:hover');
        if (!hoveredCards.length) return;

        // Select the deepest hovered card where the cursor is placed in
        const target = Array.from(hoveredCards).reverse().find(
          (el) => !el.querySelector('.card-hover:hover')
        ) as HTMLElement | undefined;

        if (target) {
          const rect = target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rad = Math.atan2(y - centerY, x - centerX);
          const deg = ((rad * 180) / Math.PI + 90 + 360) % 360;
          target.style.setProperty('--border-angle', `${deg.toFixed(1)}deg`);
          target.style.setProperty('--mouse-x', `${x.toFixed(1)}px`);
          target.style.setProperty('--mouse-y', `${y.toFixed(1)}px`);
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Load academic platform connection statuses (Teams & LMS)
  const loadAcademicAccountsStatus = async () => {
    try {
      const [statusData, lmsDirectStatus, teamsDirectStatus] = await Promise.all([
        CampusAPI.getAcademicAccountsStatus(),
        CampusAPI.getLMSStatus(),
        CampusAPI.getTeamsStatus(),
      ]);

      const isTeamsConn = Boolean(
        (statusData?.teams?.connected && statusData?.teams?.email) ||
        (teamsDirectStatus?.connected && teamsDirectStatus?.email)
      );

      const isLmsExpired = Boolean(
        statusData?.lms?.status === 'expired' ||
        lmsDirectStatus?.status === 'expired' ||
        statusData?.lms?.expired ||
        lmsDirectStatus?.expired
      );

      const isLmsConn = Boolean(
        !isLmsExpired &&
        ((statusData?.lms?.connected && (statusData?.lms?.username || statusData?.lms?.displayName)) ||
        (lmsDirectStatus?.connected && (lmsDirectStatus?.username || lmsDirectStatus?.displayName)))
      );

      setTeamsAccount((prev: any) => ({
        ...prev,
        ...(statusData?.teams || {}),
        ...(teamsDirectStatus || {}),
        connected: isTeamsConn,
        status: isTeamsConn ? 'connected' : (prev.status === 'failed' ? 'failed' : 'disconnected'),
      }));

      setLmsAccount((prev: any) => ({
        ...prev,
        ...(statusData?.lms || {}),
        ...(lmsDirectStatus || {}),
        connected: isLmsConn,
        status: isLmsConn ? 'connected' : (isLmsExpired ? 'expired' : (prev.status === 'failed' ? 'failed' : 'disconnected')),
      }));
    } catch (e) {
      console.warn('Failed to load academic accounts status:', e);
      setTeamsAccount({ connected: false, status: 'disconnected' });
      setLmsAccount({ connected: false, status: 'disconnected' });
    }
  };

  // Load all initial academic modules from backend
  const loadAllData = async () => {
    try {
      setSyncing(true);
      const vtopStatus = await CampusAPI.getVtopStatus();
      if (!vtopStatus || !vtopStatus.authenticated) {
        // If the user was already authenticated, NEVER wipe state or log them out
        if (!isAuthenticated) {
          setIsAuthenticated(false);
          setStudent(null);
          setCourses([]);
          setTimetable([]);
          setAttendance([]);
          setMarks([]);
          setExams([]);
          setFaculty([]);
          setAssignments([]);
        }
        return;
      }

      const [
        studentData,
        coursesData,
        timetableData,
        attendanceData,
        marksData,
        examsData,
        facultyData,
        assignmentsData,
        feesData,
        placementsData,
        dsaData,
        aiData,
        odResult,
      ] = await Promise.all([
        CampusAPI.getStudentProfile(),
        CampusAPI.getCourses(),
        CampusAPI.getTimetable(),
        CampusAPI.getAttendance(),
        CampusAPI.getMarks(),
        CampusAPI.getExams(),
        CampusAPI.getFaculty(),
        CampusAPI.getAssignments(),
        CampusAPI.getFees(),
        CampusAPI.getPlacementDrives(),
        CampusAPI.getDSATracker(),
        CampusAPI.getAIStudyTasks(),
        CampusAPI.getOD(),
      ]);

      const isAuthed = Boolean(
        studentData &&
        studentData.regNo &&
        studentData.regNo !== 'Not available' &&
        studentData.regNo !== 'Sync Required'
      );

      if (isAuthed) {
        setStudent(studentData);
        if (coursesData && coursesData.length > 0) setCourses(coursesData);
        if (timetableData && timetableData.length > 0) setTimetable(timetableData);
        if (attendanceData && attendanceData.length > 0) setAttendance(attendanceData);
        if (marksData && marksData.length > 0) setMarks(marksData);
        if (examsData && (Array.isArray(examsData) ? examsData.length > 0 : Object.keys(examsData).length > 0)) setExams(examsData as any);
        if (facultyData && facultyData.length > 0) setFaculty(facultyData);
        if (assignmentsData && assignmentsData.length > 0) setAssignments(applyManualStatusOverrides(assignmentsData, studentData?.regNo));
        if (feesData && feesData.length > 0) setFees(feesData);
        if (placementsData && placementsData.length > 0) setPlacements(placementsData);
        if (dsaData && dsaData.length > 0) setDsaTopics(dsaData);
        if (aiData && aiData.length > 0) setAiTasks(aiData);
        if (odResult) setOdData(odResult);
        setIsAuthenticated(true);
      } else {
        if (!isAuthenticated) {
          setIsAuthenticated(false);
          setStudent(null);
        }
      }

      await loadAcademicAccountsStatus();
    } catch (err) {
      console.error('Failed to load campus data:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Unified Sync All Handler (Runs across Teams and LMS concurrently)
  const handleSyncAll = async () => {
    if (syncingAll) return; // Prevent duplicate requests
    setSyncingAll(true);
    setSyncResultMsg(null);

    try {
      const res = await CampusAPI.syncAllAcademicAccounts();

      // Refresh accounts status
      await loadAcademicAccountsStatus();

      // Extract unified assignments and update shared state instantly
      if (res.dashboard) {
        const flatList: Assignment[] = [];
        if (res.dashboard.subjects) {
          res.dashboard.subjects.forEach((s: SubjectAssignmentGroup) => {
            if (s.assignments) flatList.push(...s.assignments);
          });
        }
        if (res.dashboard.unmatchedAssignments) {
          flatList.push(...res.dashboard.unmatchedAssignments);
        }
        if (flatList.length > 0) {
          setAssignments(applyManualStatusOverrides(flatList, student?.regNo));
        }
      } else {
        const freshAssignments = await CampusAPI.getAssignments();
        if (freshAssignments) {
          setAssignments(applyManualStatusOverrides(freshAssignments, student?.regNo));
        }
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncResultMsg(res.message ? `✓ ${res.message} (${timeStr})` : `✓ Synced all accounts successfully (${timeStr})`);
      if (res.message && res.message.toLowerCase().includes('lms') && (res.message.toLowerCase().includes('expired') || res.message.toLowerCase().includes('sign in'))) {
        triggerSyncToast('LMS session expired — please re-link LMS');
      } else {
        triggerSyncToast('Synced Successfully');
      }
    } catch (err: any) {
      console.error('Failed to sync all accounts:', err);
      setSyncResultMsg(`⚠️ Sync encountered an error: ${err.message || 'Network error'}`);
    } finally {
      setSyncingAll(false);
    }
  };

  // Direct Live Sync Handler (Resyncs through source directly without prompting credentials if already authenticated)
  const handleHeaderSync = async () => {
    if (syncing) return;
    if (!isAuthenticated) {
      setVtopModalNotice('');
      setShowVtopModal(true);
      return;
    }

    setSyncing(true);
    CampusAnalytics.trackEvent('sync_started', '/sync');
    try {
      // 1. Direct VTOP background re-scrape with existing authenticated session (or silent auto-reauth)
      const vtopResult = await CampusAPI.syncVtop();
      if (vtopResult && vtopResult.success === false) {
        console.warn('[CampusAPI] VTOP live sync notice:', vtopResult.message);
        // CRITICAL: Do NOT sign out or wipe dashboard state!
        // Open the login modal with an informative message so the user can re-authenticate.
        setVtopModalNotice(
          vtopResult.message ||
            'VTOP session expired. Sign in with your VTOP credentials to fetch the latest details.'
        );
        setShowVtopModal(true);
        triggerSyncToast('VTOP Session Expired — Please Sign In to Refresh');
        return;
      }

      // If fresh data was returned directly in vtopResult, update local state immediately
      if (vtopResult && vtopResult.success) {
        const d = (vtopResult as any)?.data || vtopResult;
        const studentObj: StudentProfile | null = (d.student as StudentProfile) || null;
        if (studentObj && studentObj.regNo) {
          CampusAPI.setActiveStudent(studentObj);
          setStudent(studentObj);
          CampusAnalytics.syncProfile(studentObj);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('campus_current_reg_no', studentObj.regNo);
            window.localStorage.setItem('campus_user_data_' + studentObj.regNo, JSON.stringify(d));
          }
        }
        if (d.courses && d.courses.length > 0) setCourses(d.courses);
        if (d.timetable && d.timetable.length > 0) setTimetable(d.timetable);
        if (d.attendance && d.attendance.length > 0) setAttendance(d.attendance);
        if (d.marks && d.marks.length > 0) setMarks(d.marks);
        if (d.exams && (Array.isArray(d.exams) ? d.exams.length > 0 : Object.keys(d.exams).length > 0)) setExams(d.exams as any);
        if (d.faculty && d.faculty.length > 0) setFaculty(d.faculty);
        if (d.assignments && d.assignments.length > 0) setAssignments(applyManualStatusOverrides(d.assignments, studentObj?.regNo));
        if (d.fees && d.fees.length > 0) setFees(d.fees);
        if (d.placements && d.placements.length > 0) setPlacements(d.placements);
        if (d.dsaTopics && d.dsaTopics.length > 0) setDsaTopics(d.dsaTopics);
        if (d.aiTasks && d.aiTasks.length > 0) setAiTasks(d.aiTasks);
        if (d.od) setOdData(d.od);
      }

      // 2. Concurrently re-sync connected academic platforms (Teams + LMS)
      try {
        await CampusAPI.syncAllAcademicAccounts();
      } catch (accErr) {
        console.warn('Academic accounts sync notice:', accErr);
      }

      // 3. Reload all student data into React state
      await loadAllData();
      if (typeof window !== 'undefined') {
        const nowMs = Date.now();
        const syncKey = student?.regNo ? `campus_last_sync_timestamp_${student.regNo}` : 'campus_last_sync_timestamp';
        window.localStorage.setItem(syncKey, String(nowMs));
        window.localStorage.setItem('campus_last_sync_timestamp', String(nowMs));
      }
      triggerSyncToast('Synced Successfully');
      CampusAnalytics.trackEvent('sync_completed', '/sync');
    } catch (err: any) {
      console.warn('Direct live sync notice:', err);
      // Even on error, NEVER wipe existing dashboard state
      triggerSyncToast(err?.message || 'Sync encountered a network issue');
      CampusAnalytics.trackEvent('sync_failed', '/sync');
    } finally {
      setSyncing(false);
    }
  };

  const applyRoute = useCallback((path: string, overrideAuth?: boolean) => {
    const authed = overrideAuth !== undefined ? overrideAuth : isAuthenticated;
    const route = getRouteFromPath(path);
    if (route.isAdmin) {
      setShowAdminModal(true);
    }

    if (route.isLanding) {
      setShowLanding(true);
      if (route.isLogin) {
        setShowVtopModal(true);
      }
      return;
    }

    // Protected Route
    if (authed) {
      setShowLanding(false);
      setActiveView(route.view);
      if (route.academicsSubTab) {
        setAcademicsSubTab(route.academicsSubTab);
      }
      const clean = (path || '').toLowerCase().replace(/\/+$/, '');
      if (clean === '/vtop-sync' || clean === '/vtop' || clean === '/sync') {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/academics');
        }
      }
    } else {
      // Unauthenticated user attempting to access protected route -> Redirect to "/"
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
      setShowLanding(true);
      if (route.isLogin) {
        setShowVtopModal(true);
      }
    }
  }, [isAuthenticated]);

  const handleSelectAcademicsSubTab = (subTab: AcademicsSubTab) => {
    setActiveView('academics');
    setAcademicsSubTab(subTab);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/academics/${subTab}`);
    }
  };

  // Initial Auth & Route Detection
  useEffect(() => {
    let isMounted = true;

    const initAuthAndRouting = async () => {
      try {
        const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
        const initialRoute = getRouteFromPath(initialPath);

        const savedRegNo = typeof window !== 'undefined'
          ? (window.localStorage.getItem('campus_current_reg_no') || window.localStorage.getItem('campus_vtop_username'))
          : null;
        let cachedUserData: any = null;
        if (savedRegNo) {
          try {
            const raw = window.localStorage.getItem('campus_user_data_' + savedRegNo);
            if (raw) cachedUserData = JSON.parse(raw);
          } catch (e) {}
        }

        let authed = false;
        let studentProfile: any = null;

        const status = await CampusAPI.getVtopStatus();
        authed = Boolean(
          status &&
          status.authenticated &&
          status.student?.regNo &&
          status.student.regNo !== 'Not available' &&
          status.student.regNo !== 'Sync Required'
        );

        if (authed && status.student) {
          studentProfile = status.student;
          CampusAPI.setActiveStudent(studentProfile);
          if (typeof window !== 'undefined' && studentProfile.regNo) {
            window.localStorage.setItem('campus_current_reg_no', studentProfile.regNo);
          }
          if (cachedUserData && isMounted) {
            const cd = (cachedUserData as any)?.data || cachedUserData;
            setStudent(studentProfile);
            if (cd.courses?.length > 0) setCourses(cd.courses);
            if (cd.timetable?.length > 0) setTimetable(cd.timetable);
            if (cd.attendance?.length > 0) setAttendance(cd.attendance);
            if (cd.marks?.length > 0) setMarks(cd.marks);
            if (cd.exams && Object.keys(cd.exams).length > 0) setExams(cd.exams);
            if (cd.faculty?.length > 0) setFaculty(cd.faculty);
          }
        } else {
          authed = false;
          studentProfile = null;
          CampusAPI.setActiveStudent(null);
          CampusAPI.setActiveSessionId(null);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('campus_current_reg_no');
          }
        }

        if (!isMounted) return;

        setIsAuthenticated(authed);

        if (authed) {
          if (studentProfile) {
            setStudent(studentProfile);
            CampusAnalytics.syncProfile(studentProfile);
            CampusAnalytics.trackEvent('session_restored', initialPath);
          }
          await loadAllData();

          if (!isMounted) return;

          // If directly opened a protected route while authenticated, display it
          if (!initialRoute.isLanding) {
            setShowLanding(false);
            setActiveView(initialRoute.view);
            if (initialRoute.academicsSubTab) {
              setAcademicsSubTab(initialRoute.academicsSubTab);
            }
          } else {
            setShowLanding(true);
            if (initialRoute.isLogin) {
              setShowVtopModal(true);
            }
          }
        } else {
          // Unauthenticated -> ensure landing page is displayed
          setStudent(null);
          if (!initialRoute.isLanding) {
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/');
            }
          }
          setShowLanding(true);
          if (initialRoute.isLogin) {
            setShowVtopModal(true);
          }
        }
      } catch (e) {
        console.warn('Auth init failed, defaulting to landing page:', e);
        if (isMounted) {
          setIsAuthenticated(false);
          setShowLanding(true);
          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            window.history.replaceState(null, '', '/');
          }
        }
      } finally {
        if (isMounted) {
          setAuthInitializing(false);
        }
      }
    };

    initAuthAndRouting();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Browser Back/Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      applyRoute(currentPath);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyRoute]);

  // Periodic Keep-Alive Heartbeat for VTOP session (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Run keep-alive ping every 5 minutes to prevent VTOP 15-minute inactivity timeout
    const interval = setInterval(() => {
      CampusAPI.keepAliveVtop().catch((err) => {
        console.debug('[CampusAPI] Keep-alive notice:', err);
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    const currentReg = student?.regNo;
    CampusAnalytics.trackEvent('logout', '/');
    try {
      setSyncing(true);
      await CampusAPI.logoutVtop();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      // 1. Invalidate session & reset auth state
      CampusAPI.setActiveSessionId(null);
      CampusAPI.setActiveStudent(null);
      setIsAuthenticated(false);
      setShowLanding(true);
      setShowVtopModal(false);
      setIsTeamsModalOpen(false);
      setIsLMSModalOpen(false);
      setSyncing(false);
      setSyncingAll(false);
      setSyncResultMsg(null);
      setTeamsAccount({ connected: false, status: 'disconnected' });
      setLmsAccount({ connected: false, status: 'disconnected' });

      // 2. Clear all sensitive user/academic dataset
      setStudent(null);
      setCourses([]);
      setTimetable([]);
      setAttendance([]);
      setMarks([]);
      setExams([]);
      setFaculty([]);
      setAssignments([]);
      setFees([]);
      setPlacements([]);
      setDsaTopics([]);
      setAiTasks([]);
      setOdData(null);

      // 3. Clear all cached browser credentials and user-scoped storage
      if (typeof window !== 'undefined') {
        if (currentReg) {
          window.localStorage.removeItem('campus_user_data_' + currentReg);
          window.localStorage.removeItem(`campus_lms_account_${currentReg}`);
          window.localStorage.removeItem(`campus_teams_account_${currentReg}`);
        }
        window.localStorage.removeItem('campus_current_reg_no');
        window.localStorage.removeItem('campusos_leetcode_username');
        window.localStorage.removeItem('campus_lms_account');
        window.localStorage.removeItem('campus_teams_account');

        // Purge any remaining stale platform keys
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('campus_teams_account') || key.startsWith('campus_lms_account')) {
            window.localStorage.removeItem(key);
          }
        });

        window.history.replaceState(null, '', '/');
      }
    }
  };

  const handleLoginSuccess = async (data?: any) => {
    const payload = (data as any)?.data || data;

    // 1. Instantly reset all previous academic state to guarantee zero cross-user leakage
    setCourses([]);
    setTimetable([]);
    setAttendance([]);
    setMarks([]);
    setExams([]);
    setFaculty([]);
    setAssignments([]);
    setFees([]);
    setPlacements([]);
    setDsaTopics([]);
    setAiTasks([]);
    setOdData(null);

    setShowVtopModal(false);
    setIsAuthenticated(true);

    const d = (payload as any)?.data || payload;
    const studentObj = d?.student || (d?.regNo ? d : null);
    if (studentObj) {
      CampusAPI.setActiveStudent(studentObj);
      setStudent(studentObj);
      CampusAnalytics.syncProfile(studentObj);
      CampusAnalytics.trackEvent('login_success', '/dashboard');
      if (typeof window !== 'undefined' && studentObj.regNo) {
        window.localStorage.setItem('campus_current_reg_no', studentObj.regNo);
        if (d) {
          window.localStorage.setItem('campus_user_data_' + studentObj.regNo, JSON.stringify(d));
        }
      }
    }

    if (d && d.courses && d.courses.length > 0) setCourses(d.courses);
    if (d && d.timetable && d.timetable.length > 0) setTimetable(d.timetable);
    if (d && d.attendance && d.attendance.length > 0) setAttendance(d.attendance);
    if (d && d.marks && d.marks.length > 0) setMarks(d.marks);
    if (d && d.exams && (Array.isArray(d.exams) ? d.exams.length > 0 : Object.keys(d.exams).length > 0)) setExams(d.exams);
    if (d && d.faculty && d.faculty.length > 0) setFaculty(d.faculty);
    if (d && d.assignments && d.assignments.length > 0) {
      setAssignments(applyManualStatusOverrides(d.assignments, d.student?.regNo || studentObj?.regNo));
    }
    if (d && d.fees && d.fees.length > 0) setFees(d.fees);
    if (d && d.placements && d.placements.length > 0) setPlacements(d.placements);
    if (d && d.dsaTopics && d.dsaTopics.length > 0) setDsaTopics(d.dsaTopics);
    if (d && d.aiTasks && d.aiTasks.length > 0) setAiTasks(d.aiTasks);
    if (d && d.od) setOdData(d.od);

    await loadAllData();
    if (typeof window !== 'undefined') {
      const nowMs = Date.now();
      const regToUse = studentObj?.regNo || d?.student?.regNo;
      const syncKey = regToUse ? `campus_last_sync_timestamp_${regToUse}` : 'campus_last_sync_timestamp';
      window.localStorage.setItem(syncKey, String(nowMs));
      window.localStorage.setItem('campus_last_sync_timestamp', String(nowMs));
    }
    triggerSyncToast('Synced Successfully');
    setShowLanding(false);
    setActiveView('dashboard');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/dashboard');
    }
  };

  const handleToggleAssignment = async (id: string, currentStatus: 'Pending' | 'Submitted' | string) => {
    const isCurrentlyDone = currentStatus === 'Submitted' || currentStatus === 'Turned in' || currentStatus === 'DONE';
    const isDone = !isCurrentlyDone;
    const target = assignments.find((x) => x.id === id);
    const isTeams = target ? isTeamsAssignment(target) : false;
    const nextStatus = isDone ? (isTeams ? 'Turned in' : 'Submitted') : 'Pending';

    // 1. Immediately persist manual checkmark to student-scoped localStorage
    if (typeof window !== 'undefined') {
      try {
        const reg = student?.regNo || window.localStorage.getItem('campus_current_reg_no') || 'default';
        const key = `campus_manual_assignment_status_${reg}`;
        const raw = window.localStorage.getItem(key);
        const overrides = raw ? JSON.parse(raw) : {};
        overrides[id] = isDone;
        const target = assignments.find((x) => x.id === id);
        if (target?.title) overrides[target.title] = isDone;
        if (id.startsWith('unified-')) {
          id.replace('unified-', '').split('-').forEach((p) => {
            if (p) overrides[p] = isDone;
          });
        }
        window.localStorage.setItem(key, JSON.stringify(overrides));
      } catch (e) {
        console.warn('[CampusOS] Could not save manual assignment override:', e);
      }
    }

    // 2. Optimistic UI update for immediate responsiveness
    const updatedAssignments = assignments.map((a) => {
      let isMatch = a.id === id;
      if (!isMatch && id.startsWith('unified-')) {
        const parts = id.replace('unified-', '').split('-');
        isMatch = parts.includes(a.id);
      } else if (!isMatch && a.id.startsWith('unified-')) {
        const parts = a.id.replace('unified-', '').split('-');
        isMatch = parts.includes(id);
      }
      if (isMatch) {
        return {
          ...a,
          status: nextStatus,
          displayStatus: isDone ? 'DONE' : 'PENDING',
          applicationStatus: isDone ? 'DONE' : 'PENDING',
          isDone: isDone,
          isSubmitted: isDone,
        };
      }
      return a;
    });
    setAssignments(updatedAssignments);

    try {
      await CampusAPI.updateAssignmentStatus(id, nextStatus);
    } catch (err) {
      console.warn('Backend update failed, keeping optimistic status in localStorage:', err);
    }
  };

  // 6-Hour Background Auto-Sync Engine (Refreshes full VTOP, Teams & LMS records)
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const performAutoSync = useCallback(async (isSilent = true) => {
    if (!isAuthenticated || syncing) return;
    try {
      console.info('[CampusOS Auto-Sync] Automatically triggering 6-hour sync refresh...');
      if (!isSilent) setSyncing(true);
      const vtopResult = await CampusAPI.syncVtop();
      if (vtopResult && vtopResult.success) {
        const d = (vtopResult as any)?.data || vtopResult;
        const studentObj: StudentProfile | null = (d.student as StudentProfile) || null;
        if (studentObj && studentObj.regNo) {
          CampusAPI.setActiveStudent(studentObj);
          setStudent(studentObj);
          CampusAnalytics.syncProfile(studentObj);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('campus_current_reg_no', studentObj.regNo);
            window.localStorage.setItem('campus_user_data_' + studentObj.regNo, JSON.stringify(d));
          }
        }
        if (d.courses && d.courses.length > 0) setCourses(d.courses);
        if (d.timetable && d.timetable.length > 0) setTimetable(d.timetable);
        if (d.attendance && d.attendance.length > 0) setAttendance(d.attendance);
        if (d.marks && d.marks.length > 0) setMarks(d.marks);
        if (d.exams) setExams(d.exams as any);
        if (d.faculty && d.faculty.length > 0) setFaculty(d.faculty);
        if (d.assignments && d.assignments.length > 0) setAssignments(applyManualStatusOverrides(d.assignments, studentObj?.regNo));
        if (d.fees && d.fees.length > 0) setFees(d.fees);
        if (d.placements && d.placements.length > 0) setPlacements(d.placements);
        if (d.dsaTopics && d.dsaTopics.length > 0) setDsaTopics(d.dsaTopics);
        if (d.aiTasks && d.aiTasks.length > 0) setAiTasks(d.aiTasks);
        if (d.od) setOdData(d.od);
      }
      try {
        await CampusAPI.syncAllAcademicAccounts();
      } catch (accErr) {
        console.debug('[CampusOS Auto-Sync] Academic accounts sync notice:', accErr);
      }
      await loadAllData();

      const nowMs = Date.now();
      if (typeof window !== 'undefined') {
        const syncKey = student?.regNo ? `campus_last_sync_timestamp_${student.regNo}` : 'campus_last_sync_timestamp';
        window.localStorage.setItem(syncKey, String(nowMs));
        window.localStorage.setItem('campus_last_sync_timestamp', String(nowMs));
      }
      triggerSyncToast('Auto-synced latest academic records (6h refresh)');
      console.info('[CampusOS Auto-Sync] 6-hour automated sync completed successfully.');
    } catch (err) {
      console.debug('[CampusOS Auto-Sync] 6-hour background auto-sync notice:', err);
    } finally {
      if (!isSilent) setSyncing(false);
    }
  }, [isAuthenticated, syncing, student, loadAllData, triggerSyncToast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkAndTriggerAutoSync = () => {
      if (typeof window === 'undefined') return;
      const syncKey = student?.regNo ? `campus_last_sync_timestamp_${student.regNo}` : 'campus_last_sync_timestamp';
      const lastSyncRaw = window.localStorage.getItem(syncKey) || window.localStorage.getItem('campus_last_sync_timestamp');
      let lastSyncTime = lastSyncRaw ? Number(lastSyncRaw) : 0;

      // Fallback to student.lastSynced ISO string if local timestamp not set
      if (!lastSyncTime && student?.lastSynced) {
        const parsed = new Date(student.lastSynced).getTime();
        if (!isNaN(parsed)) lastSyncTime = parsed;
      }

      // If never recorded before, initialize current timestamp
      if (!lastSyncTime) {
        window.localStorage.setItem(syncKey, String(Date.now()));
        window.localStorage.setItem('campus_last_sync_timestamp', String(Date.now()));
        return;
      }

      const elapsed = Date.now() - lastSyncTime;
      if (elapsed >= SIX_HOURS_MS) {
        console.info(`[CampusOS Auto-Sync] ${Math.round(elapsed / (60 * 60 * 1000))}h elapsed since last sync (>= 6h). Auto-syncing now...`);
        performAutoSync(true);
      }
    };

    // Check immediately on load/mount
    checkAndTriggerAutoSync();

    // Check periodically every minute for 6-hour boundary crossing
    const interval = setInterval(() => {
      checkAndTriggerAutoSync();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, student, performAutoSync]);

  if (authInitializing) {
    return (
      <div
        data-theme={currentTheme}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
        <p style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-secondary)' }}>
          Restoring Verified CampusOS Session...
        </p>
      </div>
    );
  }

  const pendingAssignmentsCount = assignments.filter((a) => !isAssignmentDone(a, student?.regNo)).length;
  const criticalAttendanceCount = courses.filter((c) => c.attendance?.isCritical).length;

  if (showLanding || !isAuthenticated || !student) {
    return (
      <div data-theme={currentTheme}>
        <LandingPageView
          currentTheme={currentTheme}
          onSelectTheme={setCurrentTheme}
          onOpenLogin={() => {
            setShowVtopModal(true);
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.history.pushState(null, '', '/login');
            }
          }}
          onEnterApp={() => {
            if (isAuthenticated && student) {
              setShowLanding(false);
              setActiveView('dashboard');
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/dashboard');
              }
            } else {
              setShowVtopModal(true);
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/login');
              }
            }
          }}
          studentName={student?.name}
          isLoggedIn={isAuthenticated}
        />
        <VtopLoginModal
          isOpen={showVtopModal}
          noticeMessage={vtopModalNotice}
          onClose={() => {
            setShowVtopModal(false);
            setVtopModalNotice('');
            if (typeof window !== 'undefined' && window.location.pathname === '/login') {
              window.history.replaceState(null, '', '/');
            }
          }}
          onLoginSuccess={handleLoginSuccess}
        />
        <AdminAnalyticsModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          studentRegNo={student?.regNo}
        />
        {syncToast.visible && (
          <div className="floating-sync-toast-container" role="status" aria-live="polite">
            <div className="floating-sync-toast">
              <div className="sync-toast-icon-wrap">
                <CheckCircle2 size={16} strokeWidth={2.5} />
              </div>
              <div className="sync-toast-text">
                <span>{syncToast.message}</span>
                {syncToast.time && <span className="sync-toast-time">• {syncToast.time}</span>}
              </div>
              <button
                onClick={() => setSyncToast((prev) => ({ ...prev, visible: false }))}
                className="sync-toast-close"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-theme={currentTheme}>
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (view === 'academics') {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/academics/${academicsSubTab}`);
            }
          } else if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/${view}`);
          }
        }}
        academicsSubTab={academicsSubTab}
        onSelectAcademicsSubTab={handleSelectAcademicsSubTab}
        pendingAssignmentsCount={pendingAssignmentsCount}
        criticalAttendanceCount={criticalAttendanceCount}
        onLogout={handleSignOut}
        onOpenAdmin={() => setShowAdminModal(true)}
        onOpenFeatures={() => setIsFeatureModalOpen(true)}
        student={student}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenLMS={() => setIsLMSModalOpen(true)}
        onOpenTeams={() => setIsTeamsModalOpen(true)}
        onOpenOD={() => setShowODModal(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => {
          const next = !isSidebarCollapsed;
          setIsSidebarCollapsed(next);
          if (typeof window !== 'undefined') {
            localStorage.setItem('campusos_sidebar_collapsed', String(next));
          }
        }}
      />

      <div className={`main-viewport flex flex-col flex-1 min-h-screen ${isSidebarCollapsed ? 'lg:ml-20 lg:w-[calc(100%-80px)]' : 'lg:ml-64 lg:w-[calc(100%-256px)]'} transition-all duration-200`}>
        <Header
          student={student}
          activeView={activeView}
          currentTheme={currentTheme}
          onSelectTheme={setCurrentTheme}
          onSync={handleHeaderSync}
          onOpenVtopModal={() => setShowVtopModal(true)}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onOpenFeatures={() => setIsFeatureModalOpen(true)}
          onToggleMobileMenu={() => setShowMobileMore(true)}
          onLogout={handleSignOut}
          syncing={syncing}
          pendingAssignmentsCount={pendingAssignmentsCount}
          criticalAttendanceCount={criticalAttendanceCount}
          isCollapsed={isSidebarCollapsed}
          onNavigate={(view, subTab) => {
            setActiveView(view as NavView);
            if (subTab) {
              setAcademicsSubTab(subTab as AcademicsSubTab);
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', `/${view}/${subTab}`);
              }
            } else if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/${view}`);
            }
          }}
        />

        <main className="flex-1 w-full px-4 md:px-6 lg:px-8 pt-20 pb-12 max-w-[1600px] mx-auto min-w-0">
        {activeView === 'dashboard' && (
          <DashboardView
            student={student}
            timetable={timetable}
            courses={courses}
            attendance={attendance}
            marks={marks}
            exams={exams}
            assignments={assignments}
            fees={fees}
            placements={placements}
            dsaTopics={dsaTopics}
            aiTasks={aiTasks}
            odData={odData}
            onOpenODModal={() => setShowODModal(true)}
            onSelectView={setActiveView}
            onSelectAcademicsSubTab={handleSelectAcademicsSubTab}
            onToggleAssignment={handleToggleAssignment}
            onSync={handleHeaderSync}
            syncing={syncing}
            onOpenSyncModal={handleHeaderSync}
            teamsAccount={teamsAccount}
            lmsAccount={lmsAccount}
            onLinkTeams={() => {
              setIsTeamsModalOpen(true);
              CampusAnalytics.trackEvent('teams_opened', '/assignments/teams');
            }}
            onLinkLMS={() => {
              setIsLMSModalOpen(true);
              CampusAnalytics.trackEvent('lms_opened', '/assignments/lms');
            }}
            onSyncAll={handleSyncAll}
            syncingAll={syncingAll}
            syncResultMsg={syncResultMsg}
          />
        )}

        {activeView === 'academics' && (
          <AcademicsView
            student={student}
            courses={courses}
            attendance={attendance}
            timetable={timetable}
            marks={marks}
            exams={exams}
            faculty={faculty}
            onForceSync={handleHeaderSync}
            syncing={syncing}
            initialSubTab={academicsSubTab}
          />
        )}

        {activeView === 'assignments' && (
          <AssignmentsView
            assignments={assignments}
            courses={courses}
            onToggleStatus={handleToggleAssignment}
            onAssignmentsUpdated={(updated) => setAssignments(applyManualStatusOverrides(updated, student?.regNo))}
            onLinkTeams={() => {
              setIsTeamsModalOpen(true);
              CampusAnalytics.trackEvent('teams_opened', '/assignments/teams');
            }}
            onLinkLMS={() => {
              setIsLMSModalOpen(true);
              CampusAnalytics.trackEvent('lms_opened', '/assignments/lms');
            }}
            onSyncAll={handleSyncAll}
            syncingAll={syncingAll}
            teamsAccount={teamsAccount}
            lmsAccount={lmsAccount}
            studentEmail={student.email || undefined}
            studentRegNo={student.regNo}
          />
        )}

        {activeView === 'fees' && <FeesView fees={fees} onRefresh={loadAllData} />}

        {activeView === 'placements' && (
          <PlacementsView drives={placements} dsaTopics={dsaTopics} student={student} />
        )}

        {activeView === 'ai-planner' && (
          <AIPlannerView
            tasks={aiTasks}
            timetable={timetable}
            courses={courses}
            attendance={attendance}
            exams={exams}
          />
        )}
        </main>
      </div>

      {/* VTOP Auth & Sync Modal */}
      <VtopLoginModal
        isOpen={showVtopModal}
        noticeMessage={vtopModalNotice}
        onClose={() => {
          setShowVtopModal(false);
          setVtopModalNotice('');
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        }}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Microsoft Teams Auth & Coursework Modal */}
      <TeamsLoginModal
        isOpen={isTeamsModalOpen}
        onClose={() => setIsTeamsModalOpen(false)}
        onLoginSuccess={async () => {
          setIsTeamsModalOpen(false);
          await loadAcademicAccountsStatus();
          await handleSyncAll();
        }}
        onLoginFailure={(errMsg) => {
          setTeamsAccount({
            connected: false,
            status: 'failed',
            error: errMsg,
          });
        }}
        isConnected={teamsAccount?.connected}
        onDisconnect={async () => {
          await CampusAPI.disconnectTeams();
          await loadAcademicAccountsStatus();
          setIsTeamsModalOpen(false);
        }}
        initialEmail={student?.email || ''}
      />

      {/* Moodle LMS Auth & Coursework Modal */}
      <LMSLoginModal
        isOpen={isLMSModalOpen}
        onClose={() => setIsLMSModalOpen(false)}
        onLoginSuccess={async () => {
          setIsLMSModalOpen(false);
          await loadAcademicAccountsStatus();
          await handleSyncAll();
        }}
        onLoginFailure={(errMsg) => {
          setLmsAccount({
            connected: false,
            status: 'failed',
            error: errMsg,
          });
        }}
        isConnected={lmsAccount?.connected}
        onDisconnect={async () => {
          await CampusAPI.disconnectLMS();
          await loadAcademicAccountsStatus();
          setIsLMSModalOpen(false);
        }}
        initialRegNo={student?.regNo || ''}
        initialUsername={student?.regNo || ''}
      />

      {/* CampusOS Admin Telemetry & Analytics Dashboard Modal */}
      <AdminAnalyticsModal
        isOpen={showAdminModal}
        onClose={() => {
          setShowAdminModal(false);
          if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
            window.history.replaceState(null, '', '/dashboard');
          }
        }}
        studentRegNo={student?.regNo}
      />

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/${view}`);
          }
        }}
        onOpenMore={() => setShowMobileMore(true)}
        pendingAssignmentsCount={pendingAssignmentsCount}
        criticalAttendanceCount={criticalAttendanceCount}
      />

      {/* Mobile Slide-Up More Actions Drawer */}
      <MobileMoreDrawer
        isOpen={showMobileMore}
        onClose={() => setShowMobileMore(false)}
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/${view}`);
          }
        }}
        currentTheme={currentTheme}
        onSelectTheme={setCurrentTheme}
        onSync={handleHeaderSync}
        syncing={syncing}
        onOpenVtopModal={handleHeaderSync}
        onOpenProfileModal={() => {
          setShowMobileMore(false);
          setShowProfileModal(true);
        }}
        onOpenFeatures={() => {
          setShowMobileMore(false);
          setIsFeatureModalOpen(true);
        }}
        onLogout={handleSignOut}
      />

      {/* Student Profile & Passwords Policy Card Modal */}
      <StudentProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        student={student}
        onCredentialsUpdated={async () => {
          await loadAcademicAccountsStatus();
          await loadAllData();
        }}
      />

      {/* On-Duty (OD) Hours Breakdown Modal */}
      <ODHoursModal
        isOpen={showODModal}
        onClose={() => setShowODModal(false)}
      />

      {/* Feature Availability & System Readiness Modal */}
      <FeatureAvailabilityModal
        isOpen={isFeatureModalOpen}
        onClose={() => setIsFeatureModalOpen(false)}
        onNavigateTo={(view, subTab) => {
          setActiveView(view as NavView);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/${view}${subTab ? `?tab=${subTab}` : ''}`);
          }
        }}
      />

      {/* Floating Synced Successfully Toast Notification */}
      {syncToast.visible && (
        <div className="floating-sync-toast-container" role="status" aria-live="polite">
          <div className="floating-sync-toast">
            <div className="sync-toast-icon-wrap">
              <CheckCircle2 size={16} strokeWidth={2.5} />
            </div>
            <div className="sync-toast-text">
              <span>{syncToast.message}</span>
              {syncToast.time && <span className="sync-toast-time">• {syncToast.time}</span>}
            </div>
            <button
              onClick={() => setSyncToast((prev) => ({ ...prev, visible: false }))}
              className="sync-toast-close"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
