export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface AttendanceStats {
  attended: number;
  total: number;
  percentage: number;
  safeToMiss: number;
  needToAttend: number;
  isCritical: boolean; // < 75%
}

export interface StudentProfile {
  name: string;
  regNo: string;
  email: string;
  program: string;
  branch: string;
  semester: number;
  batch: string;
  cgpa: number;
  creditsEarned: number;
  totalCreditsRequired: number;
  rank: number;
  overallAttendance: AttendanceStats;
  lastSynced: string;
}

export interface CourseMarks {
  cat1?: { max: number; scored: number; weightage: number };
  cat2?: { max: number; scored: number; weightage: number };
  da1?: { max: number; scored: number; weightage: number };
  da2?: { max: number; scored: number; weightage: number };
  quiz?: { max: number; scored: number; weightage: number };
  fatProjected?: { minNeededForS: number; minNeededForA: number; max: number };
}

export interface Course {
  id: string;
  code: string;
  title: string;
  type: 'Theory' | 'Lab' | 'Embedded' | 'Project';
  slot: string;
  venue: string;
  faculty: string;
  credits: number;
  attendance: AttendanceStats;
  marks?: CourseMarks;
  gradeHistory?: { sem: number; grade: string; credits: number }[];
}

export interface TimetableSlot {
  id: string;
  day: DayOfWeek;
  courseCode: string;
  courseTitle: string;
  startTime: string;
  endTime: string;
  slotName: string;
  venue: string;
  faculty: string;
  isLab: boolean;
  attendance: AttendanceStats;
}

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  source: 'LMS' | 'Teams' | 'Moodle';
  dueDate: string;
  dueTime: string;
  status: 'Pending' | 'Submitted' | 'Overdue';
  priority: 'Critical' | 'Medium' | 'Low';
  weightagePercentage?: number;
  instructionsUrl?: string;
}

export interface FeeItem {
  id: string;
  title: string;
  category: 'Tuition' | 'Hostel & Mess' | 'Exam & Library' | 'Club & Activity';
  semester: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Partially Paid';
  receiptNumber?: string;
  paymentDate?: string;
}

export interface PlacementDrive {
  id: string;
  companyName: string;
  logo: string;
  role: string;
  ctc: string; // e.g. "24 LPA"
  location: string;
  minCgpa: number;
  eligible: boolean;
  deadline: string;
  driveDate: string;
  status: 'Upcoming' | 'Applied' | 'Shortlisted' | 'Assessment Round';
  tags: string[];
}

export interface DSACategory {
  name: string;
  solved: number;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface AIStudyTask {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  category: 'Attendance Risk' | 'Exam Preparation' | 'Assignment Crunch' | 'DSA Practice';
  urgency: 'HIGH' | 'MEDIUM' | 'OPTIMAL';
  headline: string;
  actionReason: string;
  estimatedHours: number;
  suggestedSlot: string;
}
