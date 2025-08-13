# Fixing "must be owner of table users" Error

## The Problem
The error "must be owner of table users" occurs because the original SQL script tries to modify the `auth.users` table, but in Supabase you don't have owner permissions on system tables in the `auth` schema.

## Why This Happens
- The `auth.users` table is a system table managed by Supabase
- Only Supabase itself has owner permissions on this table
- Users cannot directly modify RLS settings on system tables

## The Solution

### Step 1: Use the Fixed SQL Script
1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy and paste the contents of `FIXED_SUPABASE_DATABASE_ERROR.sql`
5. Click **"Run"**

This script will:
- ✅ Check if RLS is enabled on auth.users (for diagnosis)
- ✅ Set up all your custom tables correctly
- ✅ Create proper security policies
- ✅ Skip the problematic auth.users modification

### Step 2: Check the Results
After running the script, look for these messages:
- "Custom tables setup completed successfully!"
- Check if the first query shows `rls_enabled = TRUE` for auth.users

### Step 3: If RLS is Enabled on auth.users
If the diagnostic query shows RLS is enabled on auth.users, you have a few options:

#### Option A: Contact Supabase Support
1. Go to [Supabase Support](https://supabase.com/dashboard/support)
2. Explain that RLS was accidentally enabled on auth.users
3. Ask them to run: `ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;`

#### Option B: Try Authentication Settings
1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Find **"Enable email confirmations"** 
3. Try toggling it OFF temporarily
4. Test signup again

#### Option C: Reset Your Database (Last Resort)
If the project is new and you don't have important data:
1. Go to **Settings** → **Database**
2. Reset your database (this will delete all data!)
3. Run the CORRECTED setup script from your earlier files

### Step 4: Test Signup
1. Open your HTML editor
2. Try signing up with a new email
3. Check for success messages

## Expected Behavior After Fix

### Success Scenarios:
- ✅ "Please check your email and click the confirmation link"
- ✅ Immediate signin (if email confirmation is disabled)
- ✅ User appears in Supabase dashboard under Authentication → Users

### If Still Having Issues:
- Check browser console for specific error messages
- Verify all policies were created successfully
- Try with a completely new email address

## Prevention for Future
- Never run `ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;`
- Only enable RLS on your custom tables (public.documents, etc.)
- Use the CORRECTED setup scripts provided

## Quick Diagnostic Commands

Run these in SQL Editor to check your setup:

```sql
-- Check if auth.users has RLS (should be FALSE)
SELECT rowsecurity FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check your custom tables (should be TRUE)
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('documents', 'categories', 'user_api_keys');

-- List all policies on your tables
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Why This Error is Common
Many tutorials accidentally include the line:
```sql
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;  -- ❌ DON'T DO THIS
```

This line should NEVER be included in Supabase setup scripts because:
- ❌ It breaks user registration
- ❌ Users don't have permission to modify it anyway
- ❌ Supabase manages this table internally

The correct approach is to only enable RLS on YOUR custom tables.
