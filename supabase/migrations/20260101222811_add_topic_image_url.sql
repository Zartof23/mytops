-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Migration: Add image_url column to topics table
-- This allows topics to have stylish background images

-- Add the column
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.topics.image_url IS 'URL to topic background image stored in Supabase storage';;
