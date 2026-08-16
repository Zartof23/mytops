# Item Flags & Admin Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users flag an item for incorrect information, and let admins work a flag queue where they can hard-delete a bad import or re-scan an item's metadata from the web.

**Architecture:** Admin identity is a single `profiles.is_admin` boolean read through a `security definer` SQL helper that every RLS policy and admin RPC calls. Destructive and privileged operations live server-side — `admin_delete_item` re-counts links before deleting so the UI cannot bypass the warning, and re-scan is a two-call Edge Function (preview, then apply selected fields) so AI output never lands in the database unreviewed. The frontend adds a `/admin` page plus a flag modal, reusing existing shadcn primitives and the established service-layer pattern.

**Tech Stack:** Supabase (PostgreSQL + RLS + Edge Functions on Deno), React 19, TypeScript, Zustand, Tailwind + shadcn/ui, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-16-item-flags-and-admin-tools-design.md`

## Global Constraints

- All work happens on branch `feat/item-flags-and-admin-tools`.
- Frontend commands run from `frontend/`: `npm test -- --run`, `npm run build`.
- **Applying a migration:** use the Supabase MCP tool `mcp__supabase__apply_migration` with the snake_case name given in the task (e.g. `add_is_admin_to_profiles`). It assigns the version timestamp and records the SQL in the remote history. Then save the identical SQL to `supabase/migrations/<assigned_version>_<name>.sql` — confirm the assigned version with `mcp__supabase__list_migrations` and use it verbatim, so git and the remote history stay one-to-one (the invariant Task 0 establishes). The `20260816NNNNNN` filenames in later tasks are placeholders for ordering; the real filename is whatever version the tool assigns.
- Never apply DDL with `mcp__supabase__execute_sql` — it bypasses the migration history, which is exactly the drift Task 0 exists to clean up. Use `execute_sql` only for reads and verification queries.
- **Everything that lives in Supabase must live in git.** No schema change, function, policy, or trigger may be created only in the dashboard SQL editor. After Task 0, `supabase/migrations/` must be able to rebuild the whole database on its own, one file per remote migration version; any task that breaks that has to fix it before committing. Edge Functions likewise live under `supabase/functions/` before they are deployed.
- Every new table has `alter table ... enable row level security` and explicit policies. No table ships without RLS.
- Every `security definer` function sets `set search_path = public`. This is not optional — without it a `security definer` function is exploitable via search_path manipulation.
- Services follow the existing pattern in `frontend/src/services/`: an exported object literal of async methods, importing `supabase` from `../lib/supabase`. Methods that the UI must branch on return `{ data, error }`; methods that are fire-and-forget may throw (see `enrichmentService` for the throwing style).
- Service tests mock `../lib/supabase` with `vi.mock` exactly as `frontend/src/services/ratingService.test.ts` does.
- Component tests import `render` from `@/test/utils` (not from `@testing-library/react` directly) so the Router and Tooltip providers are present.
- Path alias `@/` maps to `frontend/src/`.
- Brand voice for user-facing copy: minimal, honest, mildly self-deprecating. Example: *"You need to log in for this. I know, I know, another login."*
- The flag reason is bounded at **10–1000 characters** in the DB `CHECK`, and the client must enforce the same 10-character floor.
- The TODO table is named **`user_todo_lists`** (not `user_todo_items`).
- Commit after each task. Conventional-commit prefixes (`feat:`, `test:`, `refactor:`, `docs:`).

---

## File Structure

**Migrations (create):**
- `supabase/migrations/20260816000000_remote_baseline_schema.sql` — snapshot of the untracked existing schema, so the repo alone can rebuild the database.
- `supabase/migrations/20260816000001_add_is_admin_to_profiles.sql` — column, `is_admin()` helper, self-promotion guard.
- `supabase/migrations/20260816000002_create_item_flags.sql` — table, indexes, RLS.
- `supabase/migrations/20260816000003_create_admin_item_functions.sql` — audit log table, `admin_item_links`, `admin_delete_item`.

**Edge Functions:**
- Create `supabase/functions/_shared/cors.ts`, `slug.ts`, `images.ts`, `extraction.ts` — logic shared by both enrichment functions.
- Modify `supabase/functions/ai-enrich-item/index.ts` — import from `_shared` instead of defining locally.
- Create `supabase/functions/admin-rescan-item/index.ts` — preview + apply endpoints.

**Services (create):**
- `frontend/src/services/flagService.ts` — user-facing flag create/read + admin list/resolve.
- `frontend/src/services/adminService.ts` — `admin_item_links` / `admin_delete_item` RPC wrappers and the re-scan function calls.

**Components (create):**
- `frontend/src/components/FlagItemModal.tsx` — the report dialog.
- `frontend/src/components/admin/DeleteItemDialog.tsx` — link warning + typed confirmation.
- `frontend/src/components/admin/RescanDiff.tsx` — before/after field picker.
- `frontend/src/components/admin/AdminItemActions.tsx` — the shared re-scan/delete button pair, mounted in both the queue and the item modal.
- `frontend/src/pages/AdminPage.tsx` — the flag queue.

**Modify:**
- `frontend/src/store/authStore.ts` — load the profile, expose `isAdmin`.
- `frontend/src/components/RouteGuards.tsx` — add `AdminRoute`.
- `frontend/src/components/ItemDetailModal.tsx` — flag button + admin actions.
- `frontend/src/App.tsx` — `/admin` route.
- `frontend/src/types/index.ts` — new shared types.
- `docs/CHANGELOG.md`, `docs/context/BACKEND_CONTEXT.md`, `docs/context/FRONTEND_CONTEXT.md`.

**Docs (create):**
- `docs/admin-sql-verification.md` — runnable `psql` checks for the SQL that has no automated test.

---

### Task 0: Recover the real migration history into git

**Files:**
- Create: fifteen files in `supabase/migrations/`, one per remote migration, named `<version>_<name>.sql`
- Delete: the seven existing files in `supabase/migrations/` (superseded — see Step 3)
- Modify: `docs/context/BACKEND_CONTEXT.md`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `supabase/migrations/` matching the remote `supabase_migrations.schema_migrations` history exactly, so a fresh local database can be rebuilt from the repo alone.

**Context — read before starting.** The remote database has a proper 15-migration history. It was applied through the Supabase MCP tooling, which records each migration's full SQL in `supabase_migrations.schema_migrations.statements`. The local `supabase/migrations/` directory holds only seven files, with **different version numbers** than the remote history, and one file that was never applied at all. So the fix is not a schema dump — it is recovering the authoritative SQL that already exists, which preserves the comments, ordering, and intent that a dump would flatten.

Use the Supabase MCP tools (`mcp__supabase__execute_sql`) for all reads in this task. Do not install or run the Supabase CLI here.

The remote history, in order:

| Version | Name |
|---|---|
| 20251229001149 | initial_schema |
| 20251229001250 | rls_policies |
| 20251229001313 | seed_topics |
| 20251229001459 | fix_function_search_path |
| 20251229103549 | seed_test_items |
| 20260101222708 | create_user_todo_lists |
| 20260101222811 | add_topic_image_url |
| 20260101222813 | create_item_stats_function |
| 20260101222817 | create_user_ratings_batch_function |
| 20260104185858 | create_storage_buckets_for_images |
| 20260104185916 | add_storage_rls_policies |
| 20260111220605 | create_app_config_table |
| 20260111220629 | create_user_enrichment_requests_table |
| 20260111220714 | create_check_enrichment_rate_limit_function |
| 20260111220735 | add_review_pending_to_items |

- [ ] **Step 1: Read each migration's SQL from the remote history**

For each version in the table above, fetch its statements:

```sql
select array_to_string(statements, E';\n\n') || ';' as sql
from supabase_migrations.schema_migrations
where version = '20251229001149';
```

Fetch them one at a time. Fetching all fifteen in one query produces a single enormous result that is easy to mis-split between files.

- [ ] **Step 2: Write one file per migration**

Write each to `supabase/migrations/<version>_<name>.sql`, using the exact version and name from the table — for example `supabase/migrations/20251229001149_initial_schema.sql`.

Write the SQL exactly as retrieved. Do not reformat it, do not add `if not exists` clauses, and do not "improve" anything: these files must reproduce the database that actually exists. The only permitted addition is a two-line header on each file:

```sql
-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.
```

- [ ] **Step 3: Delete the seven superseded files**

```bash
git rm supabase/migrations/20260101000001_create_user_todo_lists.sql
git rm supabase/migrations/20260101000002_add_topic_image_url.sql
git rm supabase/migrations/20260101000003_create_item_stats_function.sql
git rm supabase/migrations/20260101000004_create_user_ratings_batch_function.sql
git rm supabase/migrations/20260105000001_create_storage_buckets_for_images.sql
git rm supabase/migrations/20260105000002_add_storage_rls_policies.sql
git rm supabase/migrations/20260105000003_add_rls_policies_for_core_tables.sql
```

The first six duplicate remote migrations under invented version numbers — keeping both would apply the same DDL twice on a local rebuild. The seventh (`add_rls_policies_for_core_tables`) has no remote counterpart at all: its own header admits it was written to "version" policies that already existed, and it was never applied. The real policies live in `20251229001250_rls_policies`, which Step 2 recovers. Deleting it removes a file that would fail on a fresh database.

- [ ] **Step 4: Verify the recovered set is complete and ordered**

```bash
ls supabase/migrations/
```

Expect exactly fifteen files, and confirm that sorting them lexically produces the same order as the table above.

Spot-check three against the live database: `20251229001149_initial_schema.sql` must create `topics`, `items`, `profiles`, and `user_ratings`; `20260111220714_create_check_enrichment_rate_limit_function.sql` must define `check_enrichment_rate_limit`; `20260111220735_add_review_pending_to_items.sql` must add the `review_pending` column that `ai-enrich-item/index.ts` writes to.

Confirm no file is empty or truncated — a zero-length file means the Step 1 fetch silently returned nothing for that version.

- [ ] **Step 5: Record the FK delete rules**

These are already established from the live database and are needed by Task 6. Record them in `docs/context/BACKEND_CONTEXT.md` rather than re-deriving them:

| Constraint | On delete |
|---|---|
| `user_ratings_item_id_fkey` | CASCADE |
| `user_todo_lists_item_id_fkey` | CASCADE |
| `user_enrichment_requests_result_item_id_fkey` | SET NULL |

**This resolves Task 6 Step 1: the cascade is already correct and no corrective `alter` is needed.** Deleting an item removes its ratings and TODO entries, and nulls `result_item_id` on any enrichment request that produced it.

- [ ] **Step 6: Document the workflow**

Add a "Database changes" section to `docs/context/BACKEND_CONTEXT.md` recording:

- `supabase/migrations/` mirrors the remote migration history, one file per version, and is the source of truth for rebuilding a local database.
- Every schema change ships as a new migration file committed to git. Nothing is created only in the dashboard.
- The FK table from Step 5.
- That the fifteen recovered files are already applied remotely and must never be re-applied there.

Also add to `.gitignore` if not already present:

```
.superpowers/
supabase/.temp/
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations docs/context/BACKEND_CONTEXT.md .gitignore
git commit -m "chore: recover the full Supabase migration history into git"
```

This task does **not** deploy or apply anything. It only brings git in line with what is already live.

---

### Task 1: Admin flag on profiles

**Files:**
- Create: `supabase/migrations/20260816000001_add_is_admin_to_profiles.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.is_admin() returns boolean` — callable from RLS policies and `security definer` functions. `profiles.is_admin boolean not null default false`.

- [ ] **Step 1: Write the migration**

```sql
-- Add admin flag to profiles and a helper for RLS policies.
-- Migration created: 2026-08-16
-- There is no UI to grant admin. Promote by SQL:
--   update public.profiles set is_admin = true where id = '<user-uuid>';

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- security definer is required: the profiles RLS policies would otherwise
-- block a user from reading the row this function needs.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Prevent self-promotion. WITH CHECK cannot be added to an existing policy,
-- so the policy is dropped and recreated. This policy already exists in
-- production; the drop is intentional.
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
);
```

- [ ] **Step 2: Apply the migration**

Apply with `mcp__supabase__apply_migration`, name `add_is_admin_to_profiles`. Then confirm the assigned version with `mcp__supabase__list_migrations` and rename the local file to `<assigned_version>_add_is_admin_to_profiles.sql`. Verify with `mcp__supabase__execute_sql`:

```sql
select public.is_admin();  -- false for a non-admin session
select column_name from information_schema.columns
  where table_name = 'profiles' and column_name = 'is_admin';  -- 1 row
