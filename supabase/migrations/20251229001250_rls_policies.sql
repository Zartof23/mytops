-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- ============================================
-- mytops Row Level Security Policies
-- Created: 2025-12-28
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_enrichment_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TOPICS POLICIES
-- Public read, admin-only write (future)
-- ============================================

-- Anyone can view topics
CREATE POLICY "Topics are viewable by everyone"
ON topics FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================
-- PROFILES POLICIES
-- Owner full access, public profiles viewable
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Public profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable"
ON profiles FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- ITEMS POLICIES
-- Public read, authenticated create
-- ============================================

-- Anyone can view items
CREATE POLICY "Items are viewable by everyone"
ON items FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can create items
CREATE POLICY "Authenticated users can create items"
ON items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Item creators can update their items
CREATE POLICY "Creators can update their items"
ON items FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- ============================================
-- USER_RATINGS POLICIES
-- Owner full access, public visibility based on profile
-- ============================================

-- Users can view their own ratings
CREATE POLICY "Users can view own ratings"
ON user_ratings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ratings from public profiles are viewable
CREATE POLICY "Public profile ratings are viewable"
ON user_ratings FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = user_ratings.user_id
        AND profiles.is_public = true
    )
);

-- Users can create their own ratings
CREATE POLICY "Users can create own ratings"
ON user_ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
ON user_ratings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
ON user_ratings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- AI_ENRICHMENT_QUEUE POLICIES
-- Authenticated users can create requests
-- ============================================

-- Authenticated users can create enrichment requests
CREATE POLICY "Authenticated users can create enrichment requests"
ON ai_enrichment_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requested_by);

-- Users can view their own requests
CREATE POLICY "Users can view own enrichment requests"
ON ai_enrichment_queue FOR SELECT
TO authenticated
USING (auth.uid() = requested_by);;
