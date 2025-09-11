-- =============================================================================
-- FIX: Disable RLS on auth.users table to resolve signup errors
-- =============================================================================
-- This script fixes the "Database error" that occurs during user signup
-- Copy and paste this into Supabase SQL Editor
-- =============================================================================

-- CRITICAL FIX: Disable Row Level Security on auth.users
-- The auth.users table should NEVER have RLS enabled as it's managed by Supabase internally
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- Verification: Check that RLS is now disabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '❌ STILL ENABLED - Contact Supabase Support'
        ELSE '✅ CORRECTLY DISABLED - Signup should now work'
    END as status
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Success message
SELECT 'RLS fix applied! Try signing up again.' as message;

