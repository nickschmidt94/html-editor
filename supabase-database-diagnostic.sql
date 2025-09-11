-- =============================================================================
-- COMPREHENSIVE SUPABASE DATABASE DIAGNOSTIC SCRIPT
-- =============================================================================
-- This read-only script examines your database schema and provides insights
-- Copy and paste this entire script into Supabase SQL Editor
-- =============================================================================

-- Section 1: Database Overview and Schema Information
SELECT 'DATABASE OVERVIEW' as section_title, '' as table_name, '' as column_name, '' as data_type, '' as details
UNION ALL
SELECT '==================', '', '', '', ''
UNION ALL
SELECT 'Current Database', current_database(), '', '', ''
UNION ALL
SELECT 'Current User', current_user, '', '', ''
UNION ALL
SELECT 'Current Schema', current_schema(), '', '', ''
UNION ALL
SELECT 'PostgreSQL Version', version(), '', '', ''
UNION ALL
SELECT '', '', '', '', ''

-- Section 2: All Tables in Public Schema
UNION ALL
SELECT 'PUBLIC SCHEMA TABLES' as section_title, '', '', '', ''
UNION ALL
SELECT '====================', '', '', '', ''
UNION ALL
SELECT 
    'Table Exists' as section_title,
    table_name,
    '' as column_name,
    table_type as data_type,
    CASE 
        WHEN table_name IN ('documents', 'categories', 'user_api_keys', 'spaces') 
        THEN '✅ Expected table found'
        ELSE '⚠️ Additional table found'
    END as details
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT '', '', '', '', ''

-- Section 3: Expected Tables Status
UNION ALL
SELECT 'EXPECTED TABLES CHECK' as section_title, '', '', '', ''
UNION ALL
SELECT '======================', '', '', '', ''
UNION ALL
SELECT 
    'Table Status' as section_title,
    expected_table as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = expected_table
        ) 
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as details
FROM (
    VALUES 
        ('documents'),
        ('categories'), 
        ('user_api_keys'),
        ('spaces')
) AS t(expected_table)
UNION ALL
SELECT '', '', '', '', ''

-- Section 4: Documents Table Structure
UNION ALL
SELECT 'DOCUMENTS TABLE STRUCTURE' as section_title, '', '', '', ''
UNION ALL
SELECT '==========================', '', '', '', ''
UNION ALL
SELECT 
    'Documents Column' as section_title,
    'documents' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULLABLE'
        ELSE 'NOT NULL'
    END || 
    CASE 
        WHEN column_default IS NOT NULL THEN ' (DEFAULT: ' || column_default || ')'
        ELSE ''
    END as details
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'documents'
ORDER BY ordinal_position
UNION ALL
SELECT '', '', '', '', ''

-- Section 5: Categories Table Structure
UNION ALL
SELECT 'CATEGORIES TABLE STRUCTURE' as section_title, '', '', '', ''
UNION ALL
SELECT '===========================', '', '', '', ''
UNION ALL
SELECT 
    'Categories Column' as section_title,
    'categories' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULLABLE'
        ELSE 'NOT NULL'
    END || 
    CASE 
        WHEN column_default IS NOT NULL THEN ' (DEFAULT: ' || column_default || ')'
        ELSE ''
    END as details
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'categories'
ORDER BY ordinal_position
UNION ALL
SELECT '', '', '', '', ''

-- Section 6: User API Keys Table Structure
UNION ALL
SELECT 'USER_API_KEYS TABLE STRUCTURE' as section_title, '', '', '', ''
UNION ALL
SELECT '==============================', '', '', '', ''
UNION ALL
SELECT 
    'API Keys Column' as section_title,
    'user_api_keys' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULLABLE'
        ELSE 'NOT NULL'
    END || 
    CASE 
        WHEN column_default IS NOT NULL THEN ' (DEFAULT: ' || column_default || ')'
        ELSE ''
    END as details
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'user_api_keys'
ORDER BY ordinal_position
UNION ALL
SELECT '', '', '', '', ''

-- Section 7: Spaces Table Structure (if exists)
UNION ALL
SELECT 'SPACES TABLE STRUCTURE' as section_title, '', '', '', ''
UNION ALL
SELECT '=======================', '', '', '', ''
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spaces')
        THEN 'Spaces Column'
        ELSE 'Table Missing'
    END as section_title,
    'spaces' as table_name,
    COALESCE(column_name, 'N/A') as column_name,
    COALESCE(data_type, 'N/A') as data_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spaces')
        THEN '❌ SPACES TABLE DOES NOT EXIST'
        WHEN is_nullable = 'YES' THEN 'NULLABLE'
        ELSE 'NOT NULL'
    END || 
    CASE 
        WHEN column_default IS NOT NULL THEN ' (DEFAULT: ' || column_default || ')'
        ELSE ''
    END as details
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'spaces'
ORDER BY ordinal_position
UNION ALL
SELECT '', '', '', '', ''

-- Section 8: Foreign Key Relationships
UNION ALL
SELECT 'FOREIGN KEY RELATIONSHIPS' as section_title, '', '', '', ''
UNION ALL
SELECT '==========================', '', '', '', ''
UNION ALL
SELECT 
    'Foreign Key' as section_title,
    tc.table_name,
    kcu.column_name,
    ccu.table_name as data_type,
    'REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ')' as details
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('documents', 'categories', 'user_api_keys', 'spaces')
UNION ALL
SELECT '', '', '', '', ''

-- Section 9: Unique Constraints
UNION ALL
SELECT 'UNIQUE CONSTRAINTS' as section_title, '', '', '', ''
UNION ALL
SELECT '==================', '', '', '', ''
UNION ALL
SELECT 
    'Unique Constraint' as section_title,
    tc.table_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as column_name,
    tc.constraint_name as data_type,
    'UNIQUE CONSTRAINT' as details
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('documents', 'categories', 'user_api_keys', 'spaces')
GROUP BY tc.table_name, tc.constraint_name
UNION ALL
SELECT '', '', '', '', ''

-- Section 10: Row Level Security Status
UNION ALL
SELECT 'ROW LEVEL SECURITY STATUS' as section_title, '', '', '', ''
UNION ALL
SELECT '==========================', '', '', '', ''
UNION ALL
SELECT 
    'RLS Status' as section_title,
    tablename as table_name,
    '' as column_name,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as data_type,
    CASE 
        WHEN rowsecurity AND tablename IN ('documents', 'categories', 'user_api_keys', 'spaces') 
        THEN '✅ RLS Properly Enabled'
        WHEN NOT rowsecurity AND tablename IN ('documents', 'categories', 'user_api_keys', 'spaces')
        THEN '⚠️ RLS Should Be Enabled'
        WHEN rowsecurity AND tablename = 'users' AND schemaname = 'auth'
        THEN '❌ RLS Should NOT Be Enabled on auth.users'
        ELSE 'INFO: ' || schemaname || '.' || tablename
    END as details
FROM pg_tables 
WHERE (schemaname = 'public' AND tablename IN ('documents', 'categories', 'user_api_keys', 'spaces'))
   OR (schemaname = 'auth' AND tablename = 'users')
UNION ALL
SELECT '', '', '', '', ''

-- Section 11: Policies Overview
UNION ALL
SELECT 'SECURITY POLICIES' as section_title, '', '', '', ''
UNION ALL
SELECT '=================', '', '', '', ''
UNION ALL
SELECT 
    'Policy' as section_title,
    tablename as table_name,
    policyname as column_name,
    cmd as data_type,
    'Policy: ' || policyname as details
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('documents', 'categories', 'user_api_keys', 'spaces')
UNION ALL
SELECT '', '', '', '', ''

-- Section 12: Indexes
UNION ALL
SELECT 'DATABASE INDEXES' as section_title, '', '', '', ''
UNION ALL
SELECT '================', '', '', '', ''
UNION ALL
SELECT 
    'Index' as section_title,
    t.relname as table_name,
    i.relname as column_name,
    CASE WHEN ix.indisunique THEN 'UNIQUE' ELSE 'REGULAR' END as data_type,
    pg_get_indexdef(ix.indexrelid) as details
FROM pg_class t,
     pg_class i,
     pg_index ix,
     pg_attribute a
WHERE t.oid = ix.indrelid
    AND i.oid = ix.indexrelid
    AND a.attrelid = t.oid
    AND a.attnum = ANY(ix.indkey)
    AND t.relkind = 'r'
    AND t.relname IN ('documents', 'categories', 'user_api_keys', 'spaces')
    AND i.relname NOT LIKE '%_pkey'  -- Exclude primary keys for brevity
GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
UNION ALL
SELECT '', '', '', '', ''

-- Section 13: Functions and Triggers
UNION ALL
SELECT 'CUSTOM FUNCTIONS & TRIGGERS' as section_title, '', '', '', ''
UNION ALL
SELECT '===========================', '', '', '', ''
UNION ALL
SELECT 
    'Function' as section_title,
    routine_name as table_name,
    routine_type as column_name,
    data_type as data_type,
    'Custom function found' as details
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_name LIKE '%update%' OR routine_name LIKE '%space%' OR routine_name LIKE '%default%'
UNION ALL
SELECT 
    'Trigger' as section_title,
    event_object_table as table_name,
    trigger_name as column_name,
    'TRIGGER' as data_type,
    'Trigger on ' || event_object_table as details
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
    AND event_object_table IN ('documents', 'categories', 'user_api_keys', 'spaces')
UNION ALL
SELECT '', '', '', '', ''

-- Section 14: Sample Data Counts
UNION ALL
SELECT 'DATA COUNTS' as section_title, '', '', '', ''
UNION ALL
SELECT '===========', '', '', '', ''
UNION ALL
SELECT 
    'Record Count' as section_title,
    'documents' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents')
        THEN (SELECT COUNT(*)::text || ' records' FROM public.documents)
        ELSE 'Table does not exist'
    END as details
UNION ALL
SELECT 
    'Record Count' as section_title,
    'categories' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories')
        THEN (SELECT COUNT(*)::text || ' records' FROM public.categories)
        ELSE 'Table does not exist'
    END as details
UNION ALL
SELECT 
    'Record Count' as section_title,
    'user_api_keys' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_api_keys')
        THEN (SELECT COUNT(*)::text || ' records' FROM public.user_api_keys)
        ELSE 'Table does not exist'
    END as details
UNION ALL
SELECT 
    'Record Count' as section_title,
    'spaces' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spaces')
        THEN (SELECT COUNT(*)::text || ' records' FROM public.spaces)
        ELSE 'Table does not exist'
    END as details
UNION ALL
SELECT '', '', '', '', ''

-- Section 15: Potential Issues Summary
UNION ALL
SELECT 'POTENTIAL ISSUES DETECTED' as section_title, '', '', '', ''
UNION ALL
SELECT '==========================', '', '', '', ''
UNION ALL
SELECT 
    'Issue Check' as section_title,
    'Missing Tables' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents')
        THEN '❌ documents table missing'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories')
        THEN '❌ categories table missing'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_api_keys')
        THEN '❌ user_api_keys table missing'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spaces')
        THEN '⚠️ spaces table missing (may be intentional)'
        ELSE '✅ All core tables present'
    END as details
UNION ALL
SELECT 
    'Issue Check' as section_title,
    'RLS Problems' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'auth' AND tablename = 'users' AND rowsecurity = true
        )
        THEN '❌ CRITICAL: RLS enabled on auth.users (causes signup errors)'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
                AND tablename IN ('documents', 'categories', 'user_api_keys') 
                AND rowsecurity = true
        )
        THEN '⚠️ RLS not enabled on custom tables'
        ELSE '✅ RLS configuration looks correct'
    END as details
UNION ALL
SELECT 
    'Issue Check' as section_title,
    'Space Support' as table_name,
    '' as column_name,
    '' as data_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spaces')
        THEN '⚠️ No spaces table - workspace functionality unavailable'
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'space_id'
        )
        THEN '⚠️ Documents table missing space_id column'
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'space_id'
        )
        THEN '⚠️ Categories table missing space_id column'
        ELSE '✅ Spaces functionality properly configured'
    END as details

-- Section 16: Final Summary
UNION ALL
SELECT '', '', '', '', ''
UNION ALL
SELECT 'DIAGNOSTIC COMPLETE' as section_title, '', '', '', ''
UNION ALL
SELECT '===================', '', '', '', ''
UNION ALL
SELECT 
    'Summary' as section_title,
    'Database Status' as table_name,
    '' as column_name,
    '' as data_type,
    'Diagnostic script execution completed. Review results above for any issues.' as details

ORDER BY section_title, table_name, column_name;

