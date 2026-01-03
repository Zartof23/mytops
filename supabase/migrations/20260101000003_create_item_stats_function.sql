-- Migration: Create get_items_with_stats function for server-side filtering
-- This function returns items with computed avg_rating and rating_count,
-- enabling server-side filtering by rating and release date

CREATE OR REPLACE FUNCTION public.get_items_with_stats(
    p_topic_id UUID,
    p_search_query TEXT DEFAULT NULL,
    p_min_avg_rating NUMERIC DEFAULT NULL,
    p_released_after DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    topic_id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    metadata JSONB,
    image_url TEXT,
    source TEXT,
    ai_confidence NUMERIC,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    avg_rating NUMERIC,
    rating_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.topic_id,
        i.name,
        i.slug,
        i.description,
        i.metadata,
        i.image_url,
        i.source::TEXT,
        i.ai_confidence,
        i.created_by,
        i.created_at,
        i.updated_at,
        COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
        COUNT(r.id)::bigint AS rating_count
    FROM public.items i
    LEFT JOIN public.user_ratings r ON r.item_id = i.id
    WHERE i.topic_id = p_topic_id
      -- Search by name (case-insensitive)
      AND (p_search_query IS NULL OR i.name ILIKE '%' || p_search_query || '%')
      -- Filter by release date from metadata
      AND (
          p_released_after IS NULL
          OR (i.metadata->>'release_date')::date >= p_released_after
          OR (i.metadata->>'year')::int >= EXTRACT(YEAR FROM p_released_after)::int
      )
    GROUP BY i.id
    -- Filter by minimum average rating (only items with ratings)
    HAVING (
        p_min_avg_rating IS NULL
        OR (COUNT(r.id) > 0 AND COALESCE(AVG(r.rating), 0) >= p_min_avg_rating)
    )
    ORDER BY i.name
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_items_with_stats TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_items_with_stats IS 'Get items with computed stats, supporting server-side filtering by rating and release date';


-- Create a separate function to get total count for pagination
CREATE OR REPLACE FUNCTION public.get_items_with_stats_count(
    p_topic_id UUID,
    p_search_query TEXT DEFAULT NULL,
    p_min_avg_rating NUMERIC DEFAULT NULL,
    p_released_after DATE DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    total_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM (
        SELECT i.id
        FROM public.items i
        LEFT JOIN public.user_ratings r ON r.item_id = i.id
        WHERE i.topic_id = p_topic_id
          AND (p_search_query IS NULL OR i.name ILIKE '%' || p_search_query || '%')
          AND (
              p_released_after IS NULL
              OR (i.metadata->>'release_date')::date >= p_released_after
              OR (i.metadata->>'year')::int >= EXTRACT(YEAR FROM p_released_after)::int
          )
        GROUP BY i.id
        HAVING (
            p_min_avg_rating IS NULL
            OR (COUNT(r.id) > 0 AND COALESCE(AVG(r.rating), 0) >= p_min_avg_rating)
        )
    ) AS filtered_items;

    RETURN total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_items_with_stats_count TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_items_with_stats_count IS 'Get total count of items matching filters for pagination';
