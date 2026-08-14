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
import { Header } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { AcademicsView } from './views/AcademicsView';
import { AssignmentsView } from './views/AssignmentsView';
import { FeesView } from './views/FeesView';
import { PlacementsView } from './views/PlacementsView';
import { AIPlannerView } from './views/AIPlannerView';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<NavView>('dashboard');
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

  // Handle Attendance simulation (+ Present or - Bunk)
  const handleSimulateAttendance = async (courseCode: string, attended: boolean) => {
    try {
      const updatedCourse = await CampusAPI.simulateAttendance(courseCode, attended);
      
      // Update courses list
      setCourses((prev) =>
        prev.map((c) => (c.code === courseCode ? updatedCourse : c))
      );

      // Update timetable
      setTimetable((prev) =>
        prev.map((slot) =>
          slot.courseCode === courseCode
            ? { ...slot, attendance: updatedCourse.attendance }
            : slot
        )
      );

      // Recalculate overall student attendance
      if (student) {
        const totalAttended = courses.reduce(
          (acc, c) => acc + (c.code === courseCode ? updatedCourse.attendance.attended : c.attendance.attended),
          0
        );
        const totalClasses = courses.reduce(
          (acc, c) => acc + (c.code === courseCode ? updatedCourse.attendance.total : c.attendance.total),
          0
        );
        const percentage = Number(((totalAttended / totalClasses) * 100).toFixed(1));

        setStudent({
          ...student,
          overallAttendance: {
            ...student.overallAttendance,
            attended: totalAttended,
            total: totalClasses,
            percentage,
            isCritical: percentage < 75,
          },
        });
      }
    } catch (err) {
      console.error('Attendance simulation error:', err);
    }
  };

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
    <div className="app-container">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        pendingAssignmentsCount={pendingAssignmentsCount}
        criticalAttendanceCount={criticalAttendanceCount}
      />

      <div className="main-wrapper">
        <Header
          student={student}
          activeView={activeView}
          onRefresh={loadAllData}
          syncing={syncing}
        />

        {activeView === 'dashboard' && (
          <DashboardView
            student={student}
            timetable={timetable}
            onSimulateAttendance={handleSimulateAttendance}
          />
        )}

        {activeView === 'academics' && (
          <AcademicsView
            courses={courses}
            onSimulateAttendance={handleSimulateAttendance}
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
  );
};

export default App;
