-- ==============================================================================
-- CampusOS Supabase Schema & Row-Level Security (RLS) Policies
-- Project: CampusOS Unified Academic Operating System
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Profiles Table (Linked to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    reg_no TEXT,
    name TEXT,
    email TEXT,
    program TEXT,
    branch TEXT,
    semester TEXT,
    semester_id TEXT,
    batch TEXT,
    cgpa NUMERIC(4, 2) DEFAULT 0.00,
    credits_earned NUMERIC(6, 2) DEFAULT 0.00,
    rank INTEGER DEFAULT 0,
    avatar_url TEXT,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_reg_no ON public.profiles(reg_no);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger for updated_at on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 2. Semesters Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_semesters_user_id ON public.semesters(user_id);


-- ==============================================================================
-- 3. Courses Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    faculty TEXT,
    faculty_id TEXT,
    slot TEXT,
    type TEXT,
    credits NUMERIC(4, 1) DEFAULT 0.0,
    semester TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, code, slot)
);

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses(code);


-- ==============================================================================
-- 4. Attendance Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    attended INTEGER DEFAULT 0,
    conducted INTEGER DEFAULT 0,
    percentage NUMERIC(5, 2) DEFAULT 0.00,
    status TEXT,
    faculty TEXT,
    slot TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, course_code, slot)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);


-- ==============================================================================
-- 5. Marks & Assessments Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    faculty TEXT,
    assessments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, course_code)
);

CREATE INDEX IF NOT EXISTS idx_marks_user_id ON public.marks(user_id);


-- ==============================================================================
-- 6. Timetable Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.timetable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    faculty TEXT,
    slot TEXT,
    day INTEGER,
    day_name TEXT,
    start_time TEXT,
    end_time TEXT,
    venue TEXT,
    room TEXT,
    building TEXT,
    is_lab BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_user_id ON public.timetable(user_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON public.timetable(user_id, day);


-- ==============================================================================
-- 7. Exams Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    slot TEXT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    venue TEXT,
    seat_number TEXT,
    seat_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams(user_id);


-- ==============================================================================
-- 8. Unified Assignments Table (Teams, LMS, VTOP, Manual)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_assignment_id TEXT,
    title TEXT NOT NULL,
    course_code TEXT,
    course_title TEXT,
    faculty TEXT,
    due_date TEXT,
    due_time TEXT,
    status TEXT DEFAULT 'Pending',
    application_status TEXT,
    teams_submission_state TEXT,
    is_done BOOLEAN DEFAULT FALSE,
    is_submitted BOOLEAN DEFAULT FALSE,
    is_overdue BOOLEAN DEFAULT FALSE,
    is_late BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'Medium',
    weightage TEXT,
    instructions TEXT,
    platform_name TEXT,
    platform_url TEXT,
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON public.assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_source ON public.assignments(user_id, source);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(user_id, status);


-- ==============================================================================
-- 9. External Accounts Table (Teams, LMS Integrations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.external_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    account_email TEXT,
    username TEXT,
    display_name TEXT,
    tenant TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    mfa_required BOOLEAN DEFAULT FALSE,
    session_data JSONB DEFAULT '{}'::jsonb,
    matched_subjects JSONB DEFAULT '[]'::jsonb,
    total_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_external_accounts_user_id ON public.external_accounts(user_id);


-- ==============================================================================
-- 10. Fees & Receipts Tables
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_payable NUMERIC(10, 2) DEFAULT 0.00,
    total_paid NUMERIC(10, 2) DEFAULT 0.00,
    total_pending NUMERIC(10, 2) DEFAULT 0.00,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    date TEXT,
    amount NUMERIC(10, 2) DEFAULT 0.00,
    description TEXT,
    mode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    amount NUMERIC(10, 2) DEFAULT 0.00,
    due_date TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fees_user_id ON public.fees(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_dues_user_id ON public.dues(user_id);


-- ==============================================================================
-- 11. DSA Topics & Roadmap
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dsa_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    solved INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    confidence NUMERIC(5, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Not Started',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_dsa_topics_user_id ON public.dsa_topics(user_id);


-- ==============================================================================
-- 12. Placement Drives Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL,
    ctc TEXT,
    eligible BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'Applied',
    drive_date TEXT,
    deadline TEXT,
    application_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placements_user_id ON public.placements(user_id);


-- ==============================================================================
-- 13. LeetCode Stats Cache Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leetcode_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    easy_solved INTEGER DEFAULT 0,
    medium_solved INTEGER DEFAULT 0,
    hard_solved INTEGER DEFAULT 0,
    total_solved INTEGER DEFAULT 0,
    ranking INTEGER DEFAULT 0,
    contribution_points INTEGER DEFAULT 0,
    reputation INTEGER DEFAULT 0,
    submission_calendar JSONB DEFAULT '{}'::jsonb,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, username)
);

CREATE INDEX IF NOT EXISTS idx_leetcode_stats_user_id ON public.leetcode_stats(user_id);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsa_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leetcode_stats ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 2. Semesters
DROP POLICY IF EXISTS "semesters_select_policy" ON public.semesters;
CREATE POLICY "semesters_select_policy" ON public.semesters FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_insert_policy" ON public.semesters;
CREATE POLICY "semesters_insert_policy" ON public.semesters FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_update_policy" ON public.semesters;
CREATE POLICY "semesters_update_policy" ON public.semesters FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_delete_policy" ON public.semesters;
CREATE POLICY "semesters_delete_policy" ON public.semesters FOR DELETE USING (auth.uid() = user_id);

-- 3. Courses
DROP POLICY IF EXISTS "courses_select_policy" ON public.courses;
CREATE POLICY "courses_select_policy" ON public.courses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "courses_insert_policy" ON public.courses;
CREATE POLICY "courses_insert_policy" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "courses_update_policy" ON public.courses;
CREATE POLICY "courses_update_policy" ON public.courses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "courses_delete_policy" ON public.courses;
CREATE POLICY "courses_delete_policy" ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- 4. Attendance
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance FOR DELETE USING (auth.uid() = user_id);

-- 5. Marks
DROP POLICY IF EXISTS "marks_select_policy" ON public.marks;
CREATE POLICY "marks_select_policy" ON public.marks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "marks_insert_policy" ON public.marks;
CREATE POLICY "marks_insert_policy" ON public.marks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "marks_update_policy" ON public.marks;
CREATE POLICY "marks_update_policy" ON public.marks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "marks_delete_policy" ON public.marks;
CREATE POLICY "marks_delete_policy" ON public.marks FOR DELETE USING (auth.uid() = user_id);

-- 6. Timetable
DROP POLICY IF EXISTS "timetable_select_policy" ON public.timetable;
CREATE POLICY "timetable_select_policy" ON public.timetable FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "timetable_insert_policy" ON public.timetable;
CREATE POLICY "timetable_insert_policy" ON public.timetable FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "timetable_update_policy" ON public.timetable;
CREATE POLICY "timetable_update_policy" ON public.timetable FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "timetable_delete_policy" ON public.timetable;
CREATE POLICY "timetable_delete_policy" ON public.timetable FOR DELETE USING (auth.uid() = user_id);

-- 7. Exams
DROP POLICY IF EXISTS "exams_select_policy" ON public.exams;
CREATE POLICY "exams_select_policy" ON public.exams FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exams_insert_policy" ON public.exams;
CREATE POLICY "exams_insert_policy" ON public.exams FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exams_update_policy" ON public.exams;
CREATE POLICY "exams_update_policy" ON public.exams FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exams_delete_policy" ON public.exams;
CREATE POLICY "exams_delete_policy" ON public.exams FOR DELETE USING (auth.uid() = user_id);

-- 8. Assignments
DROP POLICY IF EXISTS "assignments_select_policy" ON public.assignments;
CREATE POLICY "assignments_select_policy" ON public.assignments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "assignments_insert_policy" ON public.assignments;
CREATE POLICY "assignments_insert_policy" ON public.assignments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assignments_update_policy" ON public.assignments;
CREATE POLICY "assignments_update_policy" ON public.assignments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assignments_delete_policy" ON public.assignments;
CREATE POLICY "assignments_delete_policy" ON public.assignments FOR DELETE USING (auth.uid() = user_id);

-- 9. External Accounts
DROP POLICY IF EXISTS "external_accounts_select_policy" ON public.external_accounts;
CREATE POLICY "external_accounts_select_policy" ON public.external_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "external_accounts_insert_policy" ON public.external_accounts;
CREATE POLICY "external_accounts_insert_policy" ON public.external_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "external_accounts_update_policy" ON public.external_accounts;
CREATE POLICY "external_accounts_update_policy" ON public.external_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "external_accounts_delete_policy" ON public.external_accounts;
CREATE POLICY "external_accounts_delete_policy" ON public.external_accounts FOR DELETE USING (auth.uid() = user_id);

-- 10. Fees & Receipts & Dues
DROP POLICY IF EXISTS "fees_select_policy" ON public.fees;
CREATE POLICY "fees_select_policy" ON public.fees FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fees_insert_policy" ON public.fees;
CREATE POLICY "fees_insert_policy" ON public.fees FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fees_update_policy" ON public.fees;
CREATE POLICY "fees_update_policy" ON public.fees FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fees_delete_policy" ON public.fees;
CREATE POLICY "fees_delete_policy" ON public.fees FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "receipts_select_policy" ON public.receipts;
CREATE POLICY "receipts_select_policy" ON public.receipts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "receipts_insert_policy" ON public.receipts;
CREATE POLICY "receipts_insert_policy" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "receipts_update_policy" ON public.receipts;
CREATE POLICY "receipts_update_policy" ON public.receipts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "receipts_delete_policy" ON public.receipts;
CREATE POLICY "receipts_delete_policy" ON public.receipts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dues_select_policy" ON public.dues;
CREATE POLICY "dues_select_policy" ON public.dues FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dues_insert_policy" ON public.dues;
CREATE POLICY "dues_insert_policy" ON public.dues FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dues_update_policy" ON public.dues;
CREATE POLICY "dues_update_policy" ON public.dues FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dues_delete_policy" ON public.dues;
CREATE POLICY "dues_delete_policy" ON public.dues FOR DELETE USING (auth.uid() = user_id);

-- 11. DSA Topics
DROP POLICY IF EXISTS "dsa_topics_select_policy" ON public.dsa_topics;
CREATE POLICY "dsa_topics_select_policy" ON public.dsa_topics FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dsa_topics_insert_policy" ON public.dsa_topics;
CREATE POLICY "dsa_topics_insert_policy" ON public.dsa_topics FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dsa_topics_update_policy" ON public.dsa_topics;
CREATE POLICY "dsa_topics_update_policy" ON public.dsa_topics FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dsa_topics_delete_policy" ON public.dsa_topics;
CREATE POLICY "dsa_topics_delete_policy" ON public.dsa_topics FOR DELETE USING (auth.uid() = user_id);

-- 12. Placements
DROP POLICY IF EXISTS "placements_select_policy" ON public.placements;
CREATE POLICY "placements_select_policy" ON public.placements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "placements_insert_policy" ON public.placements;
CREATE POLICY "placements_insert_policy" ON public.placements FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "placements_update_policy" ON public.placements;
CREATE POLICY "placements_update_policy" ON public.placements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "placements_delete_policy" ON public.placements;
CREATE POLICY "placements_delete_policy" ON public.placements FOR DELETE USING (auth.uid() = user_id);

-- 13. LeetCode Stats
DROP POLICY IF EXISTS "leetcode_stats_select_policy" ON public.leetcode_stats;
CREATE POLICY "leetcode_stats_select_policy" ON public.leetcode_stats FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leetcode_stats_insert_policy" ON public.leetcode_stats;
CREATE POLICY "leetcode_stats_insert_policy" ON public.leetcode_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leetcode_stats_update_policy" ON public.leetcode_stats;
CREATE POLICY "leetcode_stats_update_policy" ON public.leetcode_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leetcode_stats_delete_policy" ON public.leetcode_stats;
CREATE POLICY "leetcode_stats_delete_policy" ON public.leetcode_stats FOR DELETE USING (auth.uid() = user_id);
