-- Defect 2: pin search_path on SECURITY DEFINER functions flagged by the linter
-- (function_search_path_mutable). Body preserved exactly; only proconfig changes.
alter function public.check_enrichment_rate_limit(p_user_id uuid) set search_path = public;
alter function public.update_user_todo_lists_updated_at() set search_path = public;
alter function public.get_items_with_stats(p_topic_id uuid, p_search_query text, p_min_avg_rating numeric, p_released_after date, p_limit integer, p_offset integer) set search_path = public;
alter function public.get_items_with_stats_count(p_topic_id uuid, p_search_query text, p_min_avg_rating numeric, p_released_after date) set search_path = public;
alter function public.get_user_ratings_for_items(p_user_id uuid, p_item_ids uuid[]) set search_path = public;

-- Defect 3: remove the leftover explicit anon EXECUTE grant on the admin RPCs.
-- `revoke all ... from public` (Tasks 1 & 6) removed the PUBLIC grant but not
-- the default anon grant Supabase applies to new public functions. Not currently
-- exploitable (is_admin() fails closed for anon), but there is no reason an
-- unauthenticated caller should be able to invoke these at all.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_item_links(uuid) from anon;
revoke execute on function public.admin_delete_item(uuid, boolean) from anon;
