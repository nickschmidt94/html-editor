# Fix for "Database Error" During Sign Up

## The Problem
You're experiencing a "database error" when trying to sign up new users. This is a **very common issue** with Supabase setups, typically caused by Row Level Security (RLS) being incorrectly enabled on the `auth.users` table.

## Why This Happens
- The `auth.users` table is managed internally by Supabase
- When RLS is enabled on this table, it prevents Supabase from creating new user records
- This results in a generic "database error" during signup

## The Solution

### Step 1: Run the SQL Fix
1. Go to your **Supabase Dashboard** 
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy and paste the contents of `FIX_SUPABASE_DATABASE_ERROR.sql`
5. Click **"Run"**

### Step 2: Verify Your Configuration
Your Supabase credentials are already configured in the code:
- URL: `https://tpeotxhvlhijpboqtxzr.supabase.co` ✅
- API Key: Configured ✅

### Step 3: Test the Fix
1. Open your HTML editor in a browser
2. Click "Sign In" → "Sign Up" tab
3. Try creating a new account
4. You should now see either:
   - Success message with email confirmation prompt
   - Immediate sign-in (if email confirmation is disabled)

## What the Fix Does

1. **Disables RLS on auth.users** - This is the key fix
2. **Ensures your custom tables have proper RLS** - Security is maintained
3. **Recreates all necessary policies** - Proper access control
4. **Verifies table existence** - Creates missing tables if needed
5. **Adds performance indexes** - Better query performance

## Expected Behavior After Fix

### If Email Confirmation is Enabled (Default):
- User signs up → "Check your email" message
- User clicks email link → Can sign in normally

### If Email Confirmation is Disabled:
- User signs up → Immediately signed in

## Common Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|--------|----------|
| "Database error" | RLS on auth.users | Run the SQL fix |
| "Email not confirmed" | User hasn't clicked email link | Guide user to check email |
| "Invalid login credentials" | Wrong email/password | Check credentials |
| "User already exists" | Email already registered | Use sign in instead |

## Additional Troubleshooting

### Check Email Confirmation Settings
1. Go to **Authentication** → **Settings** in Supabase
2. Look for "Confirm Email" setting
3. If enabled, users must confirm email before signing in

### Check Browser Console
If issues persist:
1. Open browser Developer Tools (F12)
2. Check Console tab for error messages
3. Look for network errors in Network tab

### Fallback: Demo Mode
If Supabase is still having issues, users can click "Try Demo Mode" to use local storage instead.

## Security Note
This fix maintains security by:
- ✅ Keeping RLS enabled on YOUR custom tables
- ✅ Maintaining proper user isolation policies  
- ✅ Only disabling RLS on the system-managed auth.users table

Your user data remains secure and isolated per user.

## Support
If you still experience issues after running the fix:
1. Check the browser console for specific error messages
2. Verify the SQL fix ran successfully (should show "Setup completed successfully!")
3. Test with a fresh email address that hasn't been used before
4. Consider temporarily disabling email confirmation for testing
