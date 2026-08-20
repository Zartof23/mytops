-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Migration: Create user_enrichment_requests table for AI enrichment tracking and rate limiting
-- This tracks all AI enrichment requests from users and enforces daily limits

-- Create the table
CREATE TABLE IF NOT EXISTS public.user_enrichment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.user_enrichment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own requests
CREATE POLICY "Users can view own requests"
    ON public.user_enrichment_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own requests
CREATE POLICY "Users can create own requests"
    ON public.user_enrichment_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_enrichment_requests_user_date
    ON public.user_enrichment_requests(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_user_enrichment_requests_status
    ON public.user_enrichment_requests(status) WHERE status = 'pending';

-- Add comment for documentation
COMMENT ON TABLE public.user_enrichment_requests IS 'Tracks AI enrichment requests from users for rate limiting and audit purposes';;
