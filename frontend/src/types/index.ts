export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

// 1. Student Profile & CGPA History
export interface SemesterGpaRecord {
  semester: number;
  gpa: number;
  cgpa: number;
  credits: number;
}

export interface AttendanceRecord {
  attended: number;
  total: number;
  percentage: number;
  safeToMiss: number;
  needToAttend: number;
  isCritical: boolean;
  hasValidData?: boolean;
}

export type AttendanceStats = AttendanceRecord;

export interface Student {
  name: string;
  regNo: string;
  email?: string;
  program: string;
  branch: string;
  semester: number;
  batch?: string;
  cgpa: number;
  creditsEarned: number;
  totalCreditsRequired: number;
  rank?: number;
  lastSynced?: string;
  semesterGpa?: SemesterGpaRecord[];
  overallAttendance?: AttendanceRecord;
  proctor?: {
    name?: string;
    email?: string;
    designation?: string;
    cabin?: string;
    phone?: string;
  };
}

export type StudentProfile = Student;

// 2. Attendance Model
export interface Attendance {
  id?: string;
  courseCode: string;
  courseName: string;
  courseTitle?: string;
  faculty?: string;
  facultyName: string;
  classesConducted: number;
  conducted?: number;
  total?: number;
  classesAttended: number;
  attended?: number;
  attendancePercentage: number;
  percentage?: number;
  rawPercentage?: number;
  displayPercentage?: string;
  attendanceStatus: 'Safe' | 'Shortage' | 'Critical' | string;
  status?: string;
  safeToMiss: number;
  needToAttend: number;
  isCritical?: boolean;
  hasValidData?: boolean;
  slot?: string;
  venue?: string;
  credits?: number;
  type?: string;
  resolved?: boolean;
}

// 3. Marks Model
export interface MarksAssessmentItem {
  scored: number | null;
  max: number;
  weightage: number;
  percentage?: number;
  status?: string;
}

export interface MarksComponent {
  title: string;
  scored: number | null;
  max: number;
  weightage?: number;
  maxWeightage?: number;
  percentage?: number | null;
  status?: string;
  average?: number | null;
}

export interface Marks {
  id?: string;
  courseId?: number;
  courseCode: string;
  courseTitle: string;
  courseName: string;
  faculty: string;
  facultyName: string;
  slot?: string;
  hasMarks?: boolean;
  components?: MarksComponent[];
  weightageScored?: number | null;
  weightageGraded?: number | null;
  weightageTotal?: number | null;
  statusMessage?: string;
  cat1?: MarksAssessmentItem;
  cat2?: MarksAssessmentItem;
  fat?: {
    scored?: number;
    max?: number;
    weightage?: number;
    projectedTarget?: number;
    minNeededForS?: number;
    minNeededForA?: number;
  };
  da1?: MarksAssessmentItem;
  da2?: MarksAssessmentItem;
  quiz?: MarksAssessmentItem;
  totalInternal?: {
    scored: number;
    max: number;
    percentage: number;
  } | null;
}

// 5. Faculty Model
export interface FacultyCourseDetail {
  code: string;
  title: string;
  slot?: string;
  venue?: string;
}

export interface Faculty {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  courseCode?: string;
  courseTitle?: string;
  slot?: string;
  venue?: string;
  email?: string;
  cabin?: string;
  phone?: string;
  isLeadership?: boolean;
  isProctor?: boolean;
  enrolledCourses?: FacultyCourseDetail[];
}

// 6. Room Model
export interface Room {
  roomNumber: string;
  blockName: string;
  fullVenue: string;
}

// 7. Timetable Model
export interface TimetableSlot {
  id: string;
  day: DayOfWeek;
  dayName?: string;
  subject?: string;
  subjectCode?: string;
  courseCode: string;
  courseName?: string;
  courseTitle: string;
  faculty: string;
  facultyName?: string;
  startTime: string;
  endTime: string;
  startTime12h?: string;
  endTime12h?: string;
  slot?: string;
  slotName: string;
  room?: any;
  venue: string;
  building?: string;
  block?: string;
  isLab: boolean;
  classType?: 'Theory' | 'Lab';
  credits?: number;
  attendancePercentage?: number;
  attendance?: AttendanceRecord;
  resolved?: boolean;
}

export type Timetable = TimetableSlot[];

// 8. Exam Information Model
export interface Exam {
  id: string;
  subject?: string;
  subjectCode?: string;
  courseCode?: string;
  courseName?: string;
  courseTitle?: string;
  title?: string;
  examType: 'CAT 1' | 'CAT 2' | 'FAT' | 'Lab FAT' | string;
  slot?: string;
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  building?: string;
  block?: string;
  venue?: string;
  seatNumber?: string | number;
  seatLocation?: string;
  faculty?: string;
  status: 'Upcoming' | 'Scheduled' | 'Completed' | string;
  syllabusCoverage?: string;
}

// 9. Course Model
export interface Course {
  id: string;
  code: string;
  title: string;
  slot: string;
  venue: string;
  room?: Room;
  faculty: string;
  credits: number;
  type: 'Theory' | 'Lab' | 'Embedded';
  grade?: string;
  attendance: AttendanceRecord;
  marks?: any;
  gradeHistory?: {
    sem: number;
    grade: string;
    credits: number;
  }[];
}

