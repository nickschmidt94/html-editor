-- COMPLETE Supabase Setup Script with Spaces Support
-- This fixes the missing spaces functionality in your HTML editor

-- =====================================================
-- 1. CREATE SPACES TABLE (MISSING FROM ORIGINAL SETUP)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- =====================================================
-- 2. UPDATE EXISTING TABLES TO SUPPORT SPACES
-- =====================================================

-- Add space_id to documents table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'space_id') THEN
        ALTER TABLE public.documents ADD COLUMN space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add space_id to categories table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'categories' AND column_name = 'space_id') THEN
        ALTER TABLE public.categories ADD COLUMN space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update categories table constraint to include space_id
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_space_id_name_key UNIQUE(user_id, space_id, name);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY ON SPACES TABLE
-- =====================================================

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREATE POLICIES FOR SPACES TABLE
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own spaces" ON public.spaces;
DROP POLICY IF EXISTS "Users can insert their own spaces" ON public.spaces;
DROP POLICY IF EXISTS "Users can update their own spaces" ON public.spaces;
DROP POLICY IF EXISTS "Users can delete their own spaces" ON public.spaces;

-- Create new policies for spaces
CREATE POLICY "Users can view their own spaces" ON public.spaces
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own spaces" ON public.spaces
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spaces" ON public.spaces
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spaces" ON public.spaces
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. RECREATE EXISTING TABLES WITH CORRECT STRUCTURE
-- =====================================================

-- Ensure documents table exists with all needed columns
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure categories table exists with all needed columns
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT categories_user_id_space_id_name_key UNIQUE(user_id, space_id, name)
);

-- Ensure user_api_keys table exists
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    endpoint_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- =====================================================
-- 6. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =====================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. CREATE/UPDATE POLICIES FOR ALL TABLES
-- =====================================================

-- Documents policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "Users can view their own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

CREATE POLICY "Users can view their own categories" ON public.categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON public.categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON public.categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON public.categories
    FOR DELETE USING (auth.uid() = user_id);

-- User API keys policies
DROP POLICY IF EXISTS "Users can view their own api keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can insert their own api keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can update their own api keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can delete their own api keys" ON public.user_api_keys;

CREATE POLICY "Users can view their own api keys" ON public.user_api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own api keys" ON public.user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own api keys" ON public.user_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own api keys" ON public.user_api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 8. CREATE INDEXES FOR BETTER PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON public.spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_space_id ON public.documents(space_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_space_id ON public.categories(space_id);

-- =====================================================
-- 9. CREATE FUNCTION TO AUTO-CREATE DEFAULT SPACE
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_space_for_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a default "Personal Workspace" for new users
    INSERT INTO public.spaces (user_id, name, description, is_default)
    VALUES (NEW.id, 'Personal Workspace', 'Your default workspace', true)
    ON CONFLICT (user_id, name) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CREATE TRIGGER TO AUTO-CREATE DEFAULT SPACE
-- =====================================================

DROP TRIGGER IF EXISTS create_default_space_trigger ON auth.users;
CREATE TRIGGER create_default_space_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_space_for_user();

-- =====================================================
-- 11. VERIFICATION QUERIES
-- =====================================================

-- Check that all tables exist
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('spaces', 'documents', 'categories', 'user_api_keys')
ORDER BY table_name;

-- Check that RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('spaces', 'documents', 'categories', 'user_api_keys')
ORDER BY tablename;

-- Success message
SELECT 'Database setup completed successfully! Your HTML editor now supports spaces in the cloud.' as message;
