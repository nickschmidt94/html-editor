-- Fix Authentication Issues After User Deletion
-- Run this script in your Supabase SQL Editor to clean up orphaned data

-- 1. First, check if there are any orphaned documents (documents without valid users)
SELECT d.* 
FROM public.documents d
LEFT JOIN auth.users u ON d.user_id = u.id
WHERE u.id IS NULL;

-- 2. Delete orphaned documents (if any exist)
DELETE FROM public.documents 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Delete orphaned categories
DELETE FROM public.categories 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 4. Delete orphaned API keys
DELETE FROM public.user_api_keys 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 5. Ensure auth.users table doesn't have RLS enabled (this causes signup issues)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- 6. Check if email exists in auth.identities (might be orphaned)
-- Replace 'your-email@example.com' with your actual email
SELECT * FROM auth.identities WHERE email = 'your-email@example.com';

-- 7. If you find orphaned identities, delete them
-- UNCOMMENT and modify the email address below if needed:
-- DELETE FROM auth.identities WHERE email = 'your-email@example.com';

-- 8. Clear any stuck email confirmations
-- Replace 'your-email@example.com' with your actual email
SELECT * FROM auth.users WHERE email = 'your-email@example.com';

-- 9. If a user exists but is in a bad state, you can delete it completely
-- UNCOMMENT and modify the email address below if needed:
-- DELETE FROM auth.users WHERE email = 'your-email@example.com';

-- 10. Verify the tables are clean
SELECT 'Documents count:' as check_type, COUNT(*) as count FROM public.documents
UNION ALL
SELECT 'Categories count:', COUNT(*) FROM public.categories
UNION ALL
SELECT 'API Keys count:', COUNT(*) FROM public.user_api_keys
UNION ALL
SELECT 'Users count:', COUNT(*) FROM auth.users;

-- After running this script, you should be able to sign up with your email again