export type AssignmentPlatform = 'LMS' | 'Teams' | 'Google Classroom' | 'VTOP Portal' | 'Teams + LMS' | string;

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  subject?: string;
  faculty?: string;
  source: AssignmentPlatform;
  platformName?: string;
  platformUrl?: string;
  uploadDate?: string;
  dueDate: string;
  dueTime: string;
  status: 'Pending' | 'Submitted' | 'DONE' | 'PENDING' | 'OVERDUE' | 'STATUS_UNAVAILABLE' | string;
  applicationStatus?: 'DONE' | 'PENDING' | 'OVERDUE' | 'STATUS_UNAVAILABLE' | string;
  teamsSubmissionState?: string;
  submissionStatus?: string;
  isDone?: boolean;
  isSubmitted?: boolean;
  isLate?: boolean;
  submittedAt?: string | null;
  returnedAt?: string | null;
  submissionId?: string | null;
  statusVerifiedAt?: string | null;
  statusSource?: string;
  priority: 'Critical' | 'Medium' | 'Low' | string;
  weightage?: number;
  weightagePercentage?: number;
  instructions?: string;
  matchedTeamName?: string;
  matchedLmsCourse?: string;
  sourceList?: string[];
  formattedDeadline?: string;
  relativeDeadline?: string;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  displayStatus?: string;
  submissionUrl?: string;
  teamsSubmissionUrl?: string;
  lmsSubmissionUrl?: string;
}

export interface SubjectAssignmentGroup {
  id: string;
  courseCode: string;
  courseTitle: string;
  type?: string;
  slot?: string;
  faculty?: string;
  venue?: string;
  teamsMatched: boolean;
  teamsChannelName?: string;
  lmsMatched: boolean;
  lmsCourseName?: string;
  assignments: Assignment[];
  pendingCount: number;
  submittedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalCount: number;
  syncStatusNote?: string;
}

export interface AcademicAccount {
  connected: boolean;
  status?: string;
  email?: string;
  username?: string;
  displayName?: string;
  portalUrl?: string;
  lastSynced?: string;
  matchedCount?: number;
  totalItemsCount?: number;
  totalTeamsCount?: number;
  totalCoursesCount?: number;
}

export interface UnifiedAssignmentsDashboard {
  currentSemester: { id: string; name: string };
  lastSynced?: string;
  stateLabel: 'synced' | 'caught_up' | 'not_synced' | 'failed' | string;
  totalPendingAssignments: number;
  totalSubmittedAssignments: number;
  totalOverdueAssignments: number;
  totalAssignments: number;
  subjects: SubjectAssignmentGroup[];
  unmatchedAssignments: Assignment[];
  connectedAccounts: {
    teams: AcademicAccount;
    lms: AcademicAccount;
  };
}

export interface FeeItem {
  id: string;
  title: string;
  category: 'Tuition' | 'Hostel & Mess' | 'Exam' | 'Special' | 'Exam & Library' | string;
  semester?: string;
  amount?: number;
  totalAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;
  status: 'Paid' | 'Pending';
  dueDate?: string;
  receiptNumber?: string;
  paymentDate?: string;
}

export interface PlacementDrive {
  id: string;
  companyName: string;
  logo?: string;
  role: string;
  ctc: string;
  eligibilityCgpa?: number;
  minCgpa?: number;
  isEligible?: boolean;
  eligible?: boolean;
  deadlineToApply?: string;
  deadline?: string;
  driveDate?: string;
  location?: string;
  status: 'Open' | 'Applied' | 'Shortlisted' | 'Closed' | 'Upcoming';
  tags?: string[];
}

export interface DSACategory {
  name?: string;
  category?: string;
  solved: number;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface AIStudyTask {
  id: string;
  courseCode?: string;
  subjectCode?: string;
  courseTitle?: string;
  subjectTitle?: string;
  type?: 'Attendance Risk' | 'Assignment Crunch' | 'Exam Preparation' | 'DSA Revision' | 'DSA Practice' | string;
  category?: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIMAL' | string;
  headline: string;
  reason?: string;
  actionReason?: string;
  estimatedHours: number;
  suggestedSlot: string;
}

export interface VtopLoginRequest {
  campus?: 'chennai' | 'vellore' | 'ap' | 'bhopal';
  username: string;
  password: string;
  captcha?: string;
  sessionId?: string;
}

export interface VtopSyncResponse {
  success: boolean;
  message: string;
  data?: any;
  student?: Student;
  courses?: Course[];
  timetable?: TimetableSlot[];
  attendance?: Attendance[];
  marks?: Marks[];
  exams?: Exam[];
  faculty?: Faculty[];
  receipts?: FeeItem[];
  fees?: FeeItem[];
  spotlight?: SpotlightItem[];
  proctor?: ProctorDetails;
  assignments?: Assignment[];
  aiTasks?: AIStudyTask[];
  lastSynced?: string;
}

export interface SpotlightItem {
  id: string;
  category: string;
  announcement: string;
  link?: string | null;
}

export interface ProctorDetails {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cabin?: string | null;
  designation?: string | null;
  school?: string | null;
}

export interface MessMenuDay {
  Id?: number;
  Day: string;
  Breakfast: string;
  Lunch: string;
  Snacks: string;
  Dinner: string;
}

export interface LaundryScheduleItem {
  Id?: number;
  Date: string;
  RoomNumber: string;
}

