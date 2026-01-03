-- Migration: Create get_user_ratings_for_items function for batch fetching
-- This function allows fetching user ratings for multiple items in a single query,
-- optimizing the search results page to avoid N+1 queries

CREATE OR REPLACE FUNCTION public.get_user_ratings_for_items(
    p_user_id UUID,
    p_item_ids UUID[]
)
RETURNS TABLE (
    item_id UUID,
    rating INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.item_id, r.rating
    FROM public.user_ratings r
    WHERE r.user_id = p_user_id
      AND r.item_id = ANY(p_item_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_user_ratings_for_items TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_ratings_for_items IS 'Batch fetch user ratings for multiple items to avoid N+1 queries';
