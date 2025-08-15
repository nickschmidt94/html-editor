# Authentication Troubleshooting Guide

## Problem: "I deleted my user profile and now can't sign up again"

This is a common issue when a user is deleted from Supabase but some authentication data remains in various places. Here's how to fix it:

## Quick Fix Steps

### Step 1: Clear Browser Data
1. Open your browser's Developer Console (F12 or right-click → Inspect)
2. Go to the Console tab
3. Type this command and press Enter:
   ```javascript
   resetAuth()
   ```
4. You should see a message saying "Authentication reset complete"
5. Refresh the page (Ctrl+F5 or Cmd+Shift+R for hard refresh)

### Step 2: Clean Up Supabase Database
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents from `FIX_AUTH_ISSUES.sql` file
5. **IMPORTANT**: Replace `'your-email@example.com'` with your actual email address in the script
6. Run the query
7. Check the output to see if any orphaned data was found

### Step 3: Try Signing Up Again
1. Go back to your application
2. Click "Sign In" button
3. Switch to "Sign Up" tab
4. Enter your email and a new password
5. Complete the signup process

## Detailed Troubleshooting

### Understanding the Issue

When you delete a user from Supabase, several things can go wrong:

1. **Orphaned Auth Records**: The user might be deleted from `auth.users` but identities remain in `auth.identities`
2. **Browser Cache**: Authentication tokens and session data remain in browser storage
3. **Orphaned Data**: Documents, categories, and other user data might remain without a valid user reference
4. **RLS Policies**: Row Level Security might prevent proper cleanup

### Manual Browser Cleanup

If the `resetAuth()` function doesn't work, manually clear:

1. **LocalStorage**:
   - Open Developer Tools (F12)
   - Go to Application/Storage tab
   - Find LocalStorage for your domain
   - Delete all items starting with:
     - `sb-`
     - `supabase`
     - `pendingSignupEmail`

2. **SessionStorage**:
   - In the same Application tab
   - Find SessionStorage
   - Delete all Supabase-related items

3. **Cookies**:
   - In Application → Cookies
   - Delete all cookies starting with `sb-` or containing `supabase`

4. **Alternative Method**:
   - Settings → Privacy → Clear browsing data
   - Select "Cookies and other site data" and "Cached images and files"
   - Choose "Last hour" or "Last 24 hours"
   - Clear data

### Database Cleanup Queries

Run these queries in Supabase SQL Editor to investigate and fix issues:

```sql
-- Check if your email exists in auth.users
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Check for orphaned identities
SELECT * FROM auth.identities 
WHERE email = 'your-email@example.com';

-- If user exists but can't sign in, check email confirmation status
SELECT id, email, email_confirmed_at, confirmation_sent_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Complete user removal (if needed)
-- WARNING: This will permanently delete the user and all associated data
BEGIN;
  -- Delete user data
  DELETE FROM public.documents WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
  DELETE FROM public.categories WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
  DELETE FROM public.user_api_keys WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
  
  -- Delete identities
  DELETE FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
  
  -- Delete user
  DELETE FROM auth.users WHERE email = 'your-email@example.com';
COMMIT;
```

### Common Error Messages and Solutions

#### "User already registered"
- **Cause**: User exists in database but authentication is broken
- **Solution**: Run the complete user removal query above, clear browser data, then sign up again

#### "Database error saving new user"
- **Cause**: RLS is enabled on auth.users table (it shouldn't be)
- **Solution**: Run `ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;`

#### "Email not confirmed"
- **Cause**: Previous signup wasn't confirmed
- **Solution**: 
  1. Try signing up again with the same email (it will resend confirmation)
  2. Or disable email confirmation in Supabase Dashboard → Authentication → Settings

#### "Invalid login credentials"
- **Cause**: User doesn't exist or password is wrong
- **Solution**: Use "Sign Up" instead of "Sign In" if you deleted your account

### Preventing Future Issues

1. **Don't delete users directly from auth.users table**
   - Use Supabase Dashboard → Authentication → Users → Delete user
   - Or use the Admin API for proper user deletion

2. **Use proper cleanup when deleting users**
   - Ensure CASCADE DELETE is set on foreign keys
   - Clear browser data after account deletion

3. **Test in Demo Mode first**
   - Use "Try Demo Mode" button to test without authentication
   - This uses localStorage only and doesn't touch Supabase

### Using Demo Mode as Fallback

If authentication issues persist:
1. Click "Try Demo Mode" in the sign-in modal
2. Your data will be stored locally in the browser
3. You won't need Supabase authentication
4. Note: Data in demo mode is not synced across devices

### Getting More Help

If these steps don't resolve your issue:

1. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Look for red error messages
   - Copy the full error text

2. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs → Auth
   - Look for failed authentication attempts
   - Check the error details

3. **Enable Debug Mode**:
   - In browser console, type: `localStorage.setItem('debug', 'supabase:*')`
   - Refresh the page and try again
   - More detailed logs will appear in console

4. **Contact Support**:
   - Include the error messages from browser console
   - Mention you've already tried the cleanup steps
   - Provide your Supabase project reference

## Prevention Checklist

- [ ] Never enable RLS on `auth.users` table
- [ ] Always use CASCADE DELETE on foreign keys referencing auth.users
- [ ] Clear browser data after deleting accounts
- [ ] Use Supabase Dashboard for user management, not direct SQL
- [ ] Keep email confirmation enabled for security
- [ ] Test authentication flows in demo mode first

## Quick Reference Commands

```javascript
// Browser Console Commands
resetAuth()                    // Clear all auth data
window.documentStorage          // Check storage instance
localStorage.clear()            // Nuclear option - clears everything
```

```sql
-- SQL Commands (replace email)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
DELETE FROM auth.users WHERE email = 'your-email@example.com';
SELECT * FROM auth.users WHERE email = 'your-email@example.com';
```

Remember: The application now has better error handling and will guide you through most issues automatically. The improved error messages will tell you exactly what to do in most cases.