```

- [ ] **Step 3: Verify the self-promotion guard**

As a normal (non-admin) signed-in user, run:

```sql
update public.profiles set is_admin = true where id = auth.uid();
```

Expected: `new row violates row-level security policy`. If this succeeds, stop — the `with check` clause is wrong and everything downstream is insecure.

- [ ] **Step 4: Promote your own account**

```sql
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'roberto-calo@hotmail.it');
```

This runs as the service role from the dashboard, which bypasses RLS. Confirm with `select is_admin from profiles where ...` returning `true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816000001_add_is_admin_to_profiles.sql
git commit -m "feat: add is_admin flag and is_admin() helper to profiles"
```

---

### Task 2: Expose isAdmin in authStore

**Files:**
- Modify: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/types/index.ts`
- Test: `frontend/src/store/authStore.test.ts` (create)

**Interfaces:**
- Consumes: `profiles.is_admin` from Task 1.
- Produces: `useAuthStore()` gains `profile: Profile | null`, `isAdmin: boolean`, and `profileLoading: boolean`. `Profile` gains `is_admin: boolean`.

**Why `profileLoading` exists:** on page reload the profile is awaited before `initialized` flips, so `isAdmin` is settled. But on a *fresh sign-in* there is no reload — `initialized` is already `true` and the profile arrives asynchronously from the `onAuthStateChange` callback. Without a separate flag, an admin who signs in and goes straight to `/admin` is redirected home because `isAdmin` is still `false`, and only a reload fixes it. `AdminRoute` must wait on `profileLoading`, not on `initialized`.

- [ ] **Step 1: Add `is_admin` to the Profile type**

In `frontend/src/types/index.ts`, inside `interface Profile`, add after `is_public`:

```ts
  is_admin: boolean
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/store/authStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  }
}))

const mockProfileQuery = (profile: unknown) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  vi.mocked(supabase.from).mockReturnValue({ select } as never)
}

const sessionWith = (userId: string) => ({
  data: {
    session: {
      user: { id: userId, email: 'a@b.c', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' },
      access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer'
    }
  },
  error: null
})

describe('authStore isAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, profile: null, isAdmin: false, initialized: false })
  })

  it('sets isAdmin true when the profile is flagged admin', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u1') as never)
    mockProfileQuery({ id: 'u1', is_admin: true, is_public: true })

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(true)
    expect(useAuthStore.getState().profile?.id).toBe('u1')
  })

  it('leaves isAdmin false for a normal profile', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u2') as never)
    mockProfileQuery({ id: 'u2', is_admin: false, is_public: true })

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(false)
  })

  it('leaves isAdmin false when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(false)
    expect(useAuthStore.getState().profile).toBeNull()
  })

  it('holds profileLoading true until a signed-in profile resolves', async () => {
    let resolveProfile: (v: unknown) => void = () => {}
    const maybeSingle = vi.fn(() => new Promise((r) => { resolveProfile = r }))
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    vi.mocked(supabase.from).mockReturnValue({ select } as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u1') as never)

    const done = useAuthStore.getState().initialize()
    await Promise.resolve()
    expect(useAuthStore.getState().profileLoading).toBe(true)

    resolveProfile({ data: { id: 'u1', is_admin: true }, error: null })
    await done

    expect(useAuthStore.getState().profileLoading).toBe(false)
    expect(useAuthStore.getState().isAdmin).toBe(true)
  })

  it('leaves profileLoading false when there is no session to load', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().profileLoading).toBe(false)
  })

  it('clears profile and isAdmin on sign out', async () => {
    useAuthStore.setState({ profile: { id: 'u1', is_admin: true } as never, isAdmin: true })

    await useAuthStore.getState().signOut()

    expect(useAuthStore.getState().isAdmin).toBe(false)
    expect(useAuthStore.getState().profile).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/store/authStore.test.ts`
Expected: FAIL — `isAdmin` is `undefined`, not `false`/`true`.

- [ ] **Step 4: Implement**

In `frontend/src/store/authStore.ts`:

Add to the imports:

```ts
import type { Profile } from '../types'
```

Add to `interface AuthState`, after `user` and `session`:

```ts
  profile: Profile | null
  isAdmin: boolean
  profileLoading: boolean
```

Add a module-level helper above `export const useAuthStore`:

```ts
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile:', error)
    return null
  }
  return (data as Profile) ?? null
}
```

Add to the initial state, next to `user: null`:

```ts
  profile: null,
  isAdmin: false,
  profileLoading: false,
```

In `initialize`, replace the `set({ session, user: ..., initialized: true })` call with:

```ts
      const user = session?.user ?? null
      set({ profileLoading: !!user })
      const profile = user ? await fetchProfile(user.id) : null
      set({
        session,
        user,
        profile,
        isAdmin: profile?.is_admin ?? false,
        profileLoading: false,
        initialized: true
      })
```

Also set `profileLoading: false` in the `catch` block that already sets `initialized: true`, or a failed initialize leaves `AdminRoute` rendering nothing forever.

and replace the body of the `onAuthStateChange` callback with:

```ts
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null
        set({ session, user: nextUser })
        if (!nextUser) {
          set({ profile: null, isAdmin: false, profileLoading: false })
          return
        }
        // Not awaited: awaiting inside this callback deadlocks the client.
        // profileLoading covers the gap so AdminRoute doesn't redirect early.
        set({ profileLoading: true })
        void fetchProfile(nextUser.id).then((profile) => {
          set({ profile, isAdmin: profile?.is_admin ?? false, profileLoading: false })
        })
      })
```

In `signOut`, change the final `set` to:

```ts
    set({ user: null, session: null, profile: null, isAdmin: false, profileLoading: false })
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/store/authStore.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the full suite**

Run: `cd frontend && npm test -- --run`
Expected: PASS. `initialized` is now set only after the profile resolves, so if any existing test asserts on timing it may need an extra `await`. Fix such tests by awaiting the store action rather than by reverting the ordering — `initialized` must not be true before `isAdmin` is known, or `AdminRoute` will flash a redirect.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/store/authStore.ts frontend/src/store/authStore.test.ts frontend/src/types/index.ts
git commit -m "feat: load profile in authStore and expose isAdmin"
```

---

### Task 3: item_flags table

**Files:**
- Create: `supabase/migrations/20260816000002_create_item_flags.sql`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: `public.is_admin()` from Task 1.
- Produces: table `public.item_flags`; TS types `FlagStatus = 'open' | 'resolved' | 'rejected'` and `ItemFlag`.

- [ ] **Step 1: Write the migration**

```sql
-- User-submitted reports of incorrect item information.
-- Migration created: 2026-08-16

create table if not exists public.item_flags (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One OPEN flag per user per item. A user may flag again once the previous
-- report has been resolved or rejected.
create unique index if not exists item_flags_one_open_per_user
  on public.item_flags(item_id, user_id) where status = 'open';

create index if not exists item_flags_queue
  on public.item_flags(status, created_at desc);

create index if not exists item_flags_item_id
  on public.item_flags(item_id);

alter table public.item_flags enable row level security;

create policy "Users can create their own flags"
on public.item_flags for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users read own flags, admins read all"
on public.item_flags for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Users cannot edit or self-resolve a flag.
create policy "Admins can update flags"
on public.item_flags for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy: rows disappear only via the items/users cascade.
```

- [ ] **Step 2: Apply and verify**

Apply with `mcp__supabase__apply_migration`, name `create_item_flags`, then rename the local file to the assigned version. Confirm RLS is on and the indexes exist:

```sql
select relrowsecurity from pg_class where relname = 'item_flags';  -- t
select indexname from pg_indexes where tablename = 'item_flags';
```

- [ ] **Step 3: Add the TypeScript types**

Append to `frontend/src/types/index.ts`:

```ts
export type FlagStatus = 'open' | 'resolved' | 'rejected'

export interface ItemFlag {
  id: string
  item_id: string
  user_id: string
  reason: string
  status: FlagStatus
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  // Joined data
  item?: Item & { topic?: Topic }
  reporter?: Pick<Profile, 'id' | 'username' | 'display_name'>
}
```

- [ ] **Step 4: Verify the build still typechecks**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816000002_create_item_flags.sql frontend/src/types/index.ts
git commit -m "feat: add item_flags table with RLS and one-open-flag-per-user index"
```

---

### Task 4: flagService

**Files:**
- Create: `frontend/src/services/flagService.ts`
- Test: `frontend/src/services/flagService.test.ts`

**Interfaces:**
- Consumes: `item_flags` (Task 3), `ItemFlag` / `FlagStatus` types.
- Produces:
  - `flagService.createFlag(itemId: string, reason: string): Promise<{ data: ItemFlag | null; error: Error | null }>`
  - `flagService.getMyFlagForItem(itemId: string): Promise<{ data: ItemFlag | null; error: Error | null }>`
  - `flagService.listFlags(status: FlagStatus, page: number, pageSize?: number): Promise<{ data: ItemFlag[] | null; count: number; error: Error | null }>`
  - `flagService.resolveFlag(flagId: string, status: 'resolved' | 'rejected', note?: string): Promise<{ error: Error | null }>`
  - `export const DUPLICATE_FLAG_MESSAGE: string`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/services/flagService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flagService, DUPLICATE_FLAG_MESSAGE } from './flagService'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() }
  }
}))

const authed = (id: string) => ({
  data: {
    user: {
      id, email: 'test@example.com', app_metadata: {}, user_metadata: {},
      aud: 'authenticated', created_at: '2026-01-01T00:00:00Z'
    } as User
  },
  error: null
})

const mockInsert = (result: { data: unknown; error: unknown }) => {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  vi.mocked(supabase.from).mockReturnValue({ insert } as never)
  return insert
}

describe('flagService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createFlag', () => {
    it('returns an error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never)

      const result = await flagService.createFlag('item-1', 'The director name is wrong')

      expect(result.error?.message).toBe('Must be signed in to flag an item')
      expect(result.data).toBeNull()
    })

    it('rejects a reason shorter than 10 characters without hitting the network', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)

      const result = await flagService.createFlag('item-1', 'too short')

      expect(result.error?.message).toBe('Tell us a bit more — at least 10 characters')
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('inserts the flag with the trimmed reason', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)
      const insert = mockInsert({ data: { id: 'f1', item_id: 'item-1', status: 'open' }, error: null })

      const result = await flagService.createFlag('item-1', '  The director name is wrong  ')

      expect(insert).toHaveBeenCalledWith({
        item_id: 'item-1',
        user_id: 'u1',
        reason: 'The director name is wrong'
      })
      expect(result.data?.id).toBe('f1')
      expect(result.error).toBeNull()
    })

    it('maps a unique-violation to the duplicate-flag message', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)
      mockInsert({ data: null, error: { code: '23505', message: 'duplicate key value' } })

      const result = await flagService.createFlag('item-1', 'The director name is wrong')

      expect(result.error?.message).toBe(DUPLICATE_FLAG_MESSAGE)
      expect(result.data).toBeNull()
    })
  })

  describe('getMyFlagForItem', () => {
    it('returns null data when signed out rather than erroring', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never)

      const result = await flagService.getMyFlagForItem('item-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  describe('resolveFlag', () => {
    it('stamps status, note and resolved_at', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('admin-1') as never)
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      vi.mocked(supabase.from).mockReturnValue({ update } as never)

      const result = await flagService.resolveFlag('f1', 'resolved', 'Re-scanned, fixed')

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolution_note: 'Re-scanned, fixed',
          resolved_by: 'admin-1'
        })
      )
      expect(eq).toHaveBeenCalledWith('id', 'f1')
      expect(result.error).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/services/flagService.test.ts`
