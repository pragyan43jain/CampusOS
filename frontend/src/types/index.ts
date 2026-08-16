export interface StudentProfile {
  name: string;
  regNo: string;
  program: string;
  semester: number;
  cgpa: number;
  creditsEarned: number;
  totalCreditsRequired: number;
  rank: number;
}

export interface AttendanceRecord {
  attended: number;
  total: number;
  percentage: number;
  safeToMiss: number;
  needToAttend: number;
  isCritical: boolean;
}

export interface MarksBreakdown {
  cat1?: { scored: number; max: number; weightage: number };
  cat2?: { scored: number; max: number; weightage: number };
  da1?: { scored: number; max: number; weightage: number };
  da2?: { scored: number; max: number; weightage: number };
  quiz?: { scored: number; max: number; weightage: number };
  fatTarget?: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  slot: string;
  venue: string;
  faculty: string;
  credits: number;
  type: 'Theory' | 'Lab' | 'Embedded';
  attendance: AttendanceRecord;
  marks?: MarksBreakdown;
}

export interface TimetableSlot {
  id: string;
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  courseCode: string;
  courseTitle: string;
  startTime: string;
  endTime: string;
  slotName: string;
  venue: string;
  faculty: string;
  isLab: boolean;
  attendance: AttendanceRecord;
}

export type AssignmentPlatform = 'LMS' | 'Teams' | 'Google Classroom' | 'VTOP Portal';

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  faculty: string;
  source: AssignmentPlatform;
  platformName: string;
  platformUrl: string;
  uploadDate: string;
  dueDate: string;
  dueTime: string;
  status: 'Pending' | 'Submitted';
  priority: 'Critical' | 'Medium' | 'Low';
  weightage: number;
  instructions?: string;
}

export interface FeeItem {
  id: string;
  title: string;
  category: 'Tuition' | 'Hostel & Mess' | 'Exam' | 'Special';
  amount: number;
  status: 'Paid' | 'Pending';
  dueDate?: string;
  receiptNumber?: string;
  paymentDate?: string;
}

export interface PlacementDrive {
  id: string;
  companyName: string;
  role: string;
  ctc: string;
  eligibilityCgpa: number;
  isEligible: boolean;
  deadlineToApply: string;
  status: 'Open' | 'Applied' | 'Shortlisted' | 'Closed';
}

export interface DSACategory {
  category: string;
  solved: number;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface AIStudyTask {
  id: string;
  courseCode: string;
  courseTitle: string;
  type: 'Attendance Risk' | 'Assignment Crunch' | 'Exam Preparation' | 'DSA Revision';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  headline: string;
  reason: string;
  estimatedHours: number;
  suggestedSlot: string;
}
