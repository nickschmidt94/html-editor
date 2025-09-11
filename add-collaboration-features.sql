-- Add Real-time Collaboration Features to HTML Editor
-- Run this in your Supabase SQL Editor

-- 1. Create document sharing table
CREATE TABLE IF NOT EXISTS public.document_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission_level TEXT DEFAULT 'edit' CHECK (permission_level IN ('view', 'edit')),
    is_public BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create real-time collaboration sessions table
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_color TEXT NOT NULL,
    cursor_position JSONB,
    selection_range JSONB,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create document operations table for real-time sync
CREATE TABLE IF NOT EXISTS public.document_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('insert', 'delete', 'retain')),
    position INTEGER NOT NULL,
    content TEXT,
    length INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number BIGSERIAL
);

-- 4. Enable Row Level Security
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_operations ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for document_shares
CREATE POLICY "Users can view shares for their documents" ON public.document_shares
    FOR SELECT USING (
        shared_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = document_shares.document_id 
            AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create shares for their documents" ON public.document_shares
    FOR INSERT WITH CHECK (
        shared_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = document_shares.document_id 
            AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own shares" ON public.document_shares
    FOR UPDATE USING (shared_by = auth.uid());

CREATE POLICY "Users can delete their own shares" ON public.document_shares
    FOR DELETE USING (shared_by = auth.uid());

-- 6. Create RLS policies for collaboration_sessions
CREATE POLICY "Users can view collaboration sessions for accessible documents" ON public.collaboration_sessions
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = collaboration_sessions.document_id 
            AND documents.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.document_shares 
            WHERE document_shares.document_id = collaboration_sessions.document_id
        )
    );

CREATE POLICY "Users can create collaboration sessions" ON public.collaboration_sessions
    FOR INSERT WITH CHECK (true); -- Allow anyone to join if they have access

CREATE POLICY "Users can update their own collaboration sessions" ON public.collaboration_sessions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own collaboration sessions" ON public.collaboration_sessions
    FOR DELETE USING (user_id = auth.uid());

-- 7. Create RLS policies for document_operations
CREATE POLICY "Users can view operations for accessible documents" ON public.document_operations
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = document_operations.document_id 
            AND documents.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.document_shares 
            WHERE document_shares.document_id = document_operations.document_id
        )
    );

CREATE POLICY "Users can create operations for accessible documents" ON public.document_operations
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.documents 
                WHERE documents.id = document_operations.document_id 
                AND documents.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.document_shares 
                WHERE document_shares.document_id = document_operations.document_id
                AND permission_level = 'edit'
            )
        )
    );

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON public.document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON public.document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_document_id ON public.collaboration_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_active ON public.collaboration_sessions(document_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_document_operations_document_id ON public.document_operations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_sequence ON public.document_operations(document_id, sequence_number);

-- 9. Create function to generate share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(16), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to cleanup old collaboration sessions
CREATE OR REPLACE FUNCTION cleanup_old_collaboration_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.collaboration_sessions 
    WHERE last_seen < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_shares_updated_at
    BEFORE UPDATE ON public.document_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Enable realtime for collaboration tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_operations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Collaboration features added successfully!';
    RAISE NOTICE '📋 Tables created: document_shares, collaboration_sessions, document_operations';
    RAISE NOTICE '🔒 RLS policies configured for security';
    RAISE NOTICE '⚡ Realtime enabled for collaboration';
    RAISE NOTICE '🚀 Ready for real-time collaborative editing!';
END $$;
