import React, { useState, useEffect, useCallback } from 'react';
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
} from './types';
import { CampusAPI } from './services/api';
import { Header, ThemeType } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { VtopLoginModal } from './components/VtopLoginModal';
import { TeamsLoginModal } from './components/TeamsLoginModal';
import { LMSLoginModal } from './components/LMSLoginModal';
import { DashboardView } from './views/DashboardView';
import { AcademicsView } from './views/AcademicsView';
import { AssignmentsView } from './views/AssignmentsView';
import { FeesView } from './views/FeesView';
import { PlacementsView } from './views/PlacementsView';
import { AIPlannerView } from './views/AIPlannerView';
import { LandingPageView } from './views/LandingPageView';

interface RouteInfo {
  isLanding: boolean;
  isLogin: boolean;
  view: NavView;
}

const getRouteFromPath = (path: string): RouteInfo => {
  const clean = (path || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '' || clean === '/' || clean === '/home' || clean === '/landing') {
    return { isLanding: true, isLogin: false, view: 'dashboard' };
  }
  if (clean === '/login') {
    return { isLanding: true, isLogin: true, view: 'dashboard' };
  }
  if (clean === '/dashboard') {
    return { isLanding: false, isLogin: false, view: 'dashboard' };
  }
  if (
    clean === '/vtop-sync' ||
    clean === '/vtop' ||
    clean === '/sync' ||
    clean === '/academics' ||
    clean.startsWith('/academics/') ||
    clean === '/attendance' ||
    clean === '/timetable' ||
    clean === '/marks' ||
    clean === '/exams' ||
    clean === '/faculty' ||
    clean === '/profile' ||
    clean === '/courses'
  ) {
    return { isLanding: false, isLogin: false, view: 'academics' };
  }
  if (clean === '/assignments' || clean === '/tasks') {
    return { isLanding: false, isLogin: false, view: 'assignments' };
  }
  if (clean === '/fees' || clean === '/receipts' || clean === '/dues') {
    return { isLanding: false, isLogin: false, view: 'fees' };
  }
  if (clean === '/placements' || clean === '/dsa') {
    return { isLanding: false, isLogin: false, view: 'placements' };
  }
  if (clean === '/ai-planner' || clean === '/planner') {
    return { isLanding: false, isLogin: false, view: 'ai-planner' };
  }
  return { isLanding: true, isLogin: false, view: 'dashboard' };
};

