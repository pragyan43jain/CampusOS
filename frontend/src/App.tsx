import React, { useState, useEffect } from 'react';
import {
  StudentProfile,
  Course,
  TimetableSlot,
  Assignment,
  FeeItem,
  PlacementDrive,
  DSACategory,
  AIStudyTask,
} from './types';
import { CampusAPI } from './services/api';
import { Header, ThemeType } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { AcademicsView } from './views/AcademicsView';
import { AssignmentsView } from './views/AssignmentsView';
import { FeesView } from './views/FeesView';
import { PlacementsView } from './views/PlacementsView';
import { AIPlannerView } from './views/AIPlannerView';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('baby-pink');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Core Data States
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [placements, setPlacements] = useState<PlacementDrive[]>([]);
  const [dsaTopics, setDsaTopics] = useState<DSACategory[]>([]);
  const [aiTasks, setAiTasks] = useState<AIStudyTask[]>([]);

  // Apply theme to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Load all initial mock / backend data
  const loadAllData = async () => {
    try {
      setSyncing(true);
      const [
        studentData,
        coursesData,
        timetableData,
        assignmentsData,
        feesData,
        placementsData,
        dsaData,
        aiData,
      ] = await Promise.all([
        CampusAPI.getStudentProfile(),
        CampusAPI.getCourses(),
        CampusAPI.getTimetable(),
        CampusAPI.getAssignments(),
        CampusAPI.getFees(),
        CampusAPI.getPlacementDrives(),
        CampusAPI.getDSATracker(),
        CampusAPI.getAIStudyTasks(),
      ]);

      setStudent(studentData);
      setCourses(coursesData);
      setTimetable(timetableData);
      setAssignments(assignmentsData);
      setFees(feesData);
      setPlacements(placementsData);
      setDsaTopics(dsaData);
      setAiTasks(aiData);
    } catch (err) {
      console.error('Failed to load campus data:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Toggle assignment status
  const handleToggleAssignment = async (id: string, currentStatus: 'Pending' | 'Submitted') => {
    const nextStatus = currentStatus === 'Pending' ? 'Submitted' : 'Pending';
    const updated = await CampusAPI.updateAssignmentStatus(id, nextStatus);
    setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
  };

  if (loading || !student) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="brand-logo-badge" style={{ width: '48px', height: '48px', fontSize: '1.4rem', marginBottom: '16px' }}>C</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading CampusOS Engine...</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Connecting to VTOP & LMS synchronization layer</p>
      </div>
    );
  }

  const pendingAssignmentsCount = assignments.filter((a) => a.status === 'Pending').length;
  const criticalAttendanceCount = courses.filter((c) => c.attendance.isCritical).length;

  return (
    <div className="app-container" data-theme={currentTheme}>
      {!isMobileMode && (
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          pendingAssignmentsCount={pendingAssignmentsCount}
          criticalAttendanceCount={criticalAttendanceCount}
        />
      )}

      <div className={`app-viewport-wrapper ${isMobileMode ? 'mobile-mode' : ''}`}>
        <div className="main-wrapper">
          <Header
            student={student}
            activeView={activeView}
            onRefresh={loadAllData}
            syncing={syncing}
            currentTheme={currentTheme}
            onSelectTheme={setCurrentTheme}
            isMobileMode={isMobileMode}
            onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
          />

          {isMobileMode && (
            <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-surface)', padding: '8px 12px', gap: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { id: 'dashboard', label: 'Home', icon: '⚡' },
                { id: 'academics', label: 'Academics', icon: '📚' },
                { id: 'assignments', label: 'Tasks', icon: '📝' },
                { id: 'fees', label: 'Fees', icon: '💳' },
                { id: 'placements', label: 'DSA', icon: '🎯' },
                { id: 'ai-planner', label: 'AI', icon: '🧠' }
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`nav-item ${activeView === tab.id ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', whiteSpace: 'nowrap' }}
                  onClick={() => setActiveView(tab.id as NavView)}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              student={student}
              timetable={timetable}
            />
          )}

          {activeView === 'academics' && (
            <AcademicsView
              courses={courses}
            />
          )}

          {activeView === 'assignments' && (
            <AssignmentsView
              assignments={assignments}
              onToggleStatus={handleToggleAssignment}
            />
          )}

          {activeView === 'fees' && <FeesView fees={fees} />}

          {activeView === 'placements' && (
            <PlacementsView drives={placements} dsaTopics={dsaTopics} />
          )}

          {activeView === 'ai-planner' && <AIPlannerView tasks={aiTasks} />}
        </div>
      </div>
    </div>
  );
};

export default App;
