-- Migration: 20261003120000_harden_security_and_rls.sql
-- Description: Harden Supabase RLS policies and restrict SECURITY DEFINER stored procedures.
-- Remediates Critical Vulnerability C9.

-- 1. Drop insecure public policies on profiles
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_public" ON public.profiles;

-- 2. Strictly enforce service_role and own-user access
DROP POLICY IF EXISTS "profiles_select_authenticated_own" ON public.profiles;
CREATE POLICY "profiles_select_authenticated_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_authenticated_own" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_authenticated_own" ON public.profiles;
CREATE POLICY "profiles_update_authenticated_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Lock down admin analytics summary function
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO service_role;