export const App: React.FC = () => {
  // Navigation & Theme States
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('midnight-slate');
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [showVtopModal, setShowVtopModal] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Teams & LMS Integration States
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState<boolean>(false);
  const [isLMSModalOpen, setIsLMSModalOpen] = useState<boolean>(false);
  const [teamsAccount, setTeamsAccount] = useState<any>({ connected: false, status: 'disconnected' });
  const [lmsAccount, setLmsAccount] = useState<any>({ connected: false, status: 'disconnected' });
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

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

  // Apply theme to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Load academic platform connection statuses (Teams & LMS)
  const loadAcademicAccountsStatus = async () => {
    try {
      const [statusData, lmsDirectStatus, teamsDirectStatus] = await Promise.all([
        CampusAPI.getAcademicAccountsStatus(),
        CampusAPI.getLMSStatus(),
        CampusAPI.getTeamsStatus(),
      ]);

      const storedLms = typeof window !== 'undefined' ? window.localStorage.getItem('campus_lms_account') : null;
      let parsedLms: any = null;
      if (storedLms) {
        try { parsedLms = JSON.parse(storedLms); } catch (e) {}
      }

      const storedTeams = typeof window !== 'undefined' ? window.localStorage.getItem('campus_teams_account') : null;
      let parsedTeams: any = null;
      if (storedTeams) {
        try { parsedTeams = JSON.parse(storedTeams); } catch (e) {}
      }

      const isTeamsConn = Boolean(statusData?.teams?.connected || teamsDirectStatus?.connected || parsedTeams?.connected);
      const isLmsConn = Boolean(statusData?.lms?.connected || lmsDirectStatus?.connected || parsedLms?.connected);

      setTeamsAccount({
        ...(statusData?.teams || {}),
        ...(teamsDirectStatus || {}),
        ...(parsedTeams || {}),
        connected: isTeamsConn,
        status: isTeamsConn ? 'connected' : 'disconnected',
      });

      setLmsAccount({
        ...(statusData?.lms || {}),
        ...(lmsDirectStatus || {}),
        ...(parsedLms || {}),
        connected: isLmsConn,
        status: isLmsConn ? 'connected' : 'disconnected',
      });
    } catch (e) {
      console.warn('Failed to load academic accounts status:', e);
    }
  };

  // Load all initial academic modules from backend
  const loadAllData = async () => {
    try {
      setSyncing(true);
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
        if (assignmentsData && assignmentsData.length > 0) setAssignments(assignmentsData);
        if (feesData && feesData.length > 0) setFees(feesData);
        if (placementsData && placementsData.length > 0) setPlacements(placementsData);
        if (dsaData && dsaData.length > 0) setDsaTopics(dsaData);
        if (aiData && aiData.length > 0) setAiTasks(aiData);
        setIsAuthenticated(true);
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
          setAssignments(flatList);
        }
      } else {
        const freshAssignments = await CampusAPI.getAssignments();
        if (freshAssignments) {
          setAssignments(freshAssignments);
        }
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncResultMsg(res.message ? `✓ ${res.message} (${timeStr})` : `✓ Synced all accounts successfully (${timeStr})`);
    } catch (err: any) {
      console.error('Failed to sync all accounts:', err);
      setSyncResultMsg(`⚠️ Sync encountered an error: ${err.message || 'Network error'}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const applyRoute = useCallback((path: string, overrideAuth?: boolean) => {
    const authed = overrideAuth !== undefined ? overrideAuth : isAuthenticated;
    const route = getRouteFromPath(path);

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

  // Initial Auth & Route Detection
  useEffect(() => {
    let isMounted = true;

    const initAuthAndRouting = async () => {
      try {
        const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
        const initialRoute = getRouteFromPath(initialPath);

        const savedRegNo = typeof window !== 'undefined' ? window.localStorage.getItem('campus_current_reg_no') : null;
        let cachedUserData: any = null;
        if (savedRegNo) {
          try {
            const raw = window.localStorage.getItem('campus_user_data_' + savedRegNo);
            if (raw) cachedUserData = JSON.parse(raw);
          } catch (e) {}
        }

        let authed = false;
        let studentProfile: any = null;

        if (cachedUserData && (cachedUserData.student?.regNo || cachedUserData.regNo)) {
          authed = true;
          studentProfile = cachedUserData.student || (cachedUserData.regNo ? cachedUserData : null);
          CampusAPI.setActiveStudent(studentProfile);
          if (cachedUserData.sessionId) CampusAPI.setActiveSessionId(cachedUserData.sessionId);

          if (isMounted) {
            setStudent(studentProfile);
            if (cachedUserData.courses?.length > 0) setCourses(cachedUserData.courses);
            if (cachedUserData.timetable?.length > 0) setTimetable(cachedUserData.timetable);
            if (cachedUserData.attendance?.length > 0) setAttendance(cachedUserData.attendance);
            if (cachedUserData.marks?.length > 0) setMarks(cachedUserData.marks);
            if (cachedUserData.exams && Object.keys(cachedUserData.exams).length > 0) setExams(cachedUserData.exams);
            if (cachedUserData.faculty?.length > 0) setFaculty(cachedUserData.faculty);
          }
        } else {
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
          }
        }

        if (!isMounted) return;

        setIsAuthenticated(authed);

        if (authed) {
          if (studentProfile) {
            setStudent(studentProfile);
          }
          await loadAllData();

          if (!isMounted) return;

          // If directly opened a protected route while authenticated, display it
          if (!initialRoute.isLanding) {
            setShowLanding(false);
            setActiveView(initialRoute.view);
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

  const handleSignOut = async () => {
    const currentReg = student?.regNo;
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

      // 3. Clear all cached browser credentials and user-scoped storage
      if (typeof window !== 'undefined') {
        if (currentReg) {
          window.localStorage.removeItem('campus_user_data_' + currentReg);
        }
        window.localStorage.removeItem('campus_current_reg_no');
        window.localStorage.removeItem('campusos_leetcode_username');
        window.localStorage.removeItem('campus_lms_account');
        window.localStorage.removeItem('campus_teams_account');
        window.history.replaceState(null, '', '/');
      }
    }
  };

  const handleLoginSuccess = async (data?: any) => {
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

    setShowVtopModal(false);
    setIsAuthenticated(true);

    const studentObj = data?.student || (data?.regNo ? data : null);
    if (studentObj) {
      CampusAPI.setActiveStudent(studentObj);
      setStudent(studentObj);
      if (typeof window !== 'undefined' && studentObj.regNo) {
        window.localStorage.setItem('campus_current_reg_no', studentObj.regNo);
        if (data) {
          window.localStorage.setItem('campus_user_data_' + studentObj.regNo, JSON.stringify(data));
        }
      }
    }

    if (data && data.courses && data.courses.length > 0) setCourses(data.courses);
    if (data && data.timetable && data.timetable.length > 0) setTimetable(data.timetable);
    if (data && data.attendance && data.attendance.length > 0) setAttendance(data.attendance);
    if (data && data.marks && data.marks.length > 0) setMarks(data.marks);
    if (data && data.exams && Object.keys(data.exams).length > 0) setExams(data.exams);
    if (data && data.faculty && data.faculty.length > 0) setFaculty(data.faculty);
    if (data && data.assignments && data.assignments.length > 0) setAssignments(data.assignments);
    if (data && data.fees && data.fees.length > 0) setFees(data.fees);
    if (data && data.placements && data.placements.length > 0) setPlacements(data.placements);
    if (data && data.dsaTopics && data.dsaTopics.length > 0) setDsaTopics(data.dsaTopics);
    if (data && data.aiTasks && data.aiTasks.length > 0) setAiTasks(data.aiTasks);

    await loadAllData();
    setShowLanding(false);
    setActiveView('dashboard');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/dashboard');
    }
  };

  const handleToggleAssignment = async (id: string, currentStatus: 'Pending' | 'Submitted') => {
    const nextStatus = currentStatus === 'Pending' ? 'Submitted' : 'Pending';
    try {
      const updated = await CampusAPI.updateAssignmentStatus(id, nextStatus);
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...updated,
                status: nextStatus,
                isDone: nextStatus === 'Submitted',
                isSubmitted: nextStatus === 'Submitted',
                displayStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
              }
            : a
        )
      );
    } catch {
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: nextStatus,
                isDone: nextStatus === 'Submitted',
                isSubmitted: nextStatus === 'Submitted',
                displayStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
              }
            : a
        )
      );
    }
  };

  if (authInitializing) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          gap: '12px',
        }}
      >
        <div className="brand-icon-box" style={{ width: '48px', height: '48px' }}>
          ⚡
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Initializing CampusOS Workspace...</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Validating VTOP authentication and academic schedule models
        </p>
      </div>
    );
  }

  const pendingAssignmentsCount = assignments.filter((a) => {
    const st = (a.displayStatus || a.status || '').toUpperCase().trim();
    const isDone = Boolean(a.isDone || a.isSubmitted || st === 'DONE' || st === 'SUBMITTED' || st === 'COMPLETED');
    return !isDone;
  }).length;
  const criticalAttendanceCount = courses.filter((c) => c.attendance?.isCritical).length;

  if (showLanding || !isAuthenticated || !student) {
    return (
      <div data-theme={currentTheme}>
        <LandingPageView
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
          onClose={() => {
            setShowVtopModal(false);
            if (typeof window !== 'undefined' && window.location.pathname === '/login') {
              window.history.replaceState(null, '', '/');
            }
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={currentTheme}>
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/${view}`);
          }
        }}
        pendingAssignmentsCount={pendingAssignmentsCount}
        criticalAttendanceCount={criticalAttendanceCount}
        currentTheme={currentTheme}
        onSelectTheme={setCurrentTheme}
        onOpenVtopModal={() => setShowVtopModal(true)}
        onOpenLanding={() => {
          setShowLanding(true);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/');
          }
        }}
        onLogout={handleSignOut}
      />

      <div className="main-viewport">
        <Header
          student={student}
          activeView={activeView}
          onOpenVtopModal={() => setShowVtopModal(true)}
          onOpenLanding={() => {
            setShowLanding(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
          }}
          onLogout={handleSignOut}
          syncing={syncing}
        />

        {activeView === 'dashboard' && (
          <DashboardView
            student={student}
            timetable={timetable}
            assignments={assignments}
            onOpenSyncModal={() => setShowVtopModal(true)}
            teamsAccount={teamsAccount}
            lmsAccount={lmsAccount}
            onLinkTeams={() => setIsTeamsModalOpen(true)}
            onLinkLMS={() => setIsLMSModalOpen(true)}
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
            onForceSync={loadAllData}
            syncing={syncing}
          />
        )}

        {activeView === 'assignments' && (
          <AssignmentsView
            assignments={assignments}
            onToggleStatus={handleToggleAssignment}
            onAssignmentsUpdated={(updated) => setAssignments(updated)}
            onLinkTeams={() => setIsTeamsModalOpen(true)}
            onLinkLMS={() => setIsLMSModalOpen(true)}
            onSyncAll={handleSyncAll}
            syncingAll={syncingAll}
            teamsAccount={teamsAccount}
            lmsAccount={lmsAccount}
            studentEmail={student.email || undefined}
            studentRegNo={student.regNo}
          />
        )}

        {activeView === 'fees' && <FeesView fees={fees} />}

        {activeView === 'placements' && (
          <PlacementsView drives={placements} dsaTopics={dsaTopics} student={student} />
        )}

        {activeView === 'ai-planner' && <AIPlannerView tasks={aiTasks} />}
      </div>

      {/* VTOP Auth & Sync Modal */}
      <VtopLoginModal
        isOpen={showVtopModal}
        onClose={() => {
          setShowVtopModal(false);
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
        onLoginSuccess={async (data?: any) => {
          setIsTeamsModalOpen(false);
          setTeamsAccount({
            connected: true,
            status: 'connected',
            email: data?.email || student?.email || '',
            displayName: data?.displayName || student?.name || 'Teams User',
            lastSynced: new Date().toISOString(),
          });
          await handleSyncAll();
        }}
        initialEmail={student?.email || ''}
      />

      {/* Moodle LMS Auth & Coursework Modal */}
      <LMSLoginModal
        isOpen={isLMSModalOpen}
        onClose={() => setIsLMSModalOpen(false)}
        onLoginSuccess={async (data?: any) => {
          setIsLMSModalOpen(false);
          setLmsAccount({
            connected: true,
            status: 'connected',
            username: data?.username || student?.regNo || 'Student',
            displayName: data?.displayName || student?.name || 'Moodle User',
            lastSynced: new Date().toISOString(),
          });
          await handleSyncAll();
        }}
        initialRegNo={student?.regNo || ''}
        initialUsername={student?.regNo || ''}
      />
    </div>
  );
};

export default App;
