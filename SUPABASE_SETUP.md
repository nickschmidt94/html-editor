# Supabase Setup Guide for HTML Editor

This guide will help you set up Supabase for cloud storage and sync with your HTML editor.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"New Project"**
3. Sign in/up with GitHub, Google, or email
4. Create a new organization (if needed)
5. Create a new project:
   - **Name**: `html-editor` (or any name you prefer)
   - **Database Password**: Create a strong password
   - **Region**: Choose the closest to your location
6. Wait for the project to be created (takes ~2 minutes)

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## 3. Configure Your Editor

1. Open `editor/editor.js`
2. Find these lines near the top of the `SupabaseDocumentStorage` class:
   ```javascript
   this.supabaseUrl = 'YOUR_SUPABASE_URL';
   this.supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace with your actual values:
   ```javascript
   this.supabaseUrl = 'https://your-project-ref.supabase.co';
   this.supabaseKey = 'your-anon-key-here';
   ```

## 4. Create Database Tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the following SQL:

```sql
-- NOTE: Do NOT enable RLS on auth.users - it's managed by Supabase internally
-- ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY; ← This causes signup errors!

-- Create documents table
CREATE TABLE public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Enable Row Level Security on tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create user_api_keys table for storing AI provider keys
CREATE TABLE public.user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'custom'
    api_key TEXT NOT NULL,
    endpoint_url TEXT, -- For custom providers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Enable Row Level Security on api keys table
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for documents table
CREATE POLICY "Users can view their own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for categories table
CREATE POLICY "Users can view their own categories" ON public.categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON public.categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON public.categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON public.categories
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for user_api_keys table
CREATE POLICY "Users can view their own API keys" ON public.user_api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON public.user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.user_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.user_api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_updated_at ON public.documents(updated_at DESC);
CREATE INDEX idx_categories_user_id ON public.categories(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for documents table
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON public.documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

4. Click **"Run"** to execute the SQL

## 5. Configure Authentication (Optional but Recommended)

1. Go to **Authentication** → **Settings**
2. Configure your preferred sign-in methods:
   - **Email/Password**: Already enabled by default
   - **Social Providers**: Add Google, GitHub, etc. if desired
3. Set up email templates if needed

## 6. Test Your Setup

1. Open your HTML editor in the browser
2. Click the **"Sign In"** button in the top-right
3. Create a new account or sign in
4. Try saving a document
5. Check if it appears in your Supabase dashboard under **Table Editor** → **documents**

## Features You'll Get

✅ **Cloud Storage**: Documents saved to Supabase PostgreSQL  
✅ **User Authentication**: Secure login/signup  
✅ **Real-time Sync**: Changes sync across devices instantly  
✅ **Offline Support**: Works offline, syncs when back online  
✅ **Multi-device Access**: Access your documents from anywhere  
✅ **Data Security**: Row-level security ensures users only see their data  

## Troubleshooting

### "Failed to initialize Supabase"
- Check that your URL and API key are correct
- Ensure you've saved the `editor.js` file after making changes

### "Failed to save document"
- Check browser console for detailed error messages
- Verify database tables were created successfully
- Ensure you're signed in

### "Documents not loading"
- Check Row Level Security policies are in place
- Verify the user is authenticated
- Check browser network tab for API errors

### "Database error saving new user" (500 error)
This error occurs when Row Level Security is incorrectly enabled on the `auth.users` table.

**Fix**: Run this SQL command in your Supabase dashboard:
```sql
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
```

**Prevention**: Never enable RLS on the `auth.users` table - it's managed by Supabase internally.

### Demo Mode Fallback
If Supabase isn't configured or there are connection issues, the editor automatically falls back to "Demo Mode" using localStorage. You can always use the "Try Demo Mode" button to test locally.

## Advanced Configuration

### Custom Domain (Optional)
If you have a custom domain, you can configure it in Supabase settings for a professional setup.

### Backup Strategy
Consider setting up automated backups in Supabase for production use.

### Performance Optimization
- Add more indexes if you have many documents
- Consider implementing pagination for large document collections

## Common Issues & Solutions

### "Users aren't remembered after signup"

**Issue**: When someone signs up, they see a "Check your email" message but then aren't automatically signed in.

**Root Cause**: Supabase requires email confirmation by default. Users must click the confirmation link in their email before they can sign in.

**What the app now does**:
1. Shows clear messaging about email confirmation
2. Provides a "Resend Confirmation Email" option if needed
3. Automatically recognizes when users return after email confirmation
4. Guides users through the process with helpful notifications

**To disable email confirmation** (not recommended for production):
1. Go to Authentication → Settings in your Supabase dashboard
2. Find "Confirm Email" under Email Provider settings
3. Toggle it off

**Best practices**:
- Keep email confirmation enabled for security
- Configure a reliable SMTP provider for email delivery
- Set up proper redirect URLs for email confirmation
- Consider adding email domain validation for common typos

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Supabase project settings
3. Test with a simple sign-up/sign-in flow first
4. Use the demo mode to ensure the basic functionality works

Your HTML editor is now powered by Supabase! 🎉 