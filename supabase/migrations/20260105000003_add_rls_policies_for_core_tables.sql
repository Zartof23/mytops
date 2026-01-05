-- Add RLS policies for core tables
-- Migration created: 2026-01-05
-- This migration versions all existing RLS policies that were not previously tracked
--
-- NOTE: These policies already exist in the database. This migration is for versioning
-- purposes to ensure they are tracked in source control. If running on a fresh database,
-- these policies will be created. If running on the existing database, they will fail
-- with "policy already exists" errors, which is expected and can be ignored.
--
-- To apply this migration on existing database without errors, use:
-- CREATE POLICY IF NOT EXISTS (PostgreSQL 15+) or manually verify policies don't exist.

-- ============================================================================
-- TOPICS TABLE POLICIES
-- ============================================================================

-- Public read access for topics
CREATE POLICY "Topics are viewable by everyone"
ON public.topics FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- ITEMS TABLE POLICIES
-- ============================================================================

-- Public read access for items
CREATE POLICY "Items are viewable by everyone"
ON public.items FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can create items
CREATE POLICY "Authenticated users can create items"
ON public.items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Creators can update their items
CREATE POLICY "Creators can update their items"
ON public.items FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Public profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- USER_RATINGS TABLE POLICIES
-- ============================================================================

-- Users can view their own ratings
CREATE POLICY "Users can view own ratings"
ON public.user_ratings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Public profile ratings are viewable
CREATE POLICY "Public profile ratings are viewable"
ON public.user_ratings FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = user_ratings.user_id
      AND profiles.is_public = true
  )
);

-- Users can create their own ratings
CREATE POLICY "Users can create own ratings"
ON public.user_ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
ON public.user_ratings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
ON public.user_ratings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- USER_TODO_LISTS TABLE POLICIES
-- ============================================================================

-- Users can manage their own TODO lists (all operations)
CREATE POLICY "Users can manage own todo lists"
ON public.user_todo_lists FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Public profile TODO lists are visible
CREATE POLICY "Public profiles todo lists are visible"
ON public.user_todo_lists FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = user_todo_lists.user_id
      AND profiles.is_public = true
  )
);

-- ============================================================================
-- AI_ENRICHMENT_QUEUE TABLE POLICIES
-- ============================================================================

-- Users can view their own enrichment requests
CREATE POLICY "Users can view own enrichment requests"
ON public.ai_enrichment_queue FOR SELECT
TO authenticated
USING (auth.uid() = requested_by);

-- Authenticated users can create enrichment requests
CREATE POLICY "Authenticated users can create enrichment requests"
ON public.ai_enrichment_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requested_by);
