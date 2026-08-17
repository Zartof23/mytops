# Backend Context

> **Load this file when working on:** Database, RLS policies, Edge Functions, migrations, Supabase queries, authentication logic.

---

## Database Schema

### Tables Overview

```
public schema:
├── topics              (available categories)
├── items               (all items across topics)
├── profiles            (user profiles; includes is_admin)
├── user_ratings        (user's rated items - preferables)
├── user_todo_lists     (per-topic watchlists)
├── ai_enrichment_queue (pending AI enrichment requests)
├── user_enrichment_requests (rate limiting and audit)
├── app_config          (feature flags)
├── item_flags          (user-submitted "something's wrong with this item" reports)
├── admin_rescan_proposals (stored re-scan proposals, consumed by admin-rescan-item's apply endpoint)
└── admin_audit_log     (append-only record of admin actions; RLS: admin SELECT only, no INSERT/UPDATE/DELETE policies for anyone — only security definer functions can write it)
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
| profiles | Public or own | Auto-trigger | Owner only, `with check` blocks self-promotion to `is_admin` | - |
| user_ratings | Owner only | Owner only | Owner only | Owner only |
| user_todo_lists | Owner only | Owner only | Owner only | Owner only |
| item_flags | Owner or admin | Owner (one open flag per user/item) | Admin only | - |
| admin_audit_log | Admin only | - | - | - |

### `is_admin()` — the canonical authorization check

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
```

Use `is_admin()` in every new admin-only RLS policy (`using (public.is_admin())`) and at the top of every
new admin-only RPC or Edge Function check — never re-derive admin status by inlining a `profiles` lookup.
It is `security definer` with a pinned `search_path` so it can read `profiles` regardless of the caller's
RLS visibility into that table, and so a caller-controlled `search_path` can't redirect it to a
same-named function in another schema. `EXECUTE` on `is_admin`, `admin_item_links`, and `admin_delete_item`
is revoked from `anon` — an authenticated non-admin still reaches the in-function check and gets `42501`,
but an unauthenticated caller can't invoke a hard-delete RPC at all.

### `item_flags` RLS

- SELECT: a user sees their own flags (`user_id = auth.uid()`); an admin (`is_admin()`) sees all.
- INSERT: `auth.uid() = user_id` only. A partial unique index (`item_flags_one_open_per_user`, `where
  status = 'open'`) allows at most one open flag per `(user_id, item_id)` — a second flag on the same item
  raises `23505` until the first is resolved, then a new one can be filed.
- UPDATE: admins only (resolving a flag: `status`, `resolved_by`, `resolved_at`).
- DELETE: no policy for anyone. Flags are removed only as a side effect of `admin_delete_item`'s cascade.

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

### Server-managed state on user-owned tables

Some columns on a user-owned table (e.g. `user_enrichment_requests.status`) are not the user's data to
write — they are bookkeeping the server maintains on the user's behalf. Do **not** add an UPDATE policy
granting the user write access to that column just to unblock an Edge Function. `user_enrichment_requests`
has INSERT and SELECT policies only, by design: `check_enrichment_rate_limit` counts non-`failed` requests
against a daily quota, and a user-facing UPDATE would let a user flip their own rows to `status = 'failed'`
and reset it at will.

The correct fix is a service-role client scoped to exactly those writes, inside the Edge Function that
owns the state transition — never a broadened RLS policy. See `ai-enrich-item/index.ts`: the INSERT stays
on the user-scoped client (its policy correctly enforces `auth.uid() = user_id`); every subsequent
`status` UPDATE uses a separate service-role client, and every one of those updates checks and logs its
`error` — an update that matches zero rows returns no error from PostgREST, so silently ignoring it is how
this class of bug hides for months (see CHANGELOG 2026-08-17).

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

### `admin_item_links(uuid)` and `admin_delete_item(uuid, boolean)`

Both `security definer`, both check `is_admin()` first and raise before touching anything else if the
caller isn't an admin, both revoked from `anon`.

```sql
-- Preview what a delete would cascade into
SELECT public.admin_item_links('item-uuid');
-- Returns: { raters: [...], flag_count, todo_count, rating_count }

-- Hard delete; force=false refuses if links exist
SELECT public.admin_delete_item('item-uuid', false);
-- Returns: { deleted: true, links: {...} } on success
```

Error codes:

| Code | Meaning |
|---|---|
| `42501` | Caller is not an admin (`Admin privileges required`) |
| `P0001` | Unforced delete refused because links exist — message names the exact rating/todo counts, e.g. `Item is linked to 1 rating(s) and 0 todo entries. Re-run with force to delete anyway.` |
| `P0002` | Item not found (`Item not found`) |

