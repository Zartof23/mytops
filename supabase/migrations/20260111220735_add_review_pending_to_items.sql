-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Migration: Add review_pending column to items table
-- Flags items that need manual review (AI confidence 0.6-0.8)

-- Add the column
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS review_pending BOOLEAN DEFAULT FALSE;

-- Create index for finding items needing review
CREATE INDEX IF NOT EXISTS idx_items_review_pending
    ON public.items (review_pending)
    WHERE review_pending = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.items.review_pending IS 'True when AI confidence was 0.6-0.8 and item needs manual review';;