Expected: FAIL — cannot resolve `./flagService`.

- [ ] **Step 3: Implement**

Create `frontend/src/services/flagService.ts`:

```ts
import { supabase } from '../lib/supabase'
import type { ItemFlag, FlagStatus } from '../types'

export const DUPLICATE_FLAG_MESSAGE =
  "You've already flagged this one — it's sitting in the queue."

export const MIN_REASON_LENGTH = 10
export const MAX_REASON_LENGTH = 1000

const FLAG_SELECT = `
  *,
  item:items (*, topic:topics (*)),
  reporter:profiles!item_flags_user_id_fkey (id, username, display_name)
`

/**
 * Service for user-submitted item flags and the admin flag queue.
 */
export const flagService = {
  /**
   * Report an item for incorrect information.
   */
  async createFlag(itemId: string, reason: string): Promise<{
    data: ItemFlag | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Must be signed in to flag an item') }
      }

      const trimmed = reason.trim()
      if (trimmed.length < MIN_REASON_LENGTH) {
        return { data: null, error: new Error('Tell us a bit more — at least 10 characters') }
      }
      if (trimmed.length > MAX_REASON_LENGTH) {
        return { data: null, error: new Error('That is a lot of detail. Keep it under 1000 characters.') }
      }

      const { data, error } = await supabase
        .from('item_flags')
        .insert({ item_id: itemId, user_id: user.id, reason: trimmed })
        .select()
        .single()

      if (error) {
        // Partial unique index on (item_id, user_id) where status = 'open'
        if ((error as { code?: string }).code === '23505') {
          return { data: null, error: new Error(DUPLICATE_FLAG_MESSAGE) }
        }
        throw error
      }

      return { data: data as ItemFlag, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * The current user's open flag for an item, if any.
   */
  async getMyFlagForItem(itemId: string): Promise<{
    data: ItemFlag | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: null }
      }

      const { data, error } = await supabase
        .from('item_flags')
        .select('*')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle()

      if (error) throw error
      return { data: (data as ItemFlag) ?? null, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Admin queue. RLS restricts the result set to admins automatically.
   */
  async listFlags(status: FlagStatus, page = 0, pageSize = 20): Promise<{
    data: ItemFlag[] | null
    count: number
    error: Error | null
  }> {
    try {
      const from = page * pageSize
      const { data, error, count } = await supabase
        .from('item_flags')
        .select(FLAG_SELECT, { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) throw error
      return { data: (data ?? []) as unknown as ItemFlag[], count: count ?? 0, error: null }
    } catch (error) {
      return { data: null, count: 0, error: error as Error }
    }
  },

  /**
   * Close a flag. Admin only — enforced by RLS, not by this function.
   */
  async resolveFlag(
    flagId: string,
    status: 'resolved' | 'rejected',
    note?: string
  ): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('Must be signed in') }
      }

      const { error } = await supabase
        .from('item_flags')
        .update({
          status,
          resolution_note: note?.trim() || null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', flagId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/services/flagService.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify the reporter join name**

`FLAG_SELECT` names the FK constraint `item_flags_user_id_fkey`. Confirm it exists:

```sql
select conname from pg_constraint where conrelid = 'public.item_flags'::regclass;
```

If the generated name differs, correct `FLAG_SELECT`. This is only exercised at runtime, so the unit tests will not catch a wrong name.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/flagService.ts frontend/src/services/flagService.test.ts
git commit -m "feat: add flagService for item reports and the admin queue"
```

---

### Task 5: FlagItemModal and the bug-icon entry point

**Files:**
- Create: `frontend/src/components/FlagItemModal.tsx`
- Test: `frontend/src/components/FlagItemModal.test.tsx`
- Modify: `frontend/src/components/ItemDetailModal.tsx`

**Interfaces:**
- Consumes: `flagService.createFlag`, `DUPLICATE_FLAG_MESSAGE`.
- Produces: `<FlagItemModal item open onOpenChange onFlagged />` and the exported helper `flagPlaceholderForTopic(topicSlug: string): string`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/FlagItemModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { FlagItemModal, flagPlaceholderForTopic } from './FlagItemModal'
import { flagService, DUPLICATE_FLAG_MESSAGE } from '@/services/flagService'
import type { Item, Topic } from '@/types'

vi.mock('@/services/flagService', async () => {
  const actual = await vi.importActual<typeof import('@/services/flagService')>('@/services/flagService')
  return {
    ...actual,
    flagService: { createFlag: vi.fn() }
  }
})

