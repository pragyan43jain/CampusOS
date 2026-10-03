-- ==============================================================================
-- CampusOS Supabase Analytics & Identity Migration
-- File: 20260926160000_add_campusos_analytics.sql
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Decouple Profiles Table from auth.users & Align with CampusOS Identity
-- ==============================================================================

-- Safely remove any foreign key constraint linking profiles.id to auth.users(id),
-- because CampusOS students authenticate via university credentials (VTOP),
-- not Supabase Auth.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'profiles_id_fkey'
          AND table_name = 'profiles'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;

-- Ensure public.profiles table exists with gen_random_uuid() default
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_no TEXT,
    name TEXT,
    email TEXT,
    program TEXT,
    branch TEXT,
    school TEXT,
    semester TEXT,
    semester_id TEXT,
    batch TEXT,
    cgpa NUMERIC(4, 2) DEFAULT 0.00,
    credits_earned NUMERIC(6, 2) DEFAULT 0.00,
    rank INTEGER DEFAULT 0,
    avatar_url TEXT,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure profiles.id has default gen_random_uuid() if table was created previously without it
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add missing columns to profiles if table previously existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reg_no TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create unique index on registration number for idempotent profile resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_reg_no_unique ON public.profiles(reg_no);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);


-- ==============================================================================
-- 3. Analytics Events Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reg_no TEXT NOT NULL,
    event_name TEXT NOT NULL,
    page TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimized indexes for fast dashboard queries and aggregation
