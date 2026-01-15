# Backend Context

> **Load this file when working on:** Database, RLS policies, Edge Functions, migrations, Supabase queries, authentication logic.

---

## Database Schema

### Tables Overview

```
public schema:
├── topics              (available categories)
├── items               (all items across topics)
├── profiles            (user profiles)
├── user_ratings        (user's rated items - preferables)
├── user_todo_lists     (per-topic watchlists)
├── ai_enrichment_queue (pending AI enrichment requests)
├── user_enrichment_requests (rate limiting and audit)
└── app_config          (feature flags)
```

All tables have Row Level Security (RLS) enabled.

### Table: `topics`

```sql
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,  -- emoji
    image_url TEXT,  -- topic cover image
    schema_template JSONB,  -- expected metadata fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Current topics:** Movies, Series, Books, Anime, Games, Restaurants

### Table: `items`

```sql
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    metadata JSONB,  -- flexible: year, director, author, genre, etc.
    image_url TEXT,
    source TEXT DEFAULT 'seed',  -- 'seed' | 'ai_generated' | 'user'
    ai_confidence DECIMAL(3,2),
    review_pending BOOLEAN DEFAULT FALSE,  -- moderation queue
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(topic_id, slug)
);
```

**Metadata examples by topic:**
- Movies: `{ genre, director, year, runtime, cast }`
- Books: `{ author, genre, year, pages, isbn }`
- Games: `{ platform, genre, developer, year }`
- Restaurants: `{ cuisine, location, price_range }`

### Table: `user_ratings`

```sql
CREATE TABLE user_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);
```

### Table: `profiles`

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup via trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Table: `user_todo_lists`

```sql
CREATE TABLE user_todo_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id),
    priority INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);
```

---

## Row Level Security (RLS)

### RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| topics | Anyone | - | - | - |
| items | Anyone | Authenticated | - | - |
| profiles | Public or own | Auto-trigger | Owner only | - |
| user_ratings | Owner only | Owner only | Owner only | Owner only |
| user_todo_lists | Owner only | Owner only | Owner only | Owner only |

### Key RLS Patterns

```sql
-- Users can only view their own ratings
CREATE POLICY "Users can view own ratings" ON user_ratings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can only modify their own data
CREATE POLICY "Users can update own ratings" ON user_ratings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### RLS Testing Checklist

After any RLS change, verify:
1. Unauthenticated users see only public data
2. Authenticated users see only their own private data
3. Users cannot modify other users' data

```sql
-- Test as anonymous
SET LOCAL ROLE anon;
SELECT * FROM user_ratings; -- Should return 0 rows

-- Test as authenticated user
SET LOCAL request.jwt.claims = '{"sub": "user-123"}';
SELECT * FROM user_ratings; -- Should return only user-123's ratings
```

---

## Database Functions

### `get_items_with_stats()`

Server-side filtering with rating statistics.

```sql
SELECT * FROM get_items_with_stats(
    p_topic_id := 'uuid-here',
    p_search_query := 'matrix',
    p_min_avg_rating := 4.0,
    p_released_after := '2020-01-01',
    p_limit := 24,
    p_offset := 0
);
```

### `get_user_ratings_for_items()`

Batch fetch user ratings for multiple items.

```sql
SELECT * FROM get_user_ratings_for_items(
    p_user_id := 'user-uuid',
    p_item_ids := ARRAY['item-1', 'item-2']::UUID[]
);
```

### `check_enrichment_rate_limit()`

Check daily quota for AI enrichment requests.

```sql
SELECT * FROM check_enrichment_rate_limit('user-uuid');
-- Returns: allowed (boolean), remaining (integer), reset_at (timestamp)
```

---

## Edge Functions

### Current Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `ai-enrich-item` | AI-powered item enrichment | JWT required |

### Edge Function Structure

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  try {
    // 1. Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Manual authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401
      })
    }

    // 3. Create Supabase client and verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401
      })
    }

    // 4. Business logic
    const body = await req.json()
    // ... implementation

    // 5. Return response
    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500
    })
  }
})
```

### Deployment

Edge Functions are deployed via Supabase MCP tools:

```typescript
mcp__supabase__deploy_edge_function({
  name: 'function-name',
  files: [{ name: 'index.ts', content: '...' }],
  verify_jwt: false  // Manual auth handling
})
```

**Important:** Use `verify_jwt: false` and implement manual auth for better error handling.

---

## Migrations

### Location

Migrations are version-controlled in `supabase/migrations/`.

### Naming Convention

```
YYYYMMDDHHMMSS_description_in_snake_case.sql
```

Examples:
- `20260101000001_create_user_todo_lists.sql`
- `20260111000001_add_review_pending_to_items.sql`

### Apply Migrations

```bash
# Via Supabase CLI
supabase db push

# Via MCP
mcp__supabase__apply_migration({
  name: 'add_new_feature',
  query: 'ALTER TABLE items ADD COLUMN new_field TEXT;'
})
```

### Verify Applied Migrations

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

---

## Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `topic-images` | Topic cover images | Public read |
| `item-images` | Item posters/covers | Public read |

### Image Naming Convention

- Topics: `{slug}.png` (e.g., `movies.png`)
- Items: `{topic-slug}/{item-slug}.webp` (e.g., `movies/the-matrix.webp`)

### Storage URLs

```typescript
// Get public URL
const url = supabase.storage
  .from('item-images')
  .getPublicUrl('movies/the-matrix.webp')
```

---

## Secrets Management

**Never commit:**
- `.env` files with real values
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `TAVILY_API_KEY`

**Edge Function secrets:** Set via Supabase Dashboard only.

**Safe for frontend (public):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (protected by RLS)

---

## Common Queries

### Fetch items with stats

```typescript
const { data } = await supabase
  .rpc('get_items_with_stats', {
    p_topic_id: topicId,
    p_search_query: searchQuery,
    p_limit: 24,
    p_offset: 0
  })
```

### Upsert user rating

```typescript
const { data, error } = await supabase
  .from('user_ratings')
  .upsert({
    user_id: userId,
    item_id: itemId,
    rating: rating
  }, { onConflict: 'user_id,item_id' })
```

### Batch fetch user ratings

```typescript
const { data } = await supabase
  .rpc('get_user_ratings_for_items', {
    p_user_id: userId,
    p_item_ids: itemIds
  })
```

---

## Security Checklist

Before committing backend changes:

- [ ] RLS policies cover new tables/columns
- [ ] No secrets in code
- [ ] Input validated and sanitized
- [ ] Error messages don't leak sensitive info
- [ ] Tested as anonymous and authenticated users
- [ ] Service role key not used in frontend

---

**See also:**
- Full architecture: `docs/ARCHITECTURE.md`
- Security standards: `docs/DEVELOPMENT_GUIDELINES.md`