const item = (topicSlug: string): Item & { topic?: Topic } => ({
  id: 'item-1', topic_id: 't1', name: 'Blade Runner', slug: 'blade-runner',
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  topic: { id: 't1', name: 'Movies', slug: topicSlug, description: null, icon: null,
    image_url: null, schema_template: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
})

describe('flagPlaceholderForTopic', () => {
  it('is topic specific', () => {
    expect(flagPlaceholderForTopic('movies')).toContain('Director')
    expect(flagPlaceholderForTopic('series')).toContain('seasons')
    expect(flagPlaceholderForTopic('books')).toContain('Publish year')
  })

  it('falls back for an unknown topic', () => {
    expect(flagPlaceholderForTopic('kayaks')).toContain('release year')
  })
})

describe('FlagItemModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the topic placeholder and leaves the field empty', () => {
    render(<FlagItemModal item={item('series')} open onOpenChange={vi.fn()} />)

    const field = screen.getByLabelText(/what's wrong/i)
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', expect.stringContaining('seasons'))
  })

  it('keeps submit disabled until 10 characters are entered', async () => {
    const user = userEvent.setup()
    render(<FlagItemModal item={item('movies')} open onOpenChange={vi.fn()} />)

    const submit = screen.getByRole('button', { name: /send report/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/what's wrong/i), 'too short')
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/what's wrong/i), ' but now it is long enough')
    expect(submit).toBeEnabled()
  })

  it('submits, closes and reports success', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onFlagged = vi.fn()
    vi.mocked(flagService.createFlag).mockResolvedValue({ data: { id: 'f1' } as never, error: null })

    render(<FlagItemModal item={item('movies')} open onOpenChange={onOpenChange} onFlagged={onFlagged} />)

    await user.type(screen.getByLabelText(/what's wrong/i), 'The director is listed as the wrong person')
    await user.click(screen.getByRole('button', { name: /send report/i }))

    await waitFor(() => expect(flagService.createFlag).toHaveBeenCalledWith(
      'item-1', 'The director is listed as the wrong person'
    ))
    expect(onFlagged).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the duplicate message inline and stays open', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    vi.mocked(flagService.createFlag).mockResolvedValue({
      data: null, error: new Error(DUPLICATE_FLAG_MESSAGE)
    })

    render(<FlagItemModal item={item('movies')} open onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText(/what's wrong/i), 'The director is listed as the wrong person')
    await user.click(screen.getByRole('button', { name: /send report/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(DUPLICATE_FLAG_MESSAGE)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/FlagItemModal.test.tsx`
Expected: FAIL — cannot resolve `./FlagItemModal`.

- [ ] **Step 3: Implement the modal**

Create `frontend/src/components/FlagItemModal.tsx`:

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { flagService, MIN_REASON_LENGTH, MAX_REASON_LENGTH } from '@/services/flagService'
import type { Item, Topic } from '@/types'

interface FlagItemModalProps {
  item: (Item & { topic?: Topic }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFlagged?: () => void
}

const PLACEHOLDERS: Record<string, string> = {
  movies: 'e.g. Director name is wrong',
  series: 'e.g. Number of seasons is wrong',
  books: 'e.g. Publish year is wrong',
  anime: 'e.g. Episode count is wrong',
  games: 'e.g. Developer is wrong',
  restaurants: 'e.g. Location is wrong'
}

const FALLBACK_PLACEHOLDER = 'e.g. The release year is wrong'

/**
 * The example text is a placeholder, never a prefilled value —
 * prefilled examples get submitted verbatim.
 */
export function flagPlaceholderForTopic(topicSlug: string): string {
  return PLACEHOLDERS[topicSlug] ?? FALLBACK_PLACEHOLDER
}

/**
 * Dialog for reporting incorrect information on an item.
 */
export function FlagItemModal({ item, open, onOpenChange, onFlagged }: FlagItemModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!item) return null

  const trimmedLength = reason.trim().length
  const canSubmit = trimmedLength >= MIN_REASON_LENGTH && !submitting

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const { error: submitError } = await flagService.createFlag(item.id, reason)
    setSubmitting(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    setReason('')
    onFlagged?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Something wrong with {item.name}?</DialogTitle>
          <DialogDescription>
            Tell us what's off and we'll take another look. Probably.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="flag-reason">What's wrong?</Label>
          <textarea
            id="flag-reason"
            className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={flagPlaceholderForTopic(item.topic?.slug ?? '')}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {trimmedLength < MIN_REASON_LENGTH
              ? `At least ${MIN_REASON_LENGTH} characters.`
              : `${trimmedLength}/${MAX_REASON_LENGTH}`}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

If `DialogFooter` is not exported from `frontend/src/components/ui/dialog.tsx`, use a plain `<div className="flex justify-end gap-2">` instead — check the file before assuming.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/FlagItemModal.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the bug button to ItemDetailModal**

In `frontend/src/components/ItemDetailModal.tsx`:

Change the lucide import to `import { Plus, Check, X, Bug } from 'lucide-react'` and add:

```tsx
import { useState } from 'react'
import { FlagItemModal } from './FlagItemModal'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
```

Add to `ItemDetailModalProps`:

```ts
  alreadyFlagged?: boolean
  onRequireLogin?: () => void
```

Add to the destructured props: `alreadyFlagged = false, onRequireLogin`.

Add state inside the component, above the `return`:

```tsx
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagged, setFlagged] = useState(alreadyFlagged)

  const handleFlagClick = useCallback(() => {
    if (!isAuthenticated) {
      onRequireLogin?.()
      return
    }
    setFlagOpen(true)
  }, [isAuthenticated, onRequireLogin])
```

Insert the trigger at the end of the "Rating section" `div`, just before its closing tag:

```tsx
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={handleFlagClick}
                  disabled={flagged}
                  aria-label={flagged ? 'You already reported this item' : 'Report incorrect information'}
                >
                  <Bug className={`h-4 w-4 ${flagged ? 'fill-current' : ''}`} />
                  {flagged ? 'Reported' : 'Report a problem'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {flagged
                  ? "Already in the queue. We'll get to it."
                  : isAuthenticated
                    ? 'Something wrong with this info?'
                    : 'You need to log in for this. I know, I know, another login.'}
              </TooltipContent>
            </Tooltip>
          </div>
```

Add the modal immediately after `</DialogContent>`, inside the outer `<Dialog>`:

```tsx
        <FlagItemModal
          item={item}
          open={flagOpen}
          onOpenChange={setFlagOpen}
          onFlagged={() => setFlagged(true)}
        />
```

Finally add `prevProps.alreadyFlagged === nextProps.alreadyFlagged &&` to the `memo` comparator, or a stale flag state will persist across items.

- [ ] **Step 6: Run the suite and build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: both PASS. `ItemDetailModal.test.tsx` may need `TooltipProvider`, which `@/test/utils` already supplies.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/FlagItemModal.tsx frontend/src/components/FlagItemModal.test.tsx frontend/src/components/ItemDetailModal.tsx
git commit -m "feat: add item flag modal with bug-icon trigger"
```

---

### Task 5b: Make the flag trigger work for signed-out users and across items

**Files:**
- Modify: `frontend/src/components/ItemDetailModal.tsx`
- Test: `frontend/src/components/ItemDetailModal.test.tsx` (create)

**Interfaces:**
- Consumes: `FlagItemModal` (Task 5).
- Produces: no new exports. `onRequireLogin` remains an optional override; its absence no longer breaks the signed-out path.

**Why this task exists.** Task 5 shipped two latent defects, both confirmed against the codebase:

1. **The bug icon is dead for signed-out users.** `handleFlagClick` calls `onRequireLogin?.()` when `isAuthenticated` is false, but neither `HomePage.tsx` nor `TopicDetailPage.tsx` passes that prop — they pass `isAuthenticated` and nothing else. So a signed-out visitor clicks "Report a problem" and nothing at all happens. The tooltip promises a login; the button delivers silence.
2. **The `flagged` badge goes stale across items.** `const [flagged, setFlagged] = useState(alreadyFlagged)` seeds only on mount, and `ItemDetailModal` stays mounted while the user opens one item after another. Flag item A, close, open item B — B still shows "Reported".

Fix both in the component rather than in every parent. A prop that every caller must remember to pass, to avoid a dead button, is a worse design than a component that handles its own default.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ItemDetailModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { ItemDetailModal } from './ItemDetailModal'
import type { Item, Topic } from '@/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const makeItem = (id: string, name: string): Item & { topic?: Topic } => ({
  id, topic_id: 't1', name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  topic: {
    id: 't1', name: 'Movies', slug: 'movies', description: null, icon: null,
    image_url: null, schema_template: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
  }
})

describe('ItemDetailModal flag trigger', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a signed-out user to login when no override is provided', async () => {
    const user = userEvent.setup()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('prefers an explicit onRequireLogin override over navigating', async () => {
    const user = userEvent.setup()
    const onRequireLogin = vi.fn()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated={false}
        onRequireLogin={onRequireLogin}
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate for a signed-in user', async () => {
    const user = userEvent.setup()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clears the reported badge when a different item is shown', () => {
    const { rerender } = render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        alreadyFlagged
      />
    )

    expect(screen.getByRole('button', { name: /already reported/i })).toBeInTheDocument()

    rerender(
      <ItemDetailModal
        item={makeItem('i2', 'Arrival')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        alreadyFlagged={false}
      />
    )

    expect(screen.getByRole('button', { name: /report incorrect information/i })).toBeInTheDocument()
  })
})
```

The `rerender` in the last test is deliberate: it reproduces the real situation, where the component stays mounted and only its `item` prop changes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/components/ItemDetailModal.test.tsx`
Expected: FAIL — the signed-out click does nothing (no navigate), and the badge stays "Reported" after the rerender.

- [ ] **Step 3: Implement**

In `frontend/src/components/ItemDetailModal.tsx`:

Add the import:

```tsx
import { useNavigate } from 'react-router-dom'
```

Inside the component, add the hook alongside the other hooks — above the `if (!item) return null` guard, so the hook order stays unconditional:

```tsx
  const navigate = useNavigate()
```

Replace `handleFlagClick` with:

```tsx
  const handleFlagClick = useCallback(() => {
    if (!isAuthenticated) {
      // Default to the login route: no parent passes onRequireLogin, and a
      // button that silently does nothing is worse than a redirect.
      if (onRequireLogin) {
        onRequireLogin()
      } else {
        navigate('/login')
      }
      return
    }
    setFlagOpen(true)
  }, [isAuthenticated, onRequireLogin, navigate])
```

Then reseed `flagged` when the item changes. Add, next to the other hooks:

```tsx
  const flaggedItemId = useRef(item?.id)

  useEffect(() => {
    if (flaggedItemId.current !== item?.id) {
      flaggedItemId.current = item?.id
      setFlagged(alreadyFlagged)
    }
  }, [item?.id, alreadyFlagged])
```

Add `useEffect` and `useRef` to the existing `react` import. Keep every hook above the `if (!item) return null` guard — Task 5 fixed a Rules-of-Hooks violation here, do not reintroduce one.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/components/ItemDetailModal.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full suite and build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: both PASS. The `react-router-dom` mock is scoped to this test file, so it must not affect others.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ItemDetailModal.tsx frontend/src/components/ItemDetailModal.test.tsx
git commit -m "fix: make the flag trigger work when signed out and across items"
```

**Deliberately not done here:** wiring `alreadyFlagged` from the parent pages. Doing that needs a `getMyFlagForItem` lookup per rendered item, and the duplicate path already fails gracefully — `flagService` maps the `23505` unique violation to "You've already flagged this one — it's sitting in the queue." The badge is an optimization, not a correctness requirement, and it is not worth a query per card.

---

### Task 6: Admin item RPCs and audit log

**Files:**
- Create: `supabase/migrations/20260816000003_create_admin_item_functions.sql`
- Create: `docs/admin-sql-verification.md`

**Interfaces:**
- Consumes: `public.is_admin()` (Task 1), `item_flags` (Task 3).
- Produces:
  - `public.admin_item_links(p_item_id uuid) returns jsonb` — `{ rating_count, todo_count, flag_count, raters }`.
  - `public.admin_delete_item(p_item_id uuid, p_force boolean default false) returns jsonb`.
  - table `public.admin_audit_log`.

- [ ] **Step 1: Confirm the FK delete rules (already resolved)**

This was checked against the live database on 2026-08-16 and recorded by Task 0 Step 5. The result:

| Constraint | On delete |
|---|---|
| `user_ratings_item_id_fkey` | CASCADE |
| `user_todo_lists_item_id_fkey` | CASCADE |
| `user_enrichment_requests_result_item_id_fkey` | SET NULL |

**No corrective `alter` is needed.** The forced delete will cascade cleanly. Re-confirm in one query and move on:

```sql
select c.conname, c.confdeltype from pg_constraint c
join pg_class t on t.oid = c.conrelid
where c.contype = 'f' and t.relname in ('user_ratings','user_todo_lists');
```

Every `*_item_id_fkey` row must show `confdeltype = c`. If any does not, stop and report — the plan's delete behaviour depends on it.

- [ ] **Step 2: Write the migration**

```sql
-- Admin item management: audit log, link pre-check, hard delete.
-- Migration created: 2026-08-16

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('delete_item','apply_rescan')),
  -- Deliberately NOT a foreign key: for deletes the item is already gone.
  item_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at
  on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "Admins can read the audit log"
on public.admin_audit_log for select
to authenticated
using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies. Rows are written only by the
-- security-definer functions below and by the service-role Edge Function.

-- ---------------------------------------------------------------------------
-- What would break if this item were deleted?
-- ---------------------------------------------------------------------------
create or replace function public.admin_item_links(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ratings int;
  v_todos int;
  v_flags int;
  v_raters jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select count(*) into v_ratings from public.user_ratings where item_id = p_item_id;
  select count(*) into v_todos from public.user_todo_lists where item_id = p_item_id;
  select count(*) into v_flags from public.item_flags where item_id = p_item_id;

  -- Capped so the warning stays readable.
  select coalesce(jsonb_agg(s.name), '[]'::jsonb) into v_raters
  from (
    select coalesce(p.display_name, p.username, 'someone') as name
    from public.user_ratings r
    left join public.profiles p on p.id = r.user_id
    where r.item_id = p_item_id
    order by r.created_at
    limit 10
  ) s;

  return jsonb_build_object(
    'rating_count', v_ratings,
    'todo_count', v_todos,
    'flag_count', v_flags,
    'raters', v_raters
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hard delete. The link count is recomputed here so a stale UI, a race, or a
-- direct API call cannot bypass the warning.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_item(
  p_item_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links jsonb;
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select to_jsonb(i) into v_item from public.items i where i.id = p_item_id;
  if v_item is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  v_links := public.admin_item_links(p_item_id);

  -- Flags are not blocking: they cascade away with the item by design.
  if not p_force and (
       (v_links->>'rating_count')::int > 0
    or (v_links->>'todo_count')::int > 0
  ) then
    raise exception
      'Item is linked to % rating(s) and % todo entries. Re-run with force to delete anyway.',
      v_links->>'rating_count', v_links->>'todo_count'
      using errcode = 'P0001';
  end if;

  -- The full row is the only recovery path after this point.
  insert into public.admin_audit_log (actor_id, action, item_id, payload)
  values (
    auth.uid(), 'delete_item', p_item_id,
    jsonb_build_object('item', v_item, 'links', v_links, 'forced', p_force)
  );

  delete from public.items where id = p_item_id;

  return jsonb_build_object('deleted', true, 'links', v_links);
end;
$$;

revoke all on function public.admin_item_links(uuid) from public;
revoke all on function public.admin_delete_item(uuid, boolean) from public;
grant execute on function public.admin_item_links(uuid) to authenticated;
grant execute on function public.admin_delete_item(uuid, boolean) to authenticated;
```

- [ ] **Step 3: Apply the migration**

Apply with `mcp__supabase__apply_migration`, name `create_admin_item_functions`, then rename the local file to the assigned version. Confirm both functions exist:

```sql
select proname, prosecdef from pg_proc
where proname in ('admin_item_links','admin_delete_item');
```

`prosecdef` must be `t` for both.

- [ ] **Step 4: Write the SQL verification doc**

Create `docs/admin-sql-verification.md`. There is no pgTAP setup in this repo, so these are manual checks. Run each as the stated role in the Supabase SQL editor (which runs as service role — use `set local role authenticated` plus a `request.jwt.claims` override, or simply test through the app with a real session, whichever is available).

```markdown
# Admin SQL verification

Manual checks for the SQL in `20260816000001`–`20260816000003`. No pgTAP
setup exists in this repo; these are written so they can be lifted into
pgTAP later without rework.

Run each check and confirm the expected result before considering the
admin feature done.

## 1. Non-admins cannot delete

As a signed-in non-admin:

    select public.admin_delete_item('<any-item-uuid>', false);

Expected: ERROR `Admin privileges required` (SQLSTATE 42501).

## 2. Non-admins cannot read links

As a signed-in non-admin:

    select public.admin_item_links('<any-item-uuid>');

Expected: ERROR `Admin privileges required`.

## 3. Unforced delete refuses when links exist

As an admin, against an item that has at least one rating:

    select public.admin_delete_item('<linked-item-uuid>', false);

Expected: ERROR naming the counts, e.g.
`Item is linked to 3 rating(s) and 1 todo entries. Re-run with force to delete anyway.`
The item must still exist afterwards.

## 4. Forced delete cascades

As an admin, against that same item:

    select public.admin_delete_item('<linked-item-uuid>', true);

Expected: returns `{"deleted": true, "links": {...}}`. Then confirm:

    select count(*) from items where id = '<linked-item-uuid>';        -- 0
    select count(*) from user_ratings where item_id = '<uuid>';        -- 0
    select count(*) from user_todo_lists where item_id = '<uuid>';     -- 0
    select count(*) from item_flags where item_id = '<uuid>';          -- 0
    select payload->'item'->>'name' from admin_audit_log
      where item_id = '<uuid>';                                        -- the item name

## 5. Clean delete needs no force

As an admin, against an item with no ratings and no todos:

    select public.admin_delete_item('<orphan-item-uuid>', false);

Expected: succeeds.

## 6. Self-promotion is blocked

As a signed-in non-admin:

    update public.profiles set is_admin = true where id = auth.uid();

Expected: `new row violates row-level security policy`.

## 7. Flag isolation

As user A, after user B has flagged an item:

    select count(*) from item_flags where user_id != auth.uid();

Expected: 0.

## 8. One open flag per user per item

As a signed-in user, insert two flags for the same item:

    insert into item_flags (item_id, user_id, reason)
      values ('<item>', auth.uid(), 'The year is wrong here');
    insert into item_flags (item_id, user_id, reason)
      values ('<item>', auth.uid(), 'The year is still wrong');

Expected: the second raises unique violation 23505. Then, as an admin,
resolve the first and retry the insert as the user — it must now succeed.
```

- [ ] **Step 5: Run the verification doc**

Work through all 8 checks. Every one must produce its expected result. If check 3 or 6 fails, stop and fix the SQL — those two are the security boundary.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260816000003_create_admin_item_functions.sql docs/admin-sql-verification.md
git commit -m "feat: add admin audit log, item link pre-check and hard delete RPC"
```

---

### Task 7: Shared Edge Function modules

**Files:**
- Create: `supabase/functions/_shared/cors.ts`, `slug.ts`, `images.ts`, `extraction.ts`
- Modify: `supabase/functions/ai-enrich-item/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `cors.ts` → `export const corsHeaders: Record<string, string>`
  - `slug.ts` → `export function generateSlug(title: string): string`
  - `images.ts` → `export async function downloadAndStoreImage(imageUrl: string, topicSlug: string, itemSlug: string): Promise<string | null>`
  - `extraction.ts` → `export interface ExtractedData`, `export const TOPIC_SCHEMAS`, `export async function extractItemData(searchQuery: string, topicSlug: string): Promise<ExtractedData>`

**This is a pure move. `ai-enrich-item` behaviour must not change.**

- [ ] **Step 1: Record the current behaviour**

Before touching anything, exercise the existing enrichment flow once through the app (search for an item that does not exist, let it be created) and note: the created item's name, `metadata` keys, `ai_confidence`, and whether an image was stored. This is the regression baseline — there are no automated tests for this function.

- [ ] **Step 2: Create `_shared/cors.ts`**

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

- [ ] **Step 3: Create `_shared/slug.ts`**

Move `generateSlug` verbatim from `ai-enrich-item/index.ts:56-62`:

```ts
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Create `_shared/extraction.ts`**

Move, **verbatim and unmodified**, from `ai-enrich-item/index.ts`:
- the `TOPIC_SCHEMAS` const (lines 12-37) — add `export`
- the `ExtractedData` interface (lines 45-54) — add `export`
- `executeWebSearch` (lines 85-124) — keep module-private, no export
- `extractItemData` (lines 125-292) — add `export`

Add at the top:

```ts
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
```

Do not rewrite the prompt, the model id, the confidence thresholds, or the JSON parsing. A behaviour change here silently degrades enrichment quality for both functions.

- [ ] **Step 5: Create `_shared/images.ts`**

Move `downloadAndStoreImage` verbatim from `ai-enrich-item/index.ts:293-338`, adding `export` and this import:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
```

If the function referenced a `supabaseClient` from the outer scope rather than creating its own, create one inside the function from `Deno.env.get('SUPABASE_URL')` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — read the original body carefully before moving it.

- [ ] **Step 6: Update `ai-enrich-item/index.ts`**

Delete the moved definitions and add:

```ts
import { corsHeaders } from "../_shared/cors.ts";
import { generateSlug } from "../_shared/slug.ts";
import { downloadAndStoreImage } from "../_shared/images.ts";
import { extractItemData, TOPIC_SCHEMAS, type ExtractedData } from "../_shared/extraction.ts";
```

Keep everything else — `checkExistingItem`, `validateInput`, the rate limiting, the `user_enrichment_requests` bookkeeping, the whole `Deno.serve` handler — exactly as it was. If `TOPIC_SCHEMAS` or `ExtractedData` end up unused in `index.ts` after the move, drop them from the import rather than leaving an unused binding.

- [ ] **Step 7: Deploy and regression-test**

Deploy with `mcp__supabase__deploy_edge_function`, name `ai-enrich-item`, `verify_jwt: true`, entrypoint `index.ts`. Pass **every** file in the `files` array — the entrypoint plus each `_shared/*.ts` module it now imports, with `name` values matching the relative import paths (`../_shared/cors.ts` etc.). A deploy that omits a shared module fails at runtime, not at deploy time.

Repeat the Step 1 exercise with a different non-existent item. Confirm: an item is created, metadata keys match the topic schema, an image is stored when one is found. Any difference in shape means the move was not clean — revert and redo.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared supabase/functions/ai-enrich-item/index.ts
git commit -m "refactor: extract shared extraction, image and slug helpers for reuse"
```

---

### Task 8: admin-rescan-item Edge Function

**Files:**
- Create: `supabase/functions/admin-rescan-item/index.ts`

**Interfaces:**
- Consumes: `_shared/extraction.ts`, `_shared/images.ts`, `_shared/slug.ts`, `_shared/cors.ts` (Task 7); `public.is_admin()` (Task 1); `admin_audit_log` (Task 6).
- Produces two endpoints on one function:
  - `POST /admin-rescan-item` body `{ item_id: string }` → `200 { current, proposed, changed_fields, confidence, sources }`
  - `POST /admin-rescan-item/apply` body `{ item_id: string, fields: string[] }` → `200 { item }`

`changed_fields` entries are either a bare column name (`name`, `description`, `image_url`) or a dotted metadata path (`metadata.director`).

- [ ] **Step 1: Write the function**

Create `supabase/functions/admin-rescan-item/index.ts`:

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateSlug } from "../_shared/slug.ts";
import { downloadAndStoreImage } from "../_shared/images.ts";
import { extractItemData, type ExtractedData } from "../_shared/extraction.ts";

interface ItemRow {
  id: string;
  topic_id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  image_url: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Flat comparison of current item vs. proposal. Metadata is compared per key
 * so an admin can accept one field without accepting the rest.
 */
function diffFields(current: ItemRow, proposed: ExtractedData): string[] {
  const changed: string[] = [];
  const norm = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');

  if (proposed.title && proposed.title !== current.name) changed.push('name');
  if (proposed.description && proposed.description !== current.description) changed.push('description');
  if (proposed.image_url && !current.image_url) changed.push('image_url');

  const currentMeta = current.metadata ?? {};
  for (const [key, value] of Object.entries(proposed.metadata ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    if (norm(value) !== norm(currentMeta[key])) changed.push(`metadata.${key}`);
  }
  return changed;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return json({ error: 'Authentication required' }, 401);

    // Authorization lives in the database, not here.
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin');
    if (adminError || !isAdmin) {
      return json({ error: 'Admin privileges required' }, 403);
    }

    const body = await req.json();
    const itemId = body?.item_id;
    if (typeof itemId !== 'string' || itemId.length === 0) {
      return json({ error: 'item_id is required' }, 400);
    }

    const { data: item, error: itemError } = await supabaseClient
      .from('items')
      .select('id, topic_id, name, slug, description, metadata, image_url, topic:topics(slug)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) return json({ error: 'Item not found' }, 404);

    const topicSlug = (item as { topic?: { slug?: string } }).topic?.slug;
    if (!topicSlug) return json({ error: 'Item has no topic' }, 400);

    // The proposal is always recomputed server-side. The client's copy is
    // never trusted for values — only for which fields to apply.
    const proposed = await extractItemData(item.name, topicSlug);

    if (!proposed.found || proposed.confidence_score < 0.6) {
      return json({
        error: "Couldn't find reliable information on this one. Nothing to propose."
      }, 404);
    }

    const changed = diffFields(item as unknown as ItemRow, proposed);
    const isApply = new URL(req.url).pathname.endsWith('/apply');

    if (!isApply) {
      return json({
        current: item,
        proposed: {
          name: proposed.title,
          description: proposed.description,
          metadata: proposed.metadata,
          image_url: proposed.image_url
        },
        changed_fields: changed,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      });
    }

    // --- apply ---
    const requested: string[] = Array.isArray(body.fields) ? body.fields : [];
    const selected = requested.filter((f) => changed.includes(f));
    if (selected.length === 0) {
      return json({ error: 'No applicable fields selected' }, 400);
    }

    const update: Record<string, unknown> = {};
    const nextMetadata = { ...(item.metadata ?? {}) };
    let metadataTouched = false;

    for (const field of selected) {
      if (field === 'name') {
        update.name = proposed.title;
        update.slug = generateSlug(proposed.title);
      } else if (field === 'description') {
        update.description = proposed.description;
      } else if (field === 'image_url') {
        const stored = await downloadAndStoreImage(
          proposed.image_url!, topicSlug, generateSlug(proposed.title)
        );
        if (stored) update.image_url = stored;
      } else if (field.startsWith('metadata.')) {
        const key = field.slice('metadata.'.length);
        nextMetadata[key] = proposed.metadata[key];
        metadataTouched = true;
      }
    }

    if (metadataTouched) update.metadata = nextMetadata;
    update.updated_at = new Date().toISOString();

    // Service role: items UPDATE is restricted to the creator by RLS, and an
    // admin is generally not the creator.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: updated, error: updateError } = await serviceClient
      .from('items')
      .update(update)
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to apply rescan:', updateError);
      return json({ error: 'Failed to update item' }, 500);
    }

    await serviceClient.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'apply_rescan',
      item_id: itemId,
      payload: {
        before: item,
        applied_fields: selected,
        after: updated,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      }
    });

    // Flag status is deliberately untouched — the admin resolves explicitly.
    return json({ item: updated });
  } catch (error) {
    console.error('Rescan failed:', error);
    return json({ error: 'Something broke. Honestly, surprised it worked this long.' }, 500);
  }
});
```

- [ ] **Step 2: Deploy**

Deploy with `mcp__supabase__deploy_edge_function`, name `admin-rescan-item`, `verify_jwt: true`, entrypoint `index.ts`. Include the entrypoint and every `_shared/*.ts` module it imports in the `files` array, with names matching the relative import paths.

- [ ] **Step 3: Verify the authorization boundary**

Using a **non-admin** account's access token:

```bash
curl -i -X POST "<PROJECT_URL>/functions/v1/admin-rescan-item" \
  -H "Authorization: Bearer <NON_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"<some-item-uuid>"}'
```

Expected: `403` with `Admin privileges required`. If this returns 200, stop — nothing else in this task matters until it does not.

- [ ] **Step 4: Verify preview does not write**

With an admin token, POST to the base path for a real item. Note `updated_at` on the item before and after: it must be unchanged. The response must contain `current`, `proposed`, `changed_fields`.

- [ ] **Step 5: Verify apply is selective**

POST to `/apply` with `fields` containing exactly one entry from `changed_fields`. Confirm only that field changed on the item, and that one `apply_rescan` row landed in `admin_audit_log` with `applied_fields` matching.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-rescan-item/index.ts
git commit -m "feat: add admin-rescan-item edge function with preview and selective apply"
```

---


#### AMENDMENT (2026-08-16, after Task 8 review) — stored proposals

Review found that re-running extraction on apply creates a value-level TOCTOU: extraction is
non-deterministic, so the admin approves `metadata.director = "Lana Wachowski"`, the second run
computes a different director, the **field name** still matches the filter, and a value the admin
never saw is written to production. It also doubled the Tavily+Claude cost and made the admin wait
through a second extraction.

**Decision (owner, 2026-08-16): persist the proposal and apply from it.** Preview stores its
proposal and returns an id; apply loads that row and writes from it, with no second extraction. The
trust boundary is preserved — the stored proposal is server-generated and server-held, and the
client only ever sends an id plus field names.

**New table** (its own migration, name `create_admin_rescan_proposals`):

```sql
create table if not exists public.admin_rescan_proposals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  proposed jsonb not null,
  changed_fields text[] not null,
  confidence numeric,
  sources jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);

create index if not exists admin_rescan_proposals_item on public.admin_rescan_proposals(item_id);
create index if not exists admin_rescan_proposals_expiry on public.admin_rescan_proposals(expires_at);

alter table public.admin_rescan_proposals enable row level security;

create policy "Admins can read rescan proposals"
on public.admin_rescan_proposals for select
to authenticated
using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: written only by the service-role Edge Function,
-- same posture as admin_audit_log.
```

`on delete cascade` from `items` means a deleted item takes its stale proposals with it.

**Preview endpoint** — after computing `changed`, insert the proposal with the service-role client
and return its id. Also opportunistically clear expired rows for that item
(`delete from admin_rescan_proposals where item_id = $1 and expires_at < now()`), so the table
self-maintains without a cron job. Response gains `proposal_id`:

```json
{ "proposal_id": "...", "current": {...}, "proposed": {...},
  "changed_fields": [...], "confidence": 0.9, "sources": [...] }
```

**Apply endpoint** — body is now `{ proposal_id, fields }`. It must:

1. Check `is_admin()` first, as before.
2. Load the proposal by id with the service-role client. Reject with `404` if missing, and `410`
   with a clear message if `expires_at < now()` ("That proposal expired — re-scan and review again").
3. **Re-run no extraction.** All written values come from the stored `proposed` payload.
4. Intersect the requested `fields` against the **stored** `changed_fields` — same filter as before,
   now against server-stored data.
5. Take `item_id` from the stored proposal, never from the request body, so a client cannot point a
   proposal at a different item.
6. Delete the proposal row after a successful apply, so it cannot be replayed.

**`applied_fields` must reflect what actually landed.** Build the list as fields are written, not
from the requested selection — if `downloadAndStoreImage` returns null the image was not stored, and
recording `image_url` as applied writes a false audit entry.

**The audit insert must be checked.** Destructure its `error`, `console.error` it, and include an
`audit_failed: true` marker in the response so the UI can surface it. The item is already mutated at
that point; a silently lost audit row is the one failure here with no other trace.

Interfaces this changes for later tasks:
- `adminService.previewRescan` returns a `RescanPreview` that now includes `proposal_id: string`.
- `adminService.applyRescan(proposalId: string, fields: string[])` — takes the proposal id, **not**
  the item id.
- `RescanPreview` gains `proposal_id: string`.
- `RescanDiff` holds the `proposal_id` from the preview and passes it to apply.

---

### Task 9: adminService

**Files:**
- Create: `frontend/src/services/adminService.ts`
- Test: `frontend/src/services/adminService.test.ts`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: `admin_item_links` / `admin_delete_item` (Task 6), `admin-rescan-item` (Task 8).
- Produces:
  - `adminService.getItemLinks(itemId: string): Promise<{ data: ItemLinks | null; error: Error | null }>`
  - `adminService.deleteItem(itemId: string, force: boolean): Promise<{ error: Error | null }>`
  - `adminService.previewRescan(itemId: string): Promise<{ data: RescanPreview | null; error: Error | null }>`
  - `adminService.applyRescan(proposalId: string, fields: string[]): Promise<{ data: Item | null; error: Error | null }>` — **takes the proposal id, not the item id** (see the Task 8 AMENDMENT).
  - Types `ItemLinks`, `RescanPreview`.

**Amended by the Task 8 stored-proposal decision.** `RescanPreview` gains `proposal_id: string`, and
`applyRescan` sends `{ proposal_id, fields }` rather than `{ item_id, fields }`. Update the test
expectations in this task's Step 2 accordingly: the apply test must assert
`supabase.functions.invoke('admin-rescan-item/apply', { body: { proposal_id: 'p1', fields: ['metadata.director'] } })`,
and the preview test's mocked response must include a `proposal_id`. Everything else in this task is
unchanged.

- [ ] **Step 1: Add the types**

Append to `frontend/src/types/index.ts`:

```ts
export interface ItemLinks {
  rating_count: number
  todo_count: number
  flag_count: number
  raters: string[]
}

export interface RescanPreview {
  current: Item
  proposed: {
    name: string
    description: string
    metadata: Record<string, unknown>
    image_url: string | null
  }
  changed_fields: string[]
  confidence: number
  sources: string[]
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/services/adminService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from './adminService'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: { invoke: vi.fn() }
  }
}))

describe('adminService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getItemLinks', () => {
    it('returns the link counts', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { rating_count: 3, todo_count: 1, flag_count: 2, raters: ['ada'] },
        error: null
      } as never)

      const result = await adminService.getItemLinks('item-1')

      expect(supabase.rpc).toHaveBeenCalledWith('admin_item_links', { p_item_id: 'item-1' })
      expect(result.data?.rating_count).toBe(3)
      expect(result.error).toBeNull()
    })

    it('surfaces a privilege error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null, error: { message: 'Admin privileges required' }
      } as never)

      const result = await adminService.getItemLinks('item-1')

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('Admin privileges required')
    })
  })

  describe('deleteItem', () => {
    it('passes force through to the RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { deleted: true }, error: null } as never)

      await adminService.deleteItem('item-1', true)

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_item', {
        p_item_id: 'item-1',
        p_force: true
      })
    })

    it('defaults to an unforced delete', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { deleted: true }, error: null } as never)

      await adminService.deleteItem('item-1', false)

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_item', {
        p_item_id: 'item-1',
        p_force: false
      })
    })

    it('returns the server error when links block the delete', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Item is linked to 3 rating(s) and 1 todo entries.' }
      } as never)

      const result = await adminService.deleteItem('item-1', false)

      expect(result.error?.message).toContain('3 rating(s)')
    })
  })

  describe('rescan', () => {
    it('previews without applying', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { current: {}, proposed: {}, changed_fields: ['metadata.director'], confidence: 0.9, sources: [] },
        error: null
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-rescan-item', {
        body: { item_id: 'item-1' }
      })
      expect(result.data?.changed_fields).toEqual(['metadata.director'])
    })

    it('applies only the selected fields', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { item: { id: 'item-1' } }, error: null
      } as never)

      const result = await adminService.applyRescan('item-1', ['metadata.director'])

      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-rescan-item/apply', {
        body: { item_id: 'item-1', fields: ['metadata.director'] }
      })
      expect(result.data?.id).toBe('item-1')
    })

    it('surfaces an error returned in the response body', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { error: 'Admin privileges required' }, error: null
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(result.error?.message).toBe('Admin privileges required')
      expect(result.data).toBeNull()
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/services/adminService.test.ts`
Expected: FAIL — cannot resolve `./adminService`.

- [ ] **Step 4: Implement**

Create `frontend/src/services/adminService.ts`:

```ts
import { supabase } from '../lib/supabase'
import type { Item, ItemLinks, RescanPreview } from '../types'

/**
 * Admin-only item operations.
 *
 * Every method here is a thin wrapper. Authorization is enforced in the
 * database (is_admin() inside the RPCs) and in the Edge Function — never
 * by this file. Hiding a button is not a security control.
 */
export const adminService = {
  /**
   * What would be severed if this item were deleted.
   */
  async getItemLinks(itemId: string): Promise<{
    data: ItemLinks | null
    error: Error | null
  }> {
    const { data, error } = await supabase.rpc('admin_item_links', { p_item_id: itemId })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as ItemLinks, error: null }
  },

  /**
   * Hard delete. With force = false the server refuses when links exist.
   */
  async deleteItem(itemId: string, force: boolean): Promise<{ error: Error | null }> {
    const { error } = await supabase.rpc('admin_delete_item', {
      p_item_id: itemId,
      p_force: force
    })

    if (error) return { error: new Error(error.message) }
    return { error: null }
  },

  /**
   * Re-check an item's information on the web. Read-only — nothing is written.
   */
  async previewRescan(itemId: string): Promise<{
    data: RescanPreview | null
    error: Error | null
  }> {
    const { data, error } = await supabase.functions.invoke('admin-rescan-item', {
      body: { item_id: itemId }
    })

    if (error) return { data: null, error: error as Error }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data: data as RescanPreview, error: null }
  },

  /**
   * Write the admin-approved subset of a proposal.
   */
  async applyRescan(itemId: string, fields: string[]): Promise<{
    data: Item | null
    error: Error | null
  }> {
    const { data, error } = await supabase.functions.invoke('admin-rescan-item/apply', {
      body: { item_id: itemId, fields }
    })

    if (error) return { data: null, error: error as Error }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data: data.item as Item, error: null }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/services/adminService.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/adminService.ts frontend/src/services/adminService.test.ts frontend/src/types/index.ts
git commit -m "feat: add adminService for item links, delete and rescan"
```

---

### Task 10: DeleteItemDialog

**Files:**
- Create: `frontend/src/components/admin/DeleteItemDialog.tsx`
- Test: `frontend/src/components/admin/DeleteItemDialog.test.tsx`

**Interfaces:**
- Consumes: `adminService.getItemLinks`, `adminService.deleteItem`.
- Produces: `<DeleteItemDialog item open onOpenChange onDeleted />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/DeleteItemDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { DeleteItemDialog } from './DeleteItemDialog'
import { adminService } from '@/services/adminService'
import type { Item } from '@/types'

vi.mock('@/services/adminService', () => ({
  adminService: { getItemLinks: vi.fn(), deleteItem: vi.fn() }
}))

const item = {
  id: 'item-1', topic_id: 't1', name: 'Blade Runner', slug: 'blade-runner',
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
} as Item

const links = (ratings: number, todos: number) => ({
  data: { rating_count: ratings, todo_count: todos, flag_count: 0, raters: ratings ? ['ada'] : [] },
  error: null
})

describe('DeleteItemDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers a plain confirm when nothing is linked', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(0, 0) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: null })

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    const confirm = await screen.findByRole('button', { name: /^delete$/i })
    expect(screen.queryByLabelText(/type the item name/i)).not.toBeInTheDocument()

    await user.click(confirm)

    await waitFor(() => expect(adminService.deleteItem).toHaveBeenCalledWith('item-1', false))
  })

  it('warns and lists what would break when links exist', async () => {
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(3, 1) as never)

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText(/3 ratings/i)).toBeInTheDocument()
    expect(screen.getByText(/1 TODO entry/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type the item name/i)).toBeInTheDocument()
  })

  it('requires the typed item name before the forced delete is enabled', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(3, 1) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: null })

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    const confirm = await screen.findByRole('button', { name: /delete anyway/i })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText(/type the item name/i), 'Blade Runn')
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText(/type the item name/i), 'er')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    await waitFor(() => expect(adminService.deleteItem).toHaveBeenCalledWith('item-1', true))
  })

  it('shows the server error and does not close on failure', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(0, 0) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: new Error('Admin privileges required') })

    render(<DeleteItemDialog item={item} open onOpenChange={onOpenChange} onDeleted={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin privileges required')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/admin/DeleteItemDialog.test.tsx`
Expected: FAIL — cannot resolve `./DeleteItemDialog`.

- [ ] **Step 3: Implement**

Create `frontend/src/components/admin/DeleteItemDialog.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminService } from '@/services/adminService'
import type { Item, ItemLinks } from '@/types'

interface DeleteItemDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Hard-delete confirmation. Loads the link pre-check on open; when anything
 * is linked, the delete requires typing the item name. This is irreversible
 * outside the audit log.
 */
export function DeleteItemDialog({ item, open, onOpenChange, onDeleted }: DeleteItemDialogProps) {
  const [links, setLinks] = useState<ItemLinks | null>(null)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open || !item) return

    setLinks(null)
    setTyped('')
    setError(null)
    setLoading(true)

    adminService.getItemLinks(item.id).then(({ data, error: linkError }) => {
      setLoading(false)
      if (linkError) {
        setError(linkError.message)
        return
      }
      setLinks(data)
    })
  }, [open, item])

  if (!item) return null

  const hasLinks = !!links && (links.rating_count > 0 || links.todo_count > 0)
  const confirmed = !hasLinks || typed.trim() === item.name
  const canDelete = !loading && !!links && confirmed && !deleting

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    const { error: deleteError } = await adminService.deleteItem(item.id, hasLinks)
    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onDeleted()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete "{item.name}"?</DialogTitle>
          <DialogDescription>
            This is permanent. There is no undo, only the audit log.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Checking what this is linked to…</p>}

        {links && !hasLinks && (
          <p className="text-sm text-muted-foreground">
            Nothing is linked to this item. Clean removal.
          </p>
        )}

        {links && hasLinks && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <p className="font-medium mb-1">This would sever:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {links.rating_count > 0 && <li>{pluralize(links.rating_count, 'rating', 'ratings')}</li>}
                {links.todo_count > 0 && <li>{pluralize(links.todo_count, 'TODO entry', 'TODO entries')}</li>}
                {links.flag_count > 0 && <li>{pluralize(links.flag_count, 'flag', 'flags')}</li>}
              </ul>
              {links.raters.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Rated by {links.raters.join(', ')}
                  {links.rating_count > links.raters.length && ` and ${links.rating_count - links.raters.length} more`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">Type the item name to confirm</Label>
              <Input
                id="confirm-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={item.name}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
            {deleting ? 'Deleting…' : hasLinks ? 'Delete anyway' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/admin/DeleteItemDialog.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/DeleteItemDialog.tsx frontend/src/components/admin/DeleteItemDialog.test.tsx
git commit -m "feat: add admin delete dialog with link warning and typed confirmation"
```

---

### Task 11: RescanDiff

**Files:**
- Create: `frontend/src/components/admin/RescanDiff.tsx`
- Test: `frontend/src/components/admin/RescanDiff.test.tsx`

**Interfaces:**
- Consumes: `adminService.previewRescan`, `adminService.applyRescan`, `RescanPreview`.
- Produces: `<RescanDiff itemId open onOpenChange onApplied />`.

**Amended by the Task 8 stored-proposal decision.** The preview response now carries a
`proposal_id`; hold it in component state alongside the preview and pass it to
`adminService.applyRescan(proposalId, selectedFields)` — apply no longer takes the item id. Two
consequences for the tests in this task: the mocked preview must include a `proposal_id` (use
`'p1'`), and the "excludes unchecked fields" test must assert
`applyRescan` was called with `('p1', ['metadata.director'])`. Also handle the expired-proposal
case: a `410` surfaces as an error whose message should be shown in the existing `role="alert"`
region, telling the admin to re-scan. Everything else in this task is unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/RescanDiff.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { RescanDiff } from './RescanDiff'
import { adminService } from '@/services/adminService'

vi.mock('@/services/adminService', () => ({
  adminService: { previewRescan: vi.fn(), applyRescan: vi.fn() }
}))

const preview = {
  data: {
    current: { id: 'item-1', name: 'Blade Runner', description: 'old desc', metadata: { director: 'Wrong Person', year: 1982 }, image_url: null },
    proposed: { name: 'Blade Runner', description: 'new desc', metadata: { director: 'Ridley Scott', year: 1982 }, image_url: null },
    changed_fields: ['description', 'metadata.director'],
    confidence: 0.91,
    sources: ['https://example.com']
  },
  error: null
}

describe('RescanDiff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while the scan runs', async () => {
    vi.mocked(adminService.previewRescan).mockReturnValue(new Promise(() => {}) as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(screen.getByText(/checking the web/i)).toBeInTheDocument()
  })

  it('lists each changed field with before and after, all checked', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByText('Wrong Person')).toBeInTheDocument()
    expect(screen.getByText('Ridley Scott')).toBeInTheDocument()
    expect(screen.getByLabelText(/metadata\.director/i)).toBeChecked()
    expect(screen.getByLabelText(/description/i)).toBeChecked()
  })

  it('excludes unchecked fields from the apply payload', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)
    vi.mocked(adminService.applyRescan).mockResolvedValue({ data: { id: 'item-1' } as never, error: null })

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    await user.click(await screen.findByLabelText(/description/i))
    await user.click(screen.getByRole('button', { name: /apply/i }))

    await waitFor(() => expect(adminService.applyRescan).toHaveBeenCalledWith(
      'item-1', ['metadata.director']
    ))
  })

  it('disables apply when nothing is selected', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    await user.click(await screen.findByLabelText(/description/i))
    await user.click(screen.getByLabelText(/metadata\.director/i))

    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled()
  })

  it('reports when the scan found nothing to change', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue({
      data: { ...preview.data, changed_fields: [] }, error: null
    } as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByText(/nothing looks different/i)).toBeInTheDocument()
  })

  it('surfaces a scan failure', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue({
      data: null, error: new Error("Couldn't find reliable information on this one.")
    } as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't find reliable information")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/admin/RescanDiff.test.tsx`
Expected: FAIL — cannot resolve `./RescanDiff`.

- [ ] **Step 3: Implement**

Create `frontend/src/components/admin/RescanDiff.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { adminService } from '@/services/adminService'
import type { RescanPreview } from '@/types'

interface RescanDiffProps {
  itemId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}

function valueAt(source: Record<string, unknown> | null | undefined, field: string): string {
  if (!source) return '—'
  const raw = field.startsWith('metadata.')
    ? (source.metadata as Record<string, unknown> | null)?.[field.slice('metadata.'.length)]
    : source[field]

  if (raw === null || raw === undefined || raw === '') return '—'
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

/**
 * Re-scan review. The preview never writes; the admin picks which of the
 * proposed fields to apply. The AI being right about one field is not
 * evidence it is right about the rest.
 */
export function RescanDiff({ itemId, open, onOpenChange, onApplied }: RescanDiffProps) {
  const [preview, setPreview] = useState<RescanPreview | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !itemId) return

    setPreview(null)
    setSelected([])
    setError(null)
    setLoading(true)

    adminService.previewRescan(itemId).then(({ data, error: scanError }) => {
      setLoading(false)
      if (scanError) {
        setError(scanError.message)
        return
      }
      setPreview(data)
      setSelected(data?.changed_fields ?? [])
    })
  }, [open, itemId])

  if (!itemId) return null

  const toggle = (field: string) => {
    setSelected((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    )
  }

  const handleApply = async () => {
    setApplying(true)
    setError(null)

    const { error: applyError } = await adminService.applyRescan(itemId, selected)
    setApplying(false)

    if (applyError) {
      setError(applyError.message)
      return
    }

    onApplied()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-scan results</DialogTitle>
          <DialogDescription>
            Pick what to keep. Nothing is written until you apply.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground">
            Checking the web again. This takes a moment.
          </p>
        )}

        {preview && preview.changed_fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing looks different. The data we have matches what's out there.
          </p>
        )}

        {preview && preview.changed_fields.length > 0 && (
          <div className="space-y-3">
            {preview.changed_fields.map((field) => (
              <label
                key={field}
                htmlFor={`field-${field}`}
                className="flex gap-3 rounded-md border p-3 text-sm cursor-pointer"
              >
                <input
                  id={`field-${field}`}
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(field)}
                  onChange={() => toggle(field)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium mb-1">{field}</p>
                  <p className="text-muted-foreground line-through break-words">
                    {valueAt(preview.current as unknown as Record<string, unknown>, field)}
                  </p>
                  <p className="break-words">
                    {valueAt(preview.proposed as unknown as Record<string, unknown>, field)}
                  </p>
                </div>
              </label>
            ))}

            <p className="text-xs text-muted-foreground">
              Confidence {(preview.confidence * 100).toFixed(0)}%
              {preview.sources.length > 0 && ` · ${preview.sources.length} source(s)`}
            </p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={handleApply}
            disabled={selected.length === 0 || applying || loading}
          >
            {applying ? 'Applying…' : 'Apply selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/admin/RescanDiff.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/RescanDiff.tsx frontend/src/components/admin/RescanDiff.test.tsx
git commit -m "feat: add rescan diff review with per-field selection"
```

---

### Task 12: AdminRoute guard

**Files:**
- Modify: `frontend/src/components/RouteGuards.tsx`
- Test: `frontend/src/components/RouteGuards.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuthStore().isAdmin`, `.initialized` and `.profileLoading` (Task 2).
- Produces: `export function AdminRoute()`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/RouteGuards.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRoute } from './RouteGuards'
import { useAuthStore } from '@/store/authStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<p>admin area</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAdmin: false, initialized: true, profileLoading: false })
  })

  it('renders the route for an admin', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAdmin: true, initialized: true, profileLoading: false })

    renderAt('/admin')

    expect(screen.getByText('admin area')).toBeInTheDocument()
  })

  it('waits instead of redirecting while a fresh sign-in profile loads', () => {
    // The regression this guards: initialized is already true after sign-in,
    // and isAdmin is still false until the profile lands.
    useAuthStore.setState({
      user: { id: 'u1' } as never, isAdmin: false, initialized: true, profileLoading: true
    })

    renderAt('/admin')

    expect(screen.queryByText('home')).not.toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })

  it('redirects a signed-in non-admin home', () => {
    useAuthStore.setState({ user: { id: 'u2' } as never, isAdmin: false, initialized: true, profileLoading: false })

    renderAt('/admin')

    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })

  it('redirects a signed-out visitor home', () => {
    renderAt('/admin')

    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('renders nothing rather than redirecting while auth is still initializing', () => {
    useAuthStore.setState({ user: null, isAdmin: false, initialized: false, profileLoading: false })

    renderAt('/admin')

    expect(screen.queryByText('home')).not.toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })
})
```

The last test is the important one: redirecting before `initialized` would bounce an admin off their own page on every hard refresh.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/RouteGuards.test.tsx`
Expected: FAIL — `AdminRoute` is not exported.

