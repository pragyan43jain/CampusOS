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
  Attendance,
  Marks,
  OD,
  Exam,
  Faculty,
} from './types';
import { CampusAPI } from './services/api';
import { Header, ThemeType } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { VtopLoginModal } from './components/VtopLoginModal';
import { VtopSyncView } from './views/VtopSyncView';
import { DashboardView } from './views/DashboardView';
import { AcademicsView } from './views/AcademicsView';
import { AssignmentsView } from './views/AssignmentsView';
import { FeesView } from './views/FeesView';
import { PlacementsView } from './views/PlacementsView';
import { AIPlannerView } from './views/AIPlannerView';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('baby-pink');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showVtopModal, setShowVtopModal] = useState<boolean>(false);

  // Core Academic Data States
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [marks, setMarks] = useState<Marks[]>([]);
  const [od, setOd] = useState<OD>({
    usedHours: 0,
    maxHours: 40,
    remainingHours: 40,
    percentageUsed: 0.0,
    hasValidData: false,
    records: [],
  });
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
        odData,
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
        CampusAPI.getOD(),
        CampusAPI.getExams(),
        CampusAPI.getFaculty(),
        CampusAPI.getAssignments(),
        CampusAPI.getFees(),
        CampusAPI.getPlacementDrives(),
        CampusAPI.getDSATracker(),
        CampusAPI.getAIStudyTasks(),
      ]);

      setStudent(studentData);
      setCourses(coursesData);
      setTimetable(timetableData);
      setAttendance(attendanceData);
      setMarks(marksData);
      setOd(odData);
      setExams(examsData);
      setFaculty(facultyData);
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

  const handleSyncedData = async (data?: any) => {
    if (data && data.student) {
      setStudent(data.student);
      if (data.courses) setCourses(data.courses);
      if (data.timetable) setTimetable(data.timetable);
      if (data.attendance) setAttendance(data.attendance);
      if (data.marks) setMarks(data.marks);
      if (data.od) setOd(data.od);
      if (data.exams) setExams(data.exams);
      if (data.faculty) setFaculty(data.faculty);
      if (data.assignments) setAssignments(data.assignments);
      if (data.fees) setFees(data.fees);
      if (data.placements) setPlacements(data.placements);
      if (data.dsaTopics) setDsaTopics(data.dsaTopics);
      if (data.aiTasks) setAiTasks(data.aiTasks);
    }
    await loadAllData();
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

  const pendingAssignmentsCount = assignments.filter((a) => {
    const st = (a.displayStatus || a.status || '').toUpperCase();
    return st === 'PENDING' || st === 'DUE SOON' || st === 'OVERDUE';
  }).length;
  const criticalAttendanceCount = courses.filter((c) => c.attendance?.isCritical).length;

  return (
    <div className="app-container" data-theme={currentTheme}>
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        pendingAssignmentsCount={pendingAssignmentsCount}
        criticalAttendanceCount={criticalAttendanceCount}
        currentTheme={currentTheme}
        onSelectTheme={setCurrentTheme}
        onOpenVtopModal={() => setShowVtopModal(true)}
      />

      <div className="app-viewport-wrapper">
        <div className="main-wrapper">
          <Header
            student={student}
            activeView={activeView}
            onOpenVtopModal={() => setShowVtopModal(true)}
            syncing={syncing}
          />

          {activeView === 'dashboard' && (
            <DashboardView
              student={student}
              timetable={timetable}
            />
          )}

          {activeView === 'vtop-sync' && (
            <VtopSyncView
              student={student}
              courses={courses}
              attendance={attendance}
              marks={marks}
              od={od}
              exams={exams}
              faculty={faculty}
              timetable={timetable}
              onOpenSyncModal={() => setShowVtopModal(true)}
              onForceSync={loadAllData}
              syncing={syncing}
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
              onAssignmentsUpdated={(updated) => setAssignments(updated)}
              studentEmail={student.email}
              studentRegNo={student.regNo}
            />
          )}

          {activeView === 'fees' && <FeesView fees={fees} />}

          {activeView === 'placements' && (
            <PlacementsView drives={placements} dsaTopics={dsaTopics} student={student} />
          )}

          {activeView === 'ai-planner' && <AIPlannerView tasks={aiTasks} />}
        </div>
      </div>

      <VtopLoginModal
        isOpen={showVtopModal}
        onClose={() => setShowVtopModal(false)}
        onLoginSuccess={handleSyncedData}
      />
    </div>
  );
};

export default App;
