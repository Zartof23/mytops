-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- ============================================
-- mytops Initial Topics Seed Data
-- Created: 2025-12-28
-- ============================================

INSERT INTO topics (name, slug, description, icon, schema_template) VALUES
(
    'Movies',
    'movies',
    'Films and cinema from all genres and eras',
    '🎬',
    '{"fields": ["year", "director", "genre", "runtime", "cast"]}'::jsonb
),
(
    'Series',
    'series',
    'TV shows, streaming series, and episodic content',
    '📺',
    '{"fields": ["year", "seasons", "genre", "network", "cast"]}'::jsonb
),
(
    'Books',
    'books',
    'Novels, non-fiction, and literary works',
    '📚',
    '{"fields": ["author", "year", "genre", "pages", "isbn"]}'::jsonb
),
(
    'Anime',
    'anime',
    'Japanese animation series and films',
    '🎌',
    '{"fields": ["year", "studio", "genre", "episodes", "type"]}'::jsonb
),
(
    'Games',
    'games',
    'Video games across all platforms',
    '🎮',
    '{"fields": ["year", "developer", "publisher", "genre", "platforms"]}'::jsonb
),
(
    'Restaurants',
    'restaurants',
    'Dining establishments and eateries',
    '🍽️',
    '{"fields": ["cuisine", "location", "price_range", "style"]}'::jsonb
);;