- [ ] **Step 3: Implement**

Append to `frontend/src/components/RouteGuards.tsx`:

```tsx
/**
 * Protects admin-only routes.
 *
 * This is a UX guard, not a security control — every admin operation is
 * enforced by RLS and by the admin RPCs. A user who forces this route sees
 * an empty page, not data.
 */
export function AdminRoute() {
  const { isAdmin, initialized, profileLoading } = useAuthStore()

  // profileLoading matters on fresh sign-in, where initialized is already
  // true but isAdmin has not resolved yet. Redirecting here would bounce an
  // admin off their own page until they reloaded.
  if (!initialized || profileLoading) {
    return null // App.tsx handles the loading state
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/RouteGuards.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RouteGuards.tsx frontend/src/components/RouteGuards.test.tsx
git commit -m "feat: add AdminRoute guard"
```

---

### Task 13: AdminPage flag queue

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`
- Create: `frontend/src/components/admin/AdminItemActions.tsx`
- Test: `frontend/src/pages/AdminPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `flagService.listFlags` / `.resolveFlag`, `DeleteItemDialog`, `RescanDiff`, `AdminRoute`.
- Produces: `AdminPage` (default export, lazily loaded) and `<AdminItemActions item onChanged />`.

- [ ] **Step 1: Write AdminItemActions**