CREATE INDEX IF NOT EXISTS idx_analytics_events_reg_no ON public.analytics_events(reg_no);
CREATE INDEX IF NOT EXISTS idx_analytics_events_student_id ON public.analytics_events(student_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON public.analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_reg_created ON public.analytics_events(reg_no, created_at DESC);


-- ==============================================================================
-- 4. Row-Level Security (RLS) Configuration
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies:
-- 1. Service role and backend have full access
DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;
CREATE POLICY "profiles_service_role_all" ON public.profiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Restrict reading profiles: Anon has NO select access. Authenticated users can only read their own profile.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_authenticated_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- 3. Restrict mutations: Anon has NO insert/update access. Only service_role or authenticated own profile.
DROP POLICY IF EXISTS "profiles_insert_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_authenticated_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Analytics Events RLS Policies:
-- 1. Full access for service_role
DROP POLICY IF EXISTS "analytics_events_service_role_all" ON public.analytics_events;
CREATE POLICY "analytics_events_service_role_all" ON public.analytics_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Allow event recording from client and backend
DROP POLICY IF EXISTS "analytics_events_insert_policy" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_policy" ON public.analytics_events
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 3. Strictly restrict SELECT: Normal users and anon CANNOT query raw events
-- (Admin queries run through backend or security definer stored procedure)
DROP POLICY IF EXISTS "analytics_events_select_policy" ON public.analytics_events;
CREATE POLICY "analytics_events_select_policy" ON public.analytics_events
    FOR SELECT TO service_role
    USING (true);


-- ==============================================================================
-- 5. Stored Procedures & Atomic Functions
-- ==============================================================================

-- 5.1 Atomically upsert a student profile and update last_active_at
CREATE OR REPLACE FUNCTION public.upsert_student_profile(
    p_reg_no TEXT,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_program TEXT DEFAULT NULL,
    p_branch TEXT DEFAULT NULL,
    p_school TEXT DEFAULT NULL,
    p_semester TEXT DEFAULT NULL,
    p_semester_id TEXT DEFAULT NULL,
    p_batch TEXT DEFAULT NULL,
    p_cgpa NUMERIC DEFAULT NULL,
    p_credits_earned NUMERIC DEFAULT NULL,
    p_rank INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_clean_reg TEXT;
BEGIN
    v_clean_reg := UPPER(TRIM(p_reg_no));
    IF v_clean_reg IS NULL OR v_clean_reg = '' OR v_clean_reg IN ('NOT AVAILABLE', 'SYNC REQUIRED') THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.profiles (
        reg_no,
        name,
        email,
        program,
        branch,
        school,
        semester,
        semester_id,
        batch,
        cgpa,
        credits_earned,
        rank,
        last_active_at,
        last_synced,
        updated_at
    )
    VALUES (
        v_clean_reg,
        p_name,
        p_email,
        p_program,
        p_branch,
        p_school,
        p_semester,
        p_semester_id,
        p_batch,
        COALESCE(p_cgpa, 0.00),
        COALESCE(p_credits_earned, 0.00),
        COALESCE(p_rank, 0),
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (reg_no) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        program = COALESCE(EXCLUDED.program, public.profiles.program),
        branch = COALESCE(EXCLUDED.branch, public.profiles.branch),
        school = COALESCE(EXCLUDED.school, public.profiles.school),
        semester = COALESCE(EXCLUDED.semester, public.profiles.semester),
        semester_id = COALESCE(EXCLUDED.semester_id, public.profiles.semester_id),
        batch = COALESCE(EXCLUDED.batch, public.profiles.batch),
        cgpa = CASE WHEN EXCLUDED.cgpa > 0 THEN EXCLUDED.cgpa ELSE public.profiles.cgpa END,
        credits_earned = CASE WHEN EXCLUDED.credits_earned > 0 THEN EXCLUDED.credits_earned ELSE public.profiles.credits_earned END,
        rank = CASE WHEN EXCLUDED.rank > 0 THEN EXCLUDED.rank ELSE public.profiles.rank END,
        last_active_at = NOW(),
        last_synced = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_profile_id;

    RETURN v_profile_id;
END;
$$;


-- 5.2 Atomically record an analytics event and touch profile last_active_at
CREATE OR REPLACE FUNCTION public.track_campus_event(
    p_reg_no TEXT,
    p_event_name TEXT,
    p_page TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_reg TEXT;
    v_student_id UUID;
    v_event_id UUID;
BEGIN
    v_clean_reg := UPPER(TRIM(p_reg_no));
    IF v_clean_reg IS NULL OR v_clean_reg = '' OR v_clean_reg IN ('NOT AVAILABLE', 'SYNC REQUIRED') THEN
        v_clean_reg := 'ANONYMOUS';
    END IF;

    -- Look up profile if student is registered
    IF v_clean_reg <> 'ANONYMOUS' THEN
        SELECT id INTO v_student_id FROM public.profiles WHERE reg_no = v_clean_reg LIMIT 1;
        
        -- If profile exists, touch last_active_at
        IF v_student_id IS NOT NULL THEN
            UPDATE public.profiles SET last_active_at = NOW() WHERE id = v_student_id;
        ELSE
            -- Auto-create minimal profile record on first activity
            INSERT INTO public.profiles (reg_no, last_active_at, created_at, updated_at)
            VALUES (v_clean_reg, NOW(), NOW(), NOW())
            ON CONFLICT (reg_no) DO UPDATE SET last_active_at = NOW()
            RETURNING id INTO v_student_id;
        END IF;
    END IF;

    -- Insert analytics event record
    INSERT INTO public.analytics_events (
        student_id,
        reg_no,
        event_name,
        page,
        metadata,
        created_at
    )
    VALUES (
        v_student_id,
        v_clean_reg,
        TRIM(p_event_name),
        p_page,
        COALESCE(p_metadata, '{}'::jsonb),
        NOW()
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;


-- 5.3 Aggregated Admin Analytics Summary Function
CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_users BIGINT;
    v_active_today BIGINT;
    v_active_7d BIGINT;
    v_active_30d BIGINT;
    v_new_users_7d BIGINT;
    v_new_users_30d BIGINT;
    v_recent_users JSONB;
    v_feature_usage JSONB;
    v_recent_activity JSONB;
    v_daily_active JSONB;
BEGIN
    -- 1. User counts
    SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE reg_no <> 'ANONYMOUS';
    
    SELECT COUNT(*) INTO v_active_today 
    FROM public.profiles 
    WHERE last_active_at >= (NOW() - INTERVAL '24 hours') AND reg_no <> 'ANONYMOUS';

    SELECT COUNT(*) INTO v_active_7d 
    FROM public.profiles 
    WHERE last_active_at >= (NOW() - INTERVAL '7 days') AND reg_no <> 'ANONYMOUS';

    SELECT COUNT(*) INTO v_active_30d 
    FROM public.profiles 
    WHERE last_active_at >= (NOW() - INTERVAL '30 days') AND reg_no <> 'ANONYMOUS';

    SELECT COUNT(*) INTO v_new_users_7d 
    FROM public.profiles 
    WHERE created_at >= (NOW() - INTERVAL '7 days') AND reg_no <> 'ANONYMOUS';

    SELECT COUNT(*) INTO v_new_users_30d 
    FROM public.profiles 
    WHERE created_at >= (NOW() - INTERVAL '30 days') AND reg_no <> 'ANONYMOUS';

    -- 2. Recent Active Users (Top 25)
    SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) INTO v_recent_users
    FROM (
        SELECT 
            id,
            reg_no,
            name,
            email,
            program,
            branch,
            cgpa,
            last_active_at,
            created_at
        FROM public.profiles
        WHERE reg_no <> 'ANONYMOUS'
        ORDER BY last_active_at DESC
        LIMIT 25
    ) u;

    -- 3. Feature usage breakdown
    SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) INTO v_feature_usage
    FROM (
        SELECT 
            event_name,
            COUNT(*) AS count,
            COUNT(DISTINCT reg_no) AS unique_users,
            MAX(created_at) AS last_triggered_at
        FROM public.analytics_events
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 20
    ) f;

    -- 4. Recent activity log (Latest 50 events)
    SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) INTO v_recent_activity
    FROM (
        SELECT 
            id,
            reg_no,
            event_name,
            page,
            metadata,
            created_at
        FROM public.analytics_events
        ORDER BY created_at DESC
        LIMIT 50
    ) a;

    -- 5. Daily Active Users (Last 30 days)
    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) INTO v_daily_active
    FROM (
        SELECT 
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
            COUNT(DISTINCT reg_no) AS active_users,
            COUNT(*) AS total_events
        FROM public.analytics_events
        WHERE created_at >= (NOW() - INTERVAL '30 days')
          AND reg_no <> 'ANONYMOUS'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at) ASC
    ) d;

    -- Assemble unified payload
    RETURN jsonb_build_object(
        'totalUsers', v_total_users,
        'activeToday', v_active_today,
        'activeLast7Days', v_active_7d,
        'activeLast30Days', v_active_30d,
        'newUsersLast7Days', v_new_users_7d,
        'newUsersLast30Days', v_new_users_30d,
        'dailyActiveUsers', v_daily_active,
        'recentUsers', v_recent_users,
        'featureUsage', v_feature_usage,
        'recentActivity', v_recent_activity,
        'generatedAt', NOW()
    );
END;
$$;

-- Security Hardening (C9): Restrict admin analytics function to service_role
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO service_role;