`admin_delete_item` re-counts links itself, under `select ... for update` on the target row, immediately
before deciding whether to proceed — this closes the TOCTOU window between a client calling
`admin_item_links` for a preview and calling `admin_delete_item` moments later, during which another actor
could have added a rating/todo/flag. It writes one `admin_audit_log` row (actor, action, item snapshot,
link counts) *before* issuing the delete, so the audit trail can never be lost to a failure partway through
the delete itself.

---

## Edge Functions

### Current Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `ai-enrich-item` | AI-powered item enrichment | JWT required |
| `admin-rescan-item` | Admin re-scan: preview and apply an AI re-extraction over an existing item | JWT required + `is_admin()` |

### `admin-rescan-item` — two-endpoint shape

Same function, two paths distinguished by whether the request URL ends in `/apply`:

- **Preview** (`POST /admin-rescan-item`, body `{ item_id }`): re-runs the same extraction pipeline
  `ai-enrich-item` uses (`_shared/extraction.ts`), diffs the result against the current item field-by-field
  (including per-key metadata diffing), and stores the proposal as a row in `admin_rescan_proposals` (item
  id, actor, proposed values, changed-fields list, confidence, sources, an expiry). Returns `{ proposal_id,
  current, proposed, changed_fields, confidence, sources }`. Preview does **not** write to `items` —
  `items.updated_at` is unchanged after a preview — but it is not a no-op read either, since the proposal
  row is a real write. Stale proposals for the same item (past their expiry) are swept on the next preview
  of that item.
- **Apply** (`POST /admin-rescan-item/apply`, body `{ proposal_id, fields }`): loads the stored proposal by
  `proposal_id` — the item id comes from the proposal row, never from the request body, so a client can't
  point a proposal at a different item — and writes only the `fields` the admin selected, filtered against
  the proposal's own `changed_fields` so a client can't apply a field extraction never proposed. **No
  extraction runs during apply**; every written value comes from the stored proposal. Writes an
  `admin_audit_log` row, then deletes the proposal so it can't be replayed. Item's flag status is left
  untouched — resolving a flag is a separate, explicit admin action.
- `404` if the proposal (or, for preview, the item) doesn't exist; `410` if apply is called on an expired
  proposal (`That proposal expired — re-scan and review again`) — the caller re-scans instead of retrying
  blindly against stale data.

Why preview-then-apply instead of a single re-extract-and-overwrite call: AI extraction can be wrong or can
regress a field that was already correct, and applying it unreviewed trades one bad-data problem for
another with nobody checking. Why apply reads the stored proposal instead of re-running extraction: the
Claude tool-use/web-search loop is non-deterministic, so a second extraction at apply time could silently
write a value the admin never saw or approved — defeating the review step — and re-extracting doubled the
Claude/Tavily cost and latency of every applied change for no benefit.

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

### Shared modules: `supabase/functions/_shared/`

`cors.ts`, `slug.ts`, `images.ts`, `extraction.ts` are imported by both `ai-enrich-item` and
`admin-rescan-item` (relative imports, `../_shared/*.ts`). `extraction.ts` holds the Tavily-search +
Claude-tool-use extraction pipeline shared by AI enrichment and admin re-scan — a bug fix or prompt change
there affects both functions' output. When deploying either function via
`mcp__supabase__deploy_edge_function`, the file manifest must include the entrypoint plus all four
`_shared/*.ts` files with names matching their relative import paths (e.g. `_shared/cors.ts`), and the
entrypoint itself goes under `source/` (`source/index.ts`) to match how Supabase lays out an existing
deployed function's files — check `mcp__supabase__get_edge_function` on a sibling function first if the
exact path convention is unclear. Changing shared code means redeploying **both** functions, not just the
one you edited.

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

## Database changes

- `supabase/migrations/` mirrors the remote migration history in `supabase_migrations.schema_migrations`, one file per version. It is the source of truth for rebuilding a local database from scratch.
- Every schema change ships as a new migration file committed to git. Nothing is created only in the Supabase dashboard.
- The fifteen migration files recovered on 2026-08-16 (`20251229001149_initial_schema.sql` through `20260111220735_add_review_pending_to_items.sql`) are already applied in production and must never be re-applied there.

### Foreign key delete rules

| Constraint | On delete |
|---|---|
| `user_ratings_item_id_fkey` | CASCADE |
| `user_todo_lists_item_id_fkey` | CASCADE |
| `user_enrichment_requests_result_item_id_fkey` | SET NULL |

Deleting an item removes its ratings and TODO entries, and nulls `result_item_id` on any enrichment request that produced it. No corrective `alter` is needed for these three.

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
