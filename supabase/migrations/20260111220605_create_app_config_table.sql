-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Migration: Create app_config table for application configuration
-- This allows feature flags and dynamic configuration

-- Create the table
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read app_config
CREATE POLICY "Anyone can read app_config"
    ON public.app_config
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- RLS Policy: Only service role can modify (handled by default RLS deny)
-- No INSERT/UPDATE/DELETE policies means only service_role can modify

-- Add comment for documentation
COMMENT ON TABLE public.app_config IS 'Application configuration including feature flags';

-- Initial data: AI enrichment feature flag
INSERT INTO public.app_config (key, value, description) VALUES
    ('ai_enrichment_enabled', '{"enabled": true, "daily_limit": 5}', 'Controls AI enrichment feature availability and daily request limit per user')
ON CONFLICT (key) DO NOTHING;;
