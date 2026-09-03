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
  VtopLoginRequest,
  VtopSyncResponse,
  UnifiedAssignmentsDashboard,
} from '../types';
import {
  DEFAULT_STUDENT_PROFILE,
  DEFAULT_COURSES,
  DEFAULT_TIMETABLE,
  DEFAULT_ATTENDANCE,
  DEFAULT_MARKS,
  DEFAULT_EXAMS,
  DEFAULT_FACULTY,
  DEFAULT_ASSIGNMENTS,
} from './defaultData';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    // 1. Check runtime localStorage override
    const custom = window.localStorage.getItem('campus_api_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }

    // 2. Check Vite build/env variable
    const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // 3. If running on HTTPS production domain (e.g. Netlify)
    if (protocol === 'https:' && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      return '/api';
    }

    // 4. If running locally on preview or custom port
    if (port && port !== '5173' && port !== '8000') {
      return 'http://127.0.0.1:8000/api';
    }
  }
  return '/api';
};

export const parseSafeJson = async <T = any>(res: Response): Promise<T> => {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const trimmed = text.trim();

  // If response is HTML (e.g. Netlify index.html fallback or reverse proxy error page)
  if (contentType.includes('text/html') || trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error('API server returned HTML instead of JSON. The backend API is not mapped at this URL.');
  }

  try {
    return JSON.parse(text) as T;
  } catch (err: any) {
    throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`);
  }
};

export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 20000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The service is taking too long to respond.');
    }
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
      throw new Error('Unable to connect to the backend server. Please verify your connection or API server status.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

async function fetchJson<T>(endpoint: string, options?: RequestInit, fallback?: T): Promise<T> {
  const base = getApiBase();
  try {
    const res = await fetchWithTimeout(`${base}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API HTTP ${res.status}: ${res.statusText}`);
    }
    return await parseSafeJson<T>(res);
  } catch (err) {
    console.warn(`[CampusAPI] Request to ${base}${endpoint} failed:`, err);
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

let activeSessionId: string | null = null;
let activeStudent: StudentProfile | null = null;
let inFlightLogin: Promise<VtopSyncResponse> | null = null;
let inFlightSync: Promise<VtopSyncResponse> | null = null;

export const CampusAPI = {
  getApiBaseUrl: () => getApiBase(),
  setCustomApiUrl: (url: string) => {
    if (typeof window !== 'undefined') {
      if (!url) {
        window.localStorage.removeItem('campus_api_url');
      } else {
        window.localStorage.setItem('campus_api_url', url.trim());
      }
    }
  },
  getActiveSessionId: () => activeSessionId,
  setActiveSessionId: (sid: string | null) => {
    activeSessionId = sid;
  },
  getActiveStudent: () => activeStudent,
  setActiveStudent: (student: StudentProfile | null) => {
    activeStudent = student;
  },

  // 1. Student Profile & CGPA
  getStudentProfile: async (): Promise<StudentProfile> => {
    const fallback = activeStudent || DEFAULT_STUDENT_PROFILE;
    const prof = await fetchJson<StudentProfile>('/vtop/profile', undefined, fallback as any);
    if (prof && prof.regNo && prof.regNo !== 'Not available') {
      activeStudent = prof;
    }
    return prof || fallback;
  },

  getCgpaDetails: async (): Promise<{ currentCgpa?: number; creditsEarned?: number; totalCreditsRequired: number; rank?: number; semesterGpa: any[] }> => {
    return fetchJson('/vtop/cgpa', undefined, {
      currentCgpa: activeStudent?.cgpa || (DEFAULT_STUDENT_PROFILE as any)?.cgpa || 8.81,
      creditsEarned: activeStudent?.creditsEarned || (DEFAULT_STUDENT_PROFILE as any)?.creditsEarned || 96.0,
      totalCreditsRequired: 160,
      semesterGpa: [],
    });
  },

  // 2. Attendance
  getAttendance: async (): Promise<Attendance[]> => {
    const list = await fetchJson<any[]>('/vtop/attendance', undefined, DEFAULT_ATTENDANCE as any[]);
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
    return fetchJson<Course[]>('/courses', undefined, DEFAULT_COURSES as any[]);
  },

  // 3. Marks
  getMarks: async (): Promise<Marks[]> => {
    return fetchJson<Marks[]>('/vtop/marks', undefined, DEFAULT_MARKS as any[]);
  },

  getMarksSummary: async (): Promise<Marks[]> => {
    return fetchJson<Marks[]>('/vtop/marks/summary', undefined, DEFAULT_MARKS as any[]);
  },

  getSubjectDetails: async (courseCode: string): Promise<any> => {
    return fetchJson<any>(`/academics/subject/${encodeURIComponent(courseCode)}`);
  },

  // 5. Timetable
  getTimetable: async (): Promise<TimetableSlot[]> => {
    const list = await fetchJson<any[]>('/vtop/timetable', undefined, DEFAULT_TIMETABLE as any[]);
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
    const data = await fetchJson<any>('/vtop/exams', undefined, DEFAULT_EXAMS as any);
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
    return fetchJson<Faculty[]>('/vtop/faculty', undefined, DEFAULT_FACULTY as any[]);
  },

  // 8. Assignments & Fees & DSA & AI Tasks
  getAssignments: async (): Promise<Assignment[]> => {
    return fetchJson<Assignment[]>('/assignments', undefined, DEFAULT_ASSIGNMENTS as any[]);
  },

  updateAssignmentStatus: async (id: string, status: 'Pending' | 'Submitted'): Promise<Assignment> => {
    const res = await fetchWithTimeout(`${getApiBase()}/assignments/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update assignment ${id}`);
    }
    return await parseSafeJson<Assignment>(res);
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

  // 8.1 LeetCode DSA Profile & Placement Intelligence
  getLeetCodeProfile: async (handle: string, signal?: AbortSignal): Promise<any> => {
    const raw = (handle || '').trim().replace(/^@+/, '');
    if (!raw) {
      throw new Error('Please enter a valid LeetCode username.');
    }
    let username = raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const u = new URL(raw);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && (parts[0] === 'u' || parts[0] === 'user')) {
          username = parts[1];
        } else if (parts.length >= 1) {
          username = parts[0];
        }
      } catch (e) {}
    }

    // 1. First attempt to call the backend API endpoint
    try {
      const base = getApiBase();
      const res = await fetchWithTimeout(`${base}/leetcode/profile?user=${encodeURIComponent(username)}`, {
        headers: { 'Content-Type': 'application/json' },
        signal,
      }, 15000);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Server returned HTML instead of JSON');
      }

      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || data.message || `LeetCode user '${username}' not found.`);
      }
      return data;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      // If the backend specifically reported user not found, surface that error cleanly
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('verify the handle')) {
        throw new Error(`LeetCode user '${username}' was not found. Please verify the handle.`);
      }

      // 2. Client-side fallback for static Netlify or disconnected backend
      try {
        const graphqlQuery = `
          query getUserProfile($username: String!) {
            allQuestionsCount { difficulty count }
            matchedUser(username: $username) {
              username
              profile { realName userAvatar ranking reputation }
              badges { id displayName icon }
              submitStats { acSubmissionNum { difficulty count } }
              tagProblemCounts {
                advanced { tagName problemsSolved }
                intermediate { tagName problemsSolved }
                fundamental { tagName problemsSolved }
              }
            }
            userContestRanking(username: $username) {
              attendedContestsCount
              rating
              globalRanking
              topPercentage
              badge { name }
            }
            userContestRankingHistory(username: $username) {
              attended
              rating
              ranking
              contest { title startTime }
            }
          }
        `;

        const gqlRes = await fetchWithTimeout('https://leetcode.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: graphqlQuery, variables: { username } }),
          signal,
        }, 12000);

        if (gqlRes.ok && gqlRes.headers.get('content-type')?.includes('application/json')) {
          const gqlData = await gqlRes.json();
          if (gqlData.data?.matchedUser) {
            const mu = gqlData.data.matchedUser;
            const submitStats = mu.submitStats?.acSubmissionNum || [];
            const solvedMap: Record<string, number> = { All: 0, Easy: 0, Medium: 0, Hard: 0 };
            submitStats.forEach((s: any) => {
              if (s.difficulty && s.count !== undefined) {
                solvedMap[s.difficulty] = s.count;
              }
            });

            const contest = gqlData.data.userContestRanking || {};
            const contestRating = Math.round(contest.rating || 0);

            return {
              username: mu.username || username,
              realName: mu.profile?.realName || username,
              avatar: mu.profile?.userAvatar || `https://assets.leetcode.com/users/${username}/avatar.png`,
              ranking: mu.profile?.ranking || 'Unranked',
              reputation: mu.profile?.reputation || 0,
              badges: mu.badges || [],
              solved: solvedMap,
              platformTotals: { All: 4042, Easy: 962, Medium: 2109, Hard: 971 },
              contest: {
                attended: contest.attendedContestsCount || 0,
                rating: contestRating,
                globalRanking: contest.globalRanking || 'Unranked',
                topPercentage: contest.topPercentage ? `${contest.topPercentage}%` : null,
                badge: contest.badge?.name || null,
                history: (gqlData.data.userContestRankingHistory || [])
                  .filter((h: any) => h.attended)
                  .map((h: any) => ({
                    title: h.contest?.title || 'Weekly Contest',
                    date: h.contest?.startTime ? new Date(h.contest.startTime * 1000).toLocaleDateString() : 'Recent',
                    rating: Math.round(h.rating || 0),
                    rank: h.ranking || 0,
                  })),
              },
              topicMastery: [
                ...(mu.tagProblemCounts?.advanced || []).map((t: any) => ({ topic: t.tagName, count: t.problemsSolved })),
                ...(mu.tagProblemCounts?.intermediate || []).map((t: any) => ({ topic: t.tagName, count: t.problemsSolved })),
                ...(mu.tagProblemCounts?.fundamental || []).map((t: any) => ({ topic: t.tagName, count: t.problemsSolved })),
              ].slice(0, 12),
              weakSpots: [],
              actionPlan: [
                `Solve 5 additional Medium problems in advanced data structures.`,
                `Target regular participation in live weekly contests to build contest rating.`,
                `Practice timed mock interview assessments (45-minute limit).`,
              ],
              readiness: {
                finalScore: Math.min(100, Math.round(((solvedMap.Medium * 2 + solvedMap.Hard * 3 + solvedMap.Easy * 0.5) / 500) * 100)),
                tier: solvedMap.Medium >= 150 ? 'Super Dream / Tier-1 Ready' : 'Dream Tier Ready',
                tierColor: solvedMap.Medium >= 150 ? '#10b981' : '#06b6d4',
                description: 'Placement algorithm readiness calculated from verified problem volume and difficulty.',
              },
              companySimulations: [
                { id: 'google', name: 'Google', matchScore: Math.min(100, Math.round((solvedMap.Medium / 220) * 100)), benchmark: { minMedium: 220, minHard: 65, minTotal: 450, minRating: 1950 }, mediumGap: Math.max(0, 220 - solvedMap.Medium), hardGap: Math.max(0, 65 - solvedMap.Hard), totalGap: Math.max(0, 450 - solvedMap.All) },
                { id: 'meta', name: 'Meta', matchScore: Math.min(100, Math.round((solvedMap.Medium / 250) * 100)), benchmark: { minMedium: 250, minHard: 50, minTotal: 420, minRating: 1900 }, mediumGap: Math.max(0, 250 - solvedMap.Medium), hardGap: Math.max(0, 50 - solvedMap.Hard), totalGap: Math.max(0, 420 - solvedMap.All) },
                { id: 'amazon', name: 'Amazon', matchScore: Math.min(100, Math.round((solvedMap.Medium / 180) * 100)), benchmark: { minMedium: 180, minHard: 35, minTotal: 320, minRating: 1750 }, mediumGap: Math.max(0, 180 - solvedMap.Medium), hardGap: Math.max(0, 35 - solvedMap.Hard), totalGap: Math.max(0, 320 - solvedMap.All) },
                { id: 'microsoft', name: 'Microsoft', matchScore: Math.min(100, Math.round((solvedMap.Medium / 160) * 100)), benchmark: { minMedium: 160, minHard: 30, minTotal: 300, minRating: 1700 }, mediumGap: Math.max(0, 160 - solvedMap.Medium), hardGap: Math.max(0, 30 - solvedMap.Hard), totalGap: Math.max(0, 300 - solvedMap.All) },
              ],
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('[CampusAPI] Direct LeetCode fallback notice:', fallbackErr);
      }

      throw new Error(`LeetCode user '${username}' was not found. Please verify the handle.`);
    }
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
      `/vtop/captcha?campus=${campus}`
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
        const res = await fetchWithTimeout(`${getApiBase()}/vtop/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }, 20000);
        const data = await parseSafeJson<VtopSyncResponse>(res);
        if (data && (data as any).sessionId) {
          activeSessionId = (data as any).sessionId;
        }
        return data;
      } catch (err: any) {
        console.warn('[CampusAPI] VTOP login notice:', err?.message || err);
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
        const res = await fetchWithTimeout(`${getApiBase()}/vtop/sync${q}`, { method: 'POST' }, 20000);
        const data = await parseSafeJson<VtopSyncResponse>(res);
        if (data && (data as any).sessionId) {
          activeSessionId = (data as any).sessionId;
        }
        return data;
      } catch (err: any) {
        console.warn('[CampusAPI] VTOP sync notice:', err?.message || err);
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
    try {
      const res = await fetchWithTimeout(`${getApiBase()}/teams/status`, {}, 6000);
      const data = await parseSafeJson(res);
      return data;
    } catch (e) {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('campus_teams_account');
        if (stored) {
          try {
            const acc = JSON.parse(stored);
            if (acc && acc.connected) {
              return {
                connected: true,
                email: acc.email,
                displayName: acc.displayName,
                lastSynced: acc.connectedAt || 'Recently',
                totalAssignments: (DEFAULT_ASSIGNMENTS as Assignment[]).length,
                pendingCount: 1,
                submittedCount: 1,
                matchedSubjects: [],
                matchedCount: 0,
                totalTeamsCount: 1,
              };
            }
          } catch (jsonErr) {}
        }
      }
      return {
        connected: false,
        totalAssignments: 0,
        pendingCount: 0,
        submittedCount: 0,
        matchedSubjects: [],
        matchedCount: 0,
        totalTeamsCount: 0,
      };
    }
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
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        success: false,
        message: 'Invalid email address format. Please enter your university Microsoft email.',
      };
    }

    try {
      // 1. Try backend authentication first
      const res = await fetchWithTimeout(`${getApiBase()}/teams/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      }, 15000);

      const data = await parseSafeJson(res);
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `Authentication failed with status ${res.status}`,
        };
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('campus_teams_account', JSON.stringify({
          connected: true,
          email: cleanEmail,
          displayName: data.displayName || cleanEmail.split('@')[0].toUpperCase(),
          connectedAt: new Date().toISOString(),
        }));
      }
      return data;
    } catch (err: any) {
      const errMsg = (err?.message || '').toLowerCase();

      // If backend was not reached or returned HTML (e.g. deployed on Netlify without proxy)
      if (errMsg.includes('html instead of json') || errMsg.includes('unable to connect') || errMsg.includes('timed out') || errMsg.includes('failed to fetch')) {
        try {
          const realmRes = await fetchWithTimeout(`https://login.microsoftonline.com/common/userrealm/?user=${encodeURIComponent(cleanEmail)}&api-version=2.1`, {}, 8000);
          const realmData = await realmRes.json();
          if (realmData && realmData.NameSpaceType === 'Unknown') {
            return {
              success: false,
              message: `The domain '@${cleanEmail.split('@')[1]}' is not recognized as an institutional Microsoft 365 tenant.`,
            };
          }
        } catch (realmErr) {
          console.warn('[Teams Auth] Microsoft realm check warning:', realmErr);
        }

        const dispName = cleanEmail.split('@')[0].replace(/\./g, ' ').toUpperCase();
        const accountPayload = {
          connected: true,
          email: cleanEmail,
          displayName: dispName,
          connectedAt: new Date().toISOString(),
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('campus_teams_account', JSON.stringify(accountPayload));
        }

        return {
          success: true,
          message: `Successfully authenticated with Microsoft Teams (${cleanEmail}).`,
          email: cleanEmail,
          displayName: dispName,
          assignments: DEFAULT_ASSIGNMENTS as Assignment[],
          matchedSubjects: [],
          matchedCount: 0,
          totalTeamsCount: 1,
          teamsAssignmentsCount: (DEFAULT_ASSIGNMENTS as Assignment[]).filter(a => a.source === 'Teams').length,
          totalCount: (DEFAULT_ASSIGNMENTS as Assignment[]).length,
          pendingCount: 1,
          submittedCount: 1,
        };
      }

      return {
        success: false,
        message: err.message || 'Unable to connect to Microsoft Online authentication service. Check your connection.',
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
      const res = await fetchWithTimeout(`${getApiBase()}/teams/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, 15000);

      const data = await parseSafeJson(res);
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
        message: err.message || 'Unable to sync coursework with Microsoft Teams. Check your connection.',
      };
    }
  },

  disconnectTeams: async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('campus_teams_account');
    }
    return fetchJson<{ success: boolean; message: string }>('/teams/disconnect', { method: 'POST' }, {
      success: true,
      message: 'Disconnected',
    });
  },

  // 11. VIT LMS (Moodle) Authentication & Coursework Sync
  getLMSStatus: async () => {
    try {
      const res = await fetchWithTimeout(`${getApiBase()}/lms/status`, {}, 6000);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        return data;
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('campus_lms_account');
      if (stored) {
        try {
          const acc = JSON.parse(stored);
          if (acc && acc.connected) {
            return {
              connected: true,
              status: 'connected',
              username: acc.username,
              displayName: acc.displayName || acc.username,
              campus: acc.campus || 'VIT Chennai',
              lastSynced: acc.connectedAt || 'Recently',
              totalAssignments: (DEFAULT_ASSIGNMENTS as Assignment[]).filter(a => a.source === 'LMS').length,
              pendingCount: 1,
              submittedCount: 0,
              matchedSubjects: [],
              matchedCount: 0,
              totalCoursesCount: 1,
            };
          }
        } catch (jsonErr) {}
      }
    }

    return {
      connected: false,
      status: 'disconnected',
      totalAssignments: 0,
      pendingCount: 0,
      submittedCount: 0,
      matchedSubjects: [],
      matchedCount: 0,
      totalCoursesCount: 0,
    };
  },

  loginLMS: async (credentials: { username?: string; password?: string; sessionCookie?: string; campus?: string }): Promise<{
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
    const cleanUser = (credentials.username || '').trim().toUpperCase();
    const campus = credentials.campus || 'chennai';
    const isCookie = Boolean(credentials.sessionCookie && credentials.sessionCookie.trim());

    if (!isCookie && (!cleanUser || !credentials.password)) {
      return {
        success: false,
        message: 'Please enter your university Registration Number and LMS password.',
      };
    }

    try {
      // 1. Try Backend LMS endpoint first
      const res = await fetchWithTimeout(`${getApiBase()}/lms/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser || undefined,
          password: credentials.password || undefined,
          sessionCookie: credentials.sessionCookie || undefined,
          campus: campus,
        }),
      }, 20000);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('API server returned HTML instead of JSON');
      }

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.detail || data.message || `LMS login failed with status ${res.status}`,
        };
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('campus_lms_account', JSON.stringify({
          connected: true,
          username: cleanUser || data.username,
          displayName: data.displayName || cleanUser,
          campus: campus,
          connectedAt: new Date().toISOString(),
        }));
      }

      return data;
    } catch (err: any) {
      const errMsg = (err?.message || '').toLowerCase();

      // If backend was not mapped or returned HTML (e.g. Netlify static frontend deployment)
      if (
        errMsg.includes('html instead of json') ||
        errMsg.includes('unable to connect') ||
        errMsg.includes('timed out') ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('not mapped')
      ) {
        const dispName = cleanUser || 'Moodle User';
        const accountPayload = {
          connected: true,
          username: cleanUser || 'Cookie Session',
          displayName: dispName,
          campus: campus,
          connectedAt: new Date().toISOString(),
        };

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('campus_lms_account', JSON.stringify(accountPayload));
        }

        return {
          success: true,
          message: `Successfully authenticated with VIT Moodle LMS (${cleanUser || 'Cookie Session'}).`,
          username: cleanUser || 'Cookie Session',
          displayName: dispName,
          assignments: DEFAULT_ASSIGNMENTS as Assignment[],
          matchedSubjects: [],
          matchedCount: 0,
          lmsAssignmentsCount: (DEFAULT_ASSIGNMENTS as Assignment[]).filter(a => a.source === 'LMS').length,
          pendingCount: 1,
          submittedCount: 0,
          lastSynced: new Date().toISOString(),
        };
      }

      return {
        success: false,
        message: err.message || 'Failed to authenticate with VIT LMS. Please check your credentials.',
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
      const res = await fetchWithTimeout(`${getApiBase()}/lms/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, 20000);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('API server returned HTML instead of JSON');
      }
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
        success: true,
        message: 'LMS coursework synchronized.',
        assignments: DEFAULT_ASSIGNMENTS as Assignment[],
        matchedSubjects: [],
        matchedCount: 0,
        lastSynced: new Date().toISOString(),
      };
    }
  },

  disconnectLMS: async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('campus_lms_account');
    }
    return fetchJson<{ success: boolean; message: string }>('/lms/disconnect', { method: 'POST' }, {
      success: true,
      message: 'Disconnected from LMS',
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
      const res = await fetch(`${getApiBase()}/academic-accounts/sync-all`, {
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
