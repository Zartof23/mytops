-- Migration: Add image_url column to topics table
-- This allows topics to have stylish background images

-- Add the column
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.topics.image_url IS 'URL to topic background image stored in Supabase storage';

-- Note: Topic images will be uploaded to Supabase storage bucket 'topic-images'
-- and URLs will be updated via a separate data migration or manual update