Create `frontend/src/components/admin/AdminItemActions.tsx`. This is the shared re-scan/delete pair used by both the queue and the item modal:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2 } from 'lucide-react'
import { DeleteItemDialog } from './DeleteItemDialog'
import { RescanDiff } from './RescanDiff'
import type { Item } from '@/types'

interface AdminItemActionsProps {
  item: Item
  /** Called after a successful re-scan apply or delete. */
  onChanged: () => void
}

/**
 * Admin re-scan and delete buttons. Mounted both in the flag queue and
 * inline in ItemDetailModal.
 */
export function AdminItemActions({ item, onChanged }: AdminItemActionsProps) {
  const [rescanOpen, setRescanOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setRescanOpen(true)}>
          <RefreshCw className="h-4 w-4" />
          Re-scan
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <RescanDiff
        itemId={rescanOpen ? item.id : null}
        open={rescanOpen}
        onOpenChange={setRescanOpen}
        onApplied={onChanged}
      />
      <DeleteItemDialog
        item={deleteOpen ? item : null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onChanged}
      />
    </>
  )
}
```

Passing `null` when closed keeps the child effects from firing a network call on mount.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/pages/AdminPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import AdminPage from './AdminPage'
import { flagService } from '@/services/flagService'

vi.mock('@/services/flagService', () => ({
  flagService: { listFlags: vi.fn(), resolveFlag: vi.fn() }
}))
vi.mock('@/components/admin/AdminItemActions', () => ({
  AdminItemActions: () => <div>admin actions</div>
}))

const flag = {
  id: 'f1', item_id: 'item-1', user_id: 'u1',
  reason: 'The director is the wrong person',
  status: 'open', resolution_note: null, resolved_by: null, resolved_at: null,
  created_at: '2026-08-16T00:00:00Z',
  item: { id: 'item-1', name: 'Blade Runner', topic: { name: 'Movies', slug: 'movies' } },
  reporter: { id: 'u1', username: 'ada', display_name: 'Ada' }
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(flagService.listFlags).mockResolvedValue({ data: [flag] as never, count: 1, error: null })
  })

  it('loads the open queue first', async () => {
    render(<AdminPage />)

    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledWith('open', 0))
    expect(await screen.findByText('Blade Runner')).toBeInTheDocument()
    expect(screen.getByText(/the director is the wrong person/i)).toBeInTheDocument()
  })

  it('switches queues when a tab is selected', async () => {
    const user = userEvent.setup()
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('tab', { name: /resolved/i }))

    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledWith('resolved', 0))
  })

  it('resolves a flag and refreshes the queue', async () => {
    const user = userEvent.setup()
    vi.mocked(flagService.resolveFlag).mockResolvedValue({ error: null })
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('button', { name: /^resolve$/i }))

    await waitFor(() => expect(flagService.resolveFlag).toHaveBeenCalledWith('f1', 'resolved', ''))
    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledTimes(2))
  })

  it('rejects a flag with the reject status', async () => {
    const user = userEvent.setup()
    vi.mocked(flagService.resolveFlag).mockResolvedValue({ error: null })
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('button', { name: /reject/i }))

    await waitFor(() => expect(flagService.resolveFlag).toHaveBeenCalledWith('f1', 'rejected', ''))
  })

  it('shows an empty state when the queue is clear', async () => {
    vi.mocked(flagService.listFlags).mockResolvedValue({ data: [], count: 0, error: null })

    render(<AdminPage />)

    expect(await screen.findByText(/nothing in the queue/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/pages/AdminPage.test.tsx`
