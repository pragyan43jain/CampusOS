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
  VtopLoginRequest,
  VtopSyncResponse,
  UnifiedAssignmentsDashboard,
} from '../types';

// API base path - proxied by Vite in dev or served directly in prod
const API_BASE = '/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[CampusAPI] Request to ${endpoint} failed:`, err);
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

let activeSessionId: string | null = null;
let inFlightLogin: Promise<VtopSyncResponse> | null = null;
let inFlightSync: Promise<VtopSyncResponse> | null = null;

export const CampusAPI = {
  getActiveSessionId: () => activeSessionId,
  setActiveSessionId: (sid: string | null) => {
    activeSessionId = sid;
  },

  // 1. Student Profile & CGPA
  getStudentProfile: async (): Promise<StudentProfile> => {
    return fetchJson<StudentProfile>('/vtop/profile', undefined, {
      name: "Not connected",
      regNo: "Not available",
      program: "Not available",
      branch: "Not available",
      semester: 1,
      cgpa: 0,
      creditsEarned: 0,
      totalCreditsRequired: 160,
      lastSynced: "Never",
      semesterGpa: [],
    });
  },

  getCgpaDetails: async (): Promise<{ currentCgpa?: number; creditsEarned?: number; totalCreditsRequired: number; rank?: number; semesterGpa: any[] }> => {
    return fetchJson('/vtop/cgpa', undefined, {
      currentCgpa: undefined,
      creditsEarned: undefined,
      totalCreditsRequired: 160,
      semesterGpa: [],
    });
  },

  // 2. Attendance
  getAttendance: async (): Promise<Attendance[]> => {
    const list = await fetchJson<any[]>('/vtop/attendance', undefined, []);
    return list.map((item: any) => {
      const conducted = item.conducted ?? item.classesConducted ?? item.total ?? 0;
      const attended = item.attended ?? item.classesAttended ?? 0;
      const percentage = item.percentage ?? item.attendancePercentage ?? (conducted > 0 ? Math.round((attended / conducted) * 100) : 0);
      const title = item.courseTitle || item.courseName || item.title || item.courseCode || 'Course';

      return {
        ...item,
        courseName: title,
        courseTitle: title,
        attended,
        classesAttended: attended,
        conducted,
        classesConducted: conducted,
        total: conducted,
        percentage,
        attendancePercentage: percentage,
        displayPercentage: `${percentage}%`,
        status: item.status || item.attendanceStatus || (percentage >= 75 ? 'Safe' : 'Critical'),
        attendanceStatus: item.attendanceStatus || item.status || (percentage >= 75 ? 'Safe' : 'Critical'),
        faculty: item.faculty || item.facultyName || 'Faculty',
        facultyName: item.facultyName || item.faculty || 'Faculty',
        hasValidData: item.hasValidData ?? Boolean(conducted > 0 || item.percentage !== undefined),
      };
    });
  },

  getCourses: async (): Promise<Course[]> => {
    return fetchJson<Course[]>('/courses', undefined, []);
  },

  // 3. OD (On-Duty Hours out of 40)
  getOD: async (): Promise<OD> => {
    const res = await fetchJson<OD>('/vtop/od', undefined, {
      state: 'source_unavailable',
      usedHours: null,
      odHours: null,
      totalOdHours: null,
      approvedHours: 0,
      pendingHours: 0,
      rejectedHours: 0,
      maxHours: 40,
      maxOdHours: 40,
      remainingHours: null,
      percentageUsed: null,
      hasValidData: false,
      records: [],
      odRecords: [],
    });
    const records = res.records || res.odRecords || [];
    const used = (res.usedHours !== undefined && res.usedHours !== null)
      ? res.usedHours
      : (res.odHours !== undefined && res.odHours !== null
          ? res.odHours
          : (res.totalOdHours !== undefined && res.totalOdHours !== null ? res.totalOdHours : null));
    const maxH = res.maxHours || res.maxOdHours || 40;
    const hasValid = res.hasValidData ?? (used !== null || res.state === 'success_with_records' || res.state === 'success_with_no_records');
    const remaining = used !== null ? Math.max(0, maxH - used) : null;
    const pct = used !== null ? Math.round((used / maxH) * 1000) / 10 : null;

    return {
      ...res,
      usedHours: used,
      odHours: used,
      totalOdHours: used,
      maxHours: maxH,
      maxOdHours: maxH,
      remainingHours: res.remainingHours ?? remaining,
      percentageUsed: res.percentageUsed ?? pct,
      hasValidData: hasValid,
      records,
      odRecords: records,
    };
  },

  syncOD: async (): Promise<{ success: boolean; sessionExpired?: boolean; message: string; od?: OD }> => {
    try {
      const q = activeSessionId ? `?sessionId=${encodeURIComponent(activeSessionId)}` : '';
      const res = await fetch(`${API_BASE}/vtop/od/sync${q}`, { method: 'POST' });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to sync OD from VTOP CC' };
    }
  },

  // 4. Marks
  getMarks: async (): Promise<Marks[]> => {
    return fetchJson<Marks[]>('/vtop/marks', undefined, []);
  },

  getMarksSummary: async (): Promise<Marks[]> => {
    return fetchJson<Marks[]>('/vtop/marks/summary', undefined, []);
  },

  getSubjectDetails: async (courseCode: string): Promise<any> => {
    return fetchJson<any>(`/academics/subject/${encodeURIComponent(courseCode)}`);
  },

  // 5. Timetable
  getTimetable: async (): Promise<TimetableSlot[]> => {
    const list = await fetchJson<any[]>('/vtop/timetable', undefined, []);
    const dayFullNames: Record<string, string> = {
      MON: 'Monday',
      TUE: 'Tuesday',
      WED: 'Wednesday',
      THU: 'Thursday',
      FRI: 'Friday',
      SAT: 'Saturday',
      SUN: 'Sunday',
    };

    return list.map((slot: any) => {
      const code = slot.courseCode || slot.subjectCode || slot.code || 'COURSE';
      const title = slot.courseTitle || slot.courseName || slot.title || code;
      const venueStr = slot.venue || 'TBA';
      const bld = slot.building || slot.block || (venueStr.includes('-') ? venueStr.split('-')[0] : venueStr);
      const rm = slot.room?.roomNumber || slot.room || (venueStr.includes('-') ? venueStr.split('-')[1] : venueStr);
      const isLab = Boolean(slot.isLab || slot.type === 'Lab' || slot.classType === 'Lab');

      return {
        ...slot,
        courseCode: code,
        subjectCode: code,
        courseName: title,
        courseTitle: title,
        subjectTitle: title,
        faculty: slot.faculty || slot.facultyName || 'Faculty',
        facultyName: slot.facultyName || slot.faculty || 'Faculty',
        dayName: slot.dayName || dayFullNames[slot.day] || slot.day,
        venue: venueStr,
        building: bld,
        block: bld,
        room: rm,
        isLab,
        classType: isLab ? 'Lab' : 'Theory',
      };
    });
  },

  // 6. Exams Schedule
  getExams: async (): Promise<Exam[]> => {
    const data = await fetchJson<any>('/vtop/exams', undefined, {});
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      const cards: Exam[] = [];
      let idx = 1;
      for (const [examType, items] of Object.entries(data)) {
        if (Array.isArray(items)) {
          for (const it of items) {
            const venueStr = it.venue || 'TBA';
            cards.push({
              id: `exam-${idx}`,
              examType,
              title: `${examType} - ${it.slot || 'Exam'}`,
              courseCode: it.courseCode || it.slot,
              courseName: it.courseTitle || it.courseName || `${examType} Exam`,
              courseTitle: it.courseTitle || it.courseName || `${examType} Exam`,
              subjectCode: it.courseCode || it.slot,
              subject: it.courseTitle || `${examType} Exam`,
              slot: it.slot,
              date: it.date || 'TBA',
              time: it.start_time && it.end_time ? `${it.start_time} - ${it.end_time}` : (it.start_time || 'TBA'),
              startTime: it.start_time,
              endTime: it.end_time,
              venue: venueStr,
              room: venueStr.includes('-') ? venueStr.split('-')[1] : venueStr,
              building: venueStr.includes('-') ? venueStr.split('-')[0] : venueStr,
              block: venueStr.includes('-') ? venueStr.split('-')[0] : venueStr,
              seatNumber: it.seat_number ? String(it.seat_number) : undefined,
              seatLocation: it.seat_location,
              status: 'Upcoming',
            });
            idx++;
          }
        }
      }
      return cards;
    }
    return [];
  },

  getVtopDebug: async (): Promise<any> => {
    return fetchJson('/vtop/debug', undefined, null);
  },

  // 7. Faculty Mapping
  getFaculty: async (): Promise<Faculty[]> => {
    return fetchJson<Faculty[]>('/vtop/faculty', undefined, []);
  },

  // 8. Assignments & Fees & DSA & AI Tasks
  getAssignments: async (): Promise<Assignment[]> => {
    return fetchJson<Assignment[]>('/assignments', undefined, []);
  },

  updateAssignmentStatus: async (id: string, status: 'Pending' | 'Submitted'): Promise<Assignment> => {
    const res = await fetch(`${API_BASE}/assignments/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update assignment ${id}`);
    }
    return await res.json();
  },

  getFees: async (): Promise<FeeItem[]> => {
    return fetchJson<FeeItem[]>('/fees', undefined, []);
  },

  getPlacementDrives: async (): Promise<PlacementDrive[]> => {
    return fetchJson<PlacementDrive[]>('/placements', undefined, []);
  },

  getDSATracker: async (): Promise<DSACategory[]> => {
    return fetchJson<DSACategory[]>('/dsa', undefined, []);
  },

  getAIStudyTasks: async (): Promise<AIStudyTask[]> => {
    return fetchJson<AIStudyTask[]>('/ai-tasks', undefined, []);
  },

  // 9. VTOP Spotlight Announcements, Receipts, and Hostel
  getSpotlight: async (): Promise<any[]> => {
    return fetchJson<any[]>('/spotlight', undefined, []);
  },

  getReceipts: async (): Promise<FeeItem[]> => {
    return fetchJson<FeeItem[]>('/receipts', undefined, []);
  },

  getDues: async (): Promise<{ hasDues: boolean; totalDue: number; items: any[] }> => {
    return fetchJson('/dues', undefined, { hasDues: false, totalDue: 0, items: [] });
  },

  getProctor: async (): Promise<any> => {
    return fetchJson('/proctor', undefined, null);
  },

  getHostelMess: async (type: string = 'M-N'): Promise<any[]> => {
    return fetchJson<any[]>(`/hostel/mess?type=${type}`, undefined, []);
  },

  getHostelLaundry: async (block: string = 'A'): Promise<any[]> => {
    return fetchJson<any[]>(`/hostel/laundry?block=${block}`, undefined, []);
  },

  // 10. VTOP Auth & Synchronization Endpoints
  getVtopCaptcha: async (campus: string = 'chennai') => {
    const data = await fetchJson<{ sessionId: string; captchaImage: string; solvedCaptcha: string; campus: string }>(
      `/vtop/captcha?campus=${campus}`,
      undefined,
      { sessionId: '', captchaImage: '', solvedCaptcha: '', campus }
    );
    if (data && data.sessionId) {
      activeSessionId = data.sessionId;
    }
    return data;
  },

  loginVtop: async (req: VtopLoginRequest & { sessionId?: string }): Promise<VtopSyncResponse> => {
    if (inFlightLogin) {
      return inFlightLogin;
    }

    inFlightLogin = (async () => {
      try {
        const payload = {
          ...req,
          sessionId: req.sessionId || activeSessionId,
        };
        const res = await fetch(`${API_BASE}/vtop/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data && data.sessionId) {
          activeSessionId = data.sessionId;
        }
        return data;
      } catch (err: any) {
        console.error('[CampusAPI] VTOP login error:', err);
        return {
          success: false,
          message: err.message || 'Unable to connect to VTOP sync backend service.',
        };
      } finally {
        inFlightLogin = null;
      }
    })();

    return inFlightLogin;
  },

  syncVtop: async (_campus: string = 'chennai'): Promise<VtopSyncResponse> => {
    if (inFlightSync) {
      return inFlightSync;
    }

    inFlightSync = (async () => {
      try {
        const q = activeSessionId ? `?sessionId=${encodeURIComponent(activeSessionId)}` : '';
        const res = await fetch(`${API_BASE}/vtop/sync${q}`, { method: 'POST' });
        const data = await res.json();
        if (data && data.sessionId) {
          activeSessionId = data.sessionId;
        }
        return data;
      } catch (err: any) {
        console.error('[CampusAPI] VTOP sync error:', err);
        return {
          success: false,
          message: err.message || 'VTOP connection failed',
        };
      } finally {
        inFlightSync = null;
      }
    })();

    return inFlightSync;
  },

  getVtopStatus: async () => {
    return fetchJson<{ authenticated: boolean; student?: StudentProfile; syncStatus?: any; lastSynced?: string }>('/vtop/status', undefined, {
      authenticated: false,
      lastSynced: 'Never',
    });
  },

  logoutVtop: async () => {
    const q = activeSessionId ? `?sessionId=${encodeURIComponent(activeSessionId)}` : '';
    activeSessionId = null;
    return fetchJson<{ success: boolean; message: string }>(`/vtop/logout${q}`, { method: 'POST' }, {
      success: true,
      message: 'Logged out',
    });
  },

  // 10. Microsoft Teams Authentication & Coursework Sync
  getTeamsStatus: async () => {
    return fetchJson<{
      connected: boolean;
      email?: string;
      displayName?: string;
      lastSynced?: string;
      portal?: string;
      mfaRequired?: boolean;
      totalAssignments: number;
      pendingCount: number;
      submittedCount: number;
      matchedSubjects?: any[];
      matchedCount?: number;
      totalTeamsCount?: number;
    }>('/teams/status', undefined, {
      connected: false,
      totalAssignments: 0,
      pendingCount: 0,
      submittedCount: 0,
      matchedSubjects: [],
      matchedCount: 0,
      totalTeamsCount: 0,
    });
  },

  loginTeams: async (email: string, password: string): Promise<{
    success: boolean;
    message: string;
    email?: string;
    displayName?: string;
    assignments?: Assignment[];
    matchedSubjects?: any[];
    matchedCount?: number;
    totalTeamsCount?: number;
    teamsAssignmentsCount?: number;
    totalCount?: number;
    pendingCount?: number;
    submittedCount?: number;
    mfaRequired?: boolean;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `Authentication failed with status ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to connect to Microsoft Online authentication service',
      };
    }
  },

  syncTeams: async (): Promise<{
    success: boolean;
    message: string;
    assignments?: Assignment[];
    totalCount?: number;
    lastSynced?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `Sync failed with status ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to sync with Microsoft Teams',
      };
    }
  },

  disconnectTeams: async () => {
    return fetchJson<{ success: boolean; message: string }>('/teams/disconnect', { method: 'POST' }, {
      success: true,
      message: 'Disconnected',
    });
  },

  // 11. VIT LMS Authentication & Coursework Sync
  getLMSStatus: async () => {
    return fetchJson<{
      connected: boolean;
      status: string;
      username?: string;
      displayName?: string;
      portalUrl?: string;
      lastSynced?: string;
      totalAssignments: number;
      pendingCount: number;
      submittedCount: number;
      matchedSubjects?: any[];
      matchedCount?: number;
      totalCoursesCount?: number;
    }>('/lms/status', undefined, {
      connected: false,
      status: 'disconnected',
      totalAssignments: 0,
      pendingCount: 0,
      submittedCount: 0,
      matchedSubjects: [],
      matchedCount: 0,
      totalCoursesCount: 0,
    });
  },

  loginLMS: async (credentials: { username?: string; password?: string; sessionCookie?: string }): Promise<{
    success: boolean;
    message: string;
    username?: string;
    displayName?: string;
    assignments?: Assignment[];
    matchedSubjects?: any[];
    matchedCount?: number;
    lmsAssignmentsCount?: number;
    pendingCount?: number;
    submittedCount?: number;
    lastSynced?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/lms/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `LMS login failed with status ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to connect to VIT LMS server',
      };
    }
  },

  syncLMS: async (): Promise<{
    success: boolean;
    message: string;
    assignments?: Assignment[];
    matchedSubjects?: any[];
    matchedCount?: number;
    lastSynced?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/lms/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `LMS sync failed with status ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to sync with VIT LMS',
      };
    }
  },

  disconnectLMS: async () => {
    return fetchJson<{ success: boolean; message: string }>('/lms/disconnect', { method: 'POST' }, {
      success: true,
      message: 'Disconnected',
    });
  },

  // 12. Unified Academic Accounts & Subject-First Assignments
  getAcademicAccountsStatus: async () => {
    return fetchJson<{
      currentSemester: { id: string; name: string };
      teams: any;
      lms: any;
    }>('/academic-accounts/status', undefined, {
      currentSemester: { id: 'CH20262701', name: 'Fall Semester 2026-27' },
      teams: { connected: false, status: 'disconnected' },
      lms: { connected: false, status: 'disconnected' },
    });
  },

  getUnifiedAssignments: async (): Promise<UnifiedAssignmentsDashboard> => {
    return fetchJson<UnifiedAssignmentsDashboard>('/assignments/unified', undefined, {
      currentSemester: { id: 'CH20262701', name: 'Fall Semester 2026-27' },
      stateLabel: 'not_synced',
      totalPendingAssignments: 0,
      totalSubmittedAssignments: 0,
      totalOverdueAssignments: 0,
      totalAssignments: 0,
      subjects: [],
      unmatchedAssignments: [],
      connectedAccounts: {
        teams: { connected: false },
        lms: { connected: false },
      },
    });
  },

  syncAllAcademicAccounts: async (): Promise<{
    success: boolean;
    message: string;
    dashboard?: UnifiedAssignmentsDashboard;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/academic-accounts/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `Sync failed with status ${res.status}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to re-sync academic accounts',
      };
    }
  },
};
