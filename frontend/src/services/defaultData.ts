// University Academic Store Types and Empty Initial State
// Authentic data is populated strictly via live user authentication.

export const DEFAULT_STUDENT_PROFILE = {
  name: "Not connected",
  regNo: "Not available",
  email: null,
  program: null,
  branch: null,
  semester: null,
  semesterId: null,
  batch: null,
  cgpa: null,
  creditsEarned: null,
  totalCreditsRequired: 160.0,
  registeredCredits: null,
  rank: null,
  overallAttendance: null,
  semesterGpa: [],
  proctor: null,
  lastSynced: null
};

export const DEFAULT_COURSES: any[] = [];
export const DEFAULT_TIMETABLE: any[] = [];
export const DEFAULT_ATTENDANCE: any[] = [];
export const DEFAULT_MARKS: any[] = [];
export const DEFAULT_EXAMS: any = {
  types: [],
  unallotted: [],
  upcoming: [],
  completed: []
};
export const DEFAULT_FACULTY: any[] = [];
export const DEFAULT_ASSIGNMENTS: any[] = [];