Expected: FAIL — cannot resolve `./AdminPage`.

- [ ] **Step 4: Implement the page**

Create `frontend/src/pages/AdminPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { AdminItemActions } from '@/components/admin/AdminItemActions'
import { flagService } from '@/services/flagService'
import type { ItemFlag, FlagStatus } from '@/types'

const PAGE_SIZE = 20

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * Admin flag queue. Access is gated by AdminRoute for UX and by RLS for real.
 */
export default function AdminPage() {
  const [status, setStatus] = useState<FlagStatus>('open')
  const [flags, setFlags] = useState<ItemFlag[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, count, error: listError } = await flagService.listFlags(status, page)
    setLoading(false)

    if (listError) {
      setError(listError.message)
      return
    }
    setFlags(data ?? [])
    setTotal(count)
  }, [status, page])

  useEffect(() => { void load() }, [load])

  const handleResolve = async (flagId: string, next: 'resolved' | 'rejected') => {
    const { error: resolveError } = await flagService.resolveFlag(flagId, next, notes[flagId] ?? '')
    if (resolveError) {
      setError(resolveError.message)
      return
    }
    await load()
  }

  const changeStatus = (next: FlagStatus) => {
    setPage(0)
    setStatus(next)
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flag queue</h1>
        <p className="text-sm text-muted-foreground">
          Things people say we got wrong. They're usually right.
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => changeStatus(v as FlagStatus)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && flags.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing in the queue. Enjoy it while it lasts.
        </p>
      )}

      <div className="space-y-4">
        {flags.map((flag) => (
          <Card key={flag.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{flag.item?.name ?? 'Deleted item'}</p>
                <p className="text-xs text-muted-foreground">
                  {flag.item?.topic?.name} · reported by{' '}
                  {flag.reporter?.display_name ?? flag.reporter?.username ?? 'someone'} ·{' '}
                  {timeAgo(flag.created_at)}
                </p>
              </div>
              {flag.item && <AdminItemActions item={flag.item} onChanged={load} />}
            </div>

            <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{flag.reason}</p>

            {flag.status === 'open' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Resolution note (optional)"
                  value={notes[flag.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleResolve(flag.id, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleResolve(flag.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {flag.status !== 'open' && flag.resolution_note && (
              <p className="text-xs text-muted-foreground">Note: {flag.resolution_note}</p>
            )}
          </Card>
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run src/pages/AdminPage.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Wire the route**

In `frontend/src/App.tsx`:

Add to the guard import: `import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from './components/RouteGuards'`

Add to the lazy imports:

```ts
const AdminPage = lazy(() => import('./pages/AdminPage'))
```

Add inside the `<Route path="/" element={<Layout />}>` block, after the protected routes:

```tsx
        {/* Admin routes - UX guard only; RLS is the real boundary */}
        <Route element={<AdminRoute />}>
          <Route
            path="admin"
            element={
              <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>}>
                <AdminPage />
              </Suspense>
            }
          />
        </Route>
