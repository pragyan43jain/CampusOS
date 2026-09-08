import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";
import { StudentProfile, Course, Attendance, TimetableSlot, Assignment } from "../types";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://qvxgdarfzhoxmfujdrij.supabase.co";
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_MuEAEzSmTaYAZngVY0t_3A_R3BDRb6e";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface SupabaseAuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

export const SupabaseService = {
  client: supabase,
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,

  // --- 1. Authentication ---
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  getCurrentSession: async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  signUp: async (email: string, password: string, fullName?: string): Promise<SupabaseAuthResponse> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split("@")[0],
        },
      },
    });
    return { user: data.user, session: data.session, error };
  },

  signIn: async (email: string, password: string): Promise<SupabaseAuthResponse> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { user: data.user, session: data.session, error };
  },

  signOut: async (): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // --- 2. Database Sync & Retrieval ---
  getProfile: async (userId?: string): Promise<StudentProfile | null> => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (error || !data) return null;

    return {
      regNo: data.reg_no || "",
      name: data.name || "",
      email: data.email || "",
      program: data.program || "",
      branch: data.branch || "",
      semester: data.semester || "",
      batch: data.batch || "",
      cgpa: data.cgpa ? Number(data.cgpa) : undefined,
      creditsEarned: data.credits_earned ? Number(data.credits_earned) : undefined,
      rank: data.rank || undefined,
      lastSynced: data.last_synced || undefined,
    };
  },

  saveProfile: async (profile: StudentProfile, userId?: string) => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase.from("profiles").upsert({
      id: uid,
      reg_no: profile.regNo,
      name: profile.name,
      email: profile.email,
      program: profile.program,
      branch: profile.branch,
      semester: profile.semester ? String(profile.semester) : null,
      batch: profile.batch,
      cgpa: profile.cgpa,
      credits_earned: profile.creditsEarned,
      rank: profile.rank,
      last_synced: new Date().toISOString(),
    });
    return { data, error };
  },

  getAttendance: async (userId?: string): Promise<Attendance[]> => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", uid);

    if (error || !data) return [];

    return data.map((d: any) => {
      const conducted = Number(d.conducted || 0);
      const attended = Number(d.attended || 0);
      const percentage = Number(d.percentage || (conducted > 0 ? (attended / conducted) * 100 : 0));
      return {
        id: d.id,
        courseCode: d.course_code,
        courseTitle: d.course_name,
        courseName: d.course_name,
        faculty: d.faculty || "Faculty",
        facultyName: d.faculty || "Faculty",
        classesConducted: conducted,
        conducted: conducted,
        total: conducted,
        classesAttended: attended,
        attended: attended,
        attendancePercentage: percentage,
        percentage: percentage,
        displayPercentage: `${percentage}%`,
        status: d.status || (percentage >= 75 ? "Safe" : "Critical"),
        attendanceStatus: d.status || (percentage >= 75 ? "Safe" : "Critical"),
        safeToMiss: percentage >= 75 ? Math.floor((attended - 0.75 * conducted) / 0.75) : 0,
        needToAttend: percentage < 75 ? Math.ceil((0.75 * conducted - attended) / 0.25) : 0,
        slot: d.slot,
        lastUpdated: d.last_updated,
        hasValidData: true,
      };
    });
  },

  getCourses: async (userId?: string): Promise<Course[]> => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", uid);

    if (error || !data) return [];

    return data.map((c: any) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      faculty: c.faculty || "Faculty",
      slot: c.slot || "TBA",
      venue: "TBA",
      type: (c.type === "Lab" ? "Lab" : "Theory") as "Theory" | "Lab" | "Embedded",
      credits: Number(c.credits || 0),
      attendance: {
        attended: 0,
        total: 0,
        percentage: 0,
        safeToMiss: 0,
        needToAttend: 0,
        isCritical: false,
      },
    }));
  },

  getTimetable: async (userId?: string): Promise<TimetableSlot[]> => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("timetable")
      .select("*")
      .eq("user_id", uid);

    if (error || !data) return [];

    return data.map((t: any) => ({
      id: t.id,
      day: (t.day_name || "MON").slice(0, 3).toUpperCase() as any,
      dayName: t.day_name || "Monday",
      courseCode: t.course_code,
      courseTitle: t.course_title,
      courseName: t.course_title,
      subjectCode: t.course_code,
      subject: t.course_title,
      faculty: t.faculty || "Faculty",
      facultyName: t.faculty || "Faculty",
      slot: t.slot || "A1",
      slotName: t.slot || "A1",
      startTime: t.start_time || "08:00",
      endTime: t.end_time || "08:50",
      venue: t.venue || "TBA",
      room: t.room || "TBA",
      building: t.building || "TBA",
      block: t.building || "TBA",
      isLab: Boolean(t.is_lab),
      classType: t.is_lab ? "Lab" : "Theory",
    }));
  },

  getAssignments: async (userId?: string): Promise<Assignment[]> => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", uid)
      .order("due_date", { ascending: true });

    if (error || !data) return [];

    return data.map((a: any) => ({
      id: a.id,
      source: a.source,
      sourceAssignmentId: a.source_assignment_id,
      title: a.title,
      courseCode: a.course_code,
      courseTitle: a.course_title,
      faculty: a.faculty,
      dueDate: a.due_date,
      dueTime: a.due_time,
      status: a.status,
      applicationStatus: a.application_status,
      teamsSubmissionState: a.teams_submission_state,
      isDone: a.is_done,
      isSubmitted: a.is_submitted,
      isOverdue: a.is_overdue,
      isLate: a.is_late,
      priority: a.priority,
      weightage: a.weightage,
      instructions: a.instructions,
      platformName: a.platform_name,
      platformUrl: a.platform_url,
    }));
  },

  // --- 3. Edge Functions Caller ---
  invokeFunction: async <T = any>(functionName: string, body?: any): Promise<T> => {
    const session = (await supabase.auth.getSession()).data.session;
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`Edge function ${functionName} failed: ${res.statusText}`);
    }

    return await res.json();
  },
};
