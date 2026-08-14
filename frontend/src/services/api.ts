import {
  mockStudentProfile,
  mockCourses,
  mockTimetable,
  mockAssignments,
  mockFees,
  mockPlacements,
  mockDSATopics,
  mockAITasks,
} from './mockData';
import {
  StudentProfile,
  Course,
  TimetableSlot,
  Assignment,
  FeeItem,
  PlacementDrive,
  DSACategory,
  AIStudyTask,
  DayOfWeek,
} from '../types';
import { simulateAttendanceChange } from './attendanceEngine';

// Flag to switch between mock layer and live Spring Boot REST API
const USE_MOCK = true;
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080/api';

// In-memory state for mock simulations (e.g. marking attendance, completing assignments)
let localStudentProfile = { ...mockStudentProfile };
let localCourses = [...mockCourses];
let localTimetable = [...mockTimetable];
let localAssignments = [...mockAssignments];
let localFees = [...mockFees];

export const CampusAPI = {
  // Student Profile
  async getStudentProfile(): Promise<StudentProfile> {
    if (USE_MOCK) {
      await simulateLatency();
      return { ...localStudentProfile };
    }
    const res = await fetch(`${API_BASE_URL}/student/profile`);
    return res.json();
  },

  // Courses & Academics
  async getCourses(): Promise<Course[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...localCourses];
    }
    const res = await fetch(`${API_BASE_URL}/academics/courses`);
    return res.json();
  },

  // Timetable by Day
  async getTimetable(day?: DayOfWeek): Promise<TimetableSlot[]> {
    if (USE_MOCK) {
      await simulateLatency();
      if (day) {
        return localTimetable.filter((slot) => slot.day === day);
      }
      return [...localTimetable];
    }
    const url = day ? `${API_BASE_URL}/timetable?day=${day}` : `${API_BASE_URL}/timetable`;
    const res = await fetch(url);
    return res.json();
  },

  // Assignments & Deadlines
  async getAssignments(): Promise<Assignment[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...localAssignments];
    }
    const res = await fetch(`${API_BASE_URL}/assignments`);
    return res.json();
  },

  // Mark Assignment Completed / Submitted
  async updateAssignmentStatus(id: string, status: 'Pending' | 'Submitted'): Promise<Assignment> {
    if (USE_MOCK) {
      await simulateLatency(150);
      localAssignments = localAssignments.map((a) => (a.id === id ? { ...a, status } : a));
      const updated = localAssignments.find((a) => a.id === id)!;
      return updated;
    }
    const res = await fetch(`${API_BASE_URL}/assignments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Fees & Receipts
  async getFees(): Promise<FeeItem[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...localFees];
    }
    const res = await fetch(`${API_BASE_URL}/fees`);
    return res.json();
  },

  // Placements & Drives
  async getPlacementDrives(): Promise<PlacementDrive[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...mockPlacements];
    }
    const res = await fetch(`${API_BASE_URL}/placements/drives`);
    return res.json();
  },

  // DSA Tracker Data
  async getDSATracker(): Promise<DSACategory[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...mockDSATopics];
    }
    const res = await fetch(`${API_BASE_URL}/dsa/topics`);
    return res.json();
  },

  // AI Study Plan
  async getAIStudyTasks(): Promise<AIStudyTask[]> {
    if (USE_MOCK) {
      await simulateLatency();
      return [...mockAITasks];
    }
    const res = await fetch(`${API_BASE_URL}/ai/study-plan`);
    return res.json();
  },

  // Simulate Attendance Check-in / Miss
  async simulateAttendance(courseCode: string, attended: boolean): Promise<Course> {
    if (USE_MOCK) {
      await simulateLatency(200);
      const course = localCourses.find((c) => c.code === courseCode);
      if (!course) throw new Error("Course not found");

      const newStats = simulateAttendanceChange(course.attendance.attended, course.attendance.total, attended);
      course.attendance = newStats;

      // Also update timetable slots for this course
      localTimetable = localTimetable.map((slot) => {
        if (slot.courseCode === courseCode) {
          return { ...slot, attendance: newStats };
        }
        return slot;
      });

      return { ...course };
    }

    const res = await fetch(`${API_BASE_URL}/attendance/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseCode, attended }),
    });
    return res.json();
  },
};

function simulateLatency(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