```

- [ ] **Step 7: Verify in the browser**

Run `cd frontend && npm run dev`. Visit `/admin` as your (admin) account — the queue renders. Sign out and visit `/admin` — you land on `/`. Flag an item from a second, non-admin account and confirm it appears in the queue.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/pages/AdminPage.test.tsx frontend/src/components/admin/AdminItemActions.tsx frontend/src/App.tsx
git commit -m "feat: add admin flag queue page with resolve, rescan and delete"
```

---

### Task 14: Inline admin actions in ItemDetailModal

**Files:**
- Modify: `frontend/src/components/ItemDetailModal.tsx`

**Interfaces:**
- Consumes: `AdminItemActions` (Task 13), `useAuthStore().isAdmin` (Task 2).
- Produces: no new exports; `ItemDetailModal` gains an optional `onItemChanged?: () => void` prop.

- [ ] **Step 1: Add the props and the actions block**

In `frontend/src/components/ItemDetailModal.tsx`:

Add the imports:

```tsx
import { AdminItemActions } from './admin/AdminItemActions'
import { useAuthStore } from '@/store/authStore'
```

Add to `ItemDetailModalProps`:

```ts
  onItemChanged?: () => void
```

Add `onItemChanged` to the destructured props, and read the flag inside the component:

```tsx
  const isAdmin = useAuthStore((state) => state.isAdmin)
```

Insert just before the closing `</DialogContent>`:

```tsx
        {isAdmin && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Admin</p>
              <AdminItemActions
                item={item}
                onChanged={() => {
                  onItemChanged?.()
                  onOpenChange(false)
                }}
              />
            </div>
          </>
        )}
```

Closing the modal after a change is deliberate: a deleted item has no modal to return to, and a re-scanned one needs its parent to refetch.

Add `prevProps.onItemChanged === nextProps.onItemChanged &&` to the `memo` comparator.

- [ ] **Step 2: Run the suite**

Run: `cd frontend && npm test -- --run`
Expected: PASS. `ItemDetailModal.test.tsx` now reads `useAuthStore`; if it fails, reset the store in `beforeEach` with `useAuthStore.setState({ isAdmin: false, initialized: true })` rather than mocking the module.

- [ ] **Step 3: Verify in the browser**

As an admin, open any item from `/topics/:slug`. The Admin row appears with Re-scan and Delete. As a non-admin, it does not.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ItemDetailModal.tsx
git commit -m "feat: show admin item actions inline in the item detail modal"
```

---

### Task 15: Documentation and final verification

**Files:**
- Modify: `docs/CHANGELOG.md`, `docs/context/BACKEND_CONTEXT.md`, `docs/context/FRONTEND_CONTEXT.md`, `CLAUDE.md`

- [ ] **Step 1: Run the full suite and build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: both PASS. Do not proceed until they do — and report the actual counts, not "tests pass".

- [ ] **Step 2: Re-run the SQL verification**

Work through `docs/admin-sql-verification.md` once more against the deployed database, now that the UI exists. Checks 3 and 6 are the security boundary.

- [ ] **Step 3: Update CHANGELOG**

Add an entry to `docs/CHANGELOG.md` dated 2026-08-16 covering: the `item_flags` table and user-facing report flow; `profiles.is_admin` and the `is_admin()` helper; the `admin_item_links` / `admin_delete_item` RPCs and `admin_audit_log`; the `_shared` Edge Function refactor; the `admin-rescan-item` function; and the `/admin` page. Record *why* delete is hard rather than soft (bad imports are the target, and a soft-deleted item still collides on the unique slug) and why re-scan previews rather than auto-applies.

- [ ] **Step 4: Update the context files**

`docs/context/BACKEND_CONTEXT.md`: document `is_admin()` as the canonical authorization check for new policies, the `item_flags` RLS rules, both admin RPCs and their error codes, and the two-endpoint shape of `admin-rescan-item`. Note that `supabase/functions/_shared/` now holds the extraction pipeline and that changes there affect both functions.

`docs/context/FRONTEND_CONTEXT.md`: document `useAuthStore().isAdmin`, `AdminRoute`, and the rule that admin UI gating is cosmetic — the server is the boundary.

`CLAUDE.md`: add flagging and admin moderation to "Working Features", and update the test count in that section to the number from Step 1.

- [ ] **Step 5: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: record item flagging and admin tools"
```

- [ ] **Step 6: Request code review**

Use the superpowers:requesting-code-review skill. Ask specifically about the RLS policies, the `security definer` functions, and whether the Edge Function's admin check can be bypassed — this feature adds a privilege boundary, and `CLAUDE.md`'s first principle is "Security First: no mistakes allowed."

---

## Deferred / out of scope

Do not build these:

- Any role system beyond the boolean.
- Restore-from-audit-log UI.
- Notifying a reporter when their flag is resolved.
- Flag categories or structured reasons.
- Bulk admin actions.
- Admin promotion UI.
