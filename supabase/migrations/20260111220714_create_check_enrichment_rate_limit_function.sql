-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Migration: Create function to check user's enrichment rate limit
-- Returns the current request count, daily limit, and whether they can make another request

CREATE OR REPLACE FUNCTION public.check_enrichment_rate_limit(p_user_id UUID)
RETURNS TABLE (
    requests_today INTEGER,
    daily_limit INTEGER,
    can_request BOOLEAN
) AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    -- Get daily limit from app_config
    SELECT (value->>'daily_limit')::INTEGER INTO v_limit
    FROM public.app_config
    WHERE key = 'ai_enrichment_enabled';

    -- Default to 5 if not configured
    v_limit := COALESCE(v_limit, 5);

    -- Count requests today and determine if user can make another request
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as requests_today,
        v_limit as daily_limit,
        COUNT(*) < v_limit as can_request
    FROM public.user_enrichment_requests
    WHERE user_id = p_user_id
        AND created_at >= CURRENT_DATE
        AND status != 'failed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_enrichment_rate_limit IS 'Checks if user has remaining AI enrichment requests for today';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_enrichment_rate_limit(UUID) TO authenticated;;
