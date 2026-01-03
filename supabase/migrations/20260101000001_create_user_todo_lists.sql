-- Migration: Create user_todo_lists table for per-topic TODO lists
-- This allows users to save items they want to watch/play/read later

-- Create the table
CREATE TABLE IF NOT EXISTS public.user_todo_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only add an item once
    UNIQUE(user_id, item_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_todo_lists ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own todo lists
CREATE POLICY "Users can manage own todo lists"
    ON public.user_todo_lists
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Public profiles' todo lists are visible to everyone
CREATE POLICY "Public profiles todo lists are visible"
    ON public.user_todo_lists
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = user_todo_lists.user_id
            AND profiles.is_public = true
        )
    );

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_todo_lists_user_id ON public.user_todo_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_todo_lists_user_topic ON public.user_todo_lists(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_user_todo_lists_item_id ON public.user_todo_lists(item_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_user_todo_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_todo_lists_updated_at
    BEFORE UPDATE ON public.user_todo_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_todo_lists_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.user_todo_lists IS 'Per-topic TODO lists for users to track items they want to watch/play/read later';
