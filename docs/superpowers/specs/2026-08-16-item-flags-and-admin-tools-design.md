# Item Flags & Admin Tools — Design

**Date:** 2026-08-16
**Status:** Approved, ready for implementation planning

## Summary

Two features:

1. **Item flagging (all signed-in users)** — a bug-icon action on an item that opens a modal with a required free-text field, letting users report incorrect information.
2. **Admin tools (admins only)** — a `/admin` page with a flag queue, plus the ability to hard-delete an imported item (with a pre-flight check for linked ratings/TODOs) and to re-scan an item's information and metadata from the web.

Both build on the existing Supabase + React 19 stack and follow the patterns already in `frontend/src/services/`, `frontend/src/components/`, and `supabase/migrations/`.

## Decisions

| Question | Decision |
|---|---|
| Admin identity | `profiles.is_admin` boolean. No role system. |
| Admin UI | Dedicated `/admin` page with the flag queue; admin actions also inline in `ItemDetailModal`. |
| Delete semantics | **Hard delete.** Pre-flight link check; warning + forced confirm when links exist. |
| Re-scan | Preview a diff, admin selects fields and applies. Never auto-applies. |
| Flag permissions | Signed-in users only. One open flag per item per user. |
| Flag closure | Admin resolves explicitly. Deleting an item cascades its flags away. |
| Enrichment code | Shared extraction logic refactored into `supabase/functions/_shared/`. |
| Audit log | In scope — `admin_audit_log` table. |

---

## 1. Admin identity

### Schema

```sql
alter table public.profiles
  add column is_admin boolean not null default false;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;
```

`security definer` is required: a plain query would be blocked by the `profiles` RLS policies when reading another user's row.

Admins are granted by SQL only. There is no UI to promote a user.

### Self-promotion guard

The existing `"Users can update own profile"` policy must be replaced with one whose `WITH CHECK` prevents flipping the flag:

```sql
drop policy "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
);
```

### Frontend

`authStore` currently holds only the auth `user`. It gains a `profile` fetch on initialize and on `onAuthStateChange`, exposing `profile` and a derived `isAdmin`. `signOut` clears it. This also removes ad-hoc profile fetching elsewhere.

---

## 2. `item_flags`

```sql
create table public.item_flags (
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

create unique index item_flags_one_open_per_user
  on public.item_flags(item_id, user_id) where status = 'open';

create index item_flags_queue on public.item_flags(status, created_at desc);

alter table public.item_flags enable row level security;
```

`on delete cascade` from `items` implements "deleting an item closes its flags".

### RLS

- INSERT: authenticated, `auth.uid() = user_id`.
- SELECT: own flags, **or** `is_admin()`.
- UPDATE: `is_admin()` only. Users cannot edit or self-resolve a flag.
- DELETE: no policy. Rows only disappear via the item cascade.

---

## 3. Item deletion

Hard `DELETE`. The pre-flight check is a separate read so the warning and the action cannot disagree about what would be severed.

The TODO table is named `user_todo_lists`. Its `item_id` FK already declares `on delete cascade`; `user_ratings` was created outside tracked migrations and its FK must be verified before the forced delete is relied upon.

```sql
-- Raises insufficient_privilege unless is_admin().
-- Returns { rating_count, todo_count, flag_count, raters: [display_name, ...] }
create function public.admin_item_links(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$ ... $$;

-- Raises insufficient_privilege unless is_admin().
-- Re-counts links server-side. If any are non-zero and p_force is false,
-- raises an exception naming the counts. Otherwise deletes the item row and
-- lets the existing FK cascades remove ratings / todo entries / flags.
-- Writes an admin_audit_log row containing the full deleted item row.
create function public.admin_delete_item(p_item_id uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$ ... $$;
```

The server-side re-count is the real guard: a stale UI, a race, or a direct API call cannot bypass the warning.

`raters` is capped (10 names + a remainder count) so the warning stays readable.

### Audit log

```sql
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('delete_item','apply_rescan')),
  item_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
-- SELECT: is_admin() only. No INSERT/UPDATE/DELETE policy — written only by
-- security-definer functions and the Edge Function's service-role client.
```

`item_id` is deliberately **not** a foreign key: the referenced item is gone by the time the delete row is written. For deletes, `payload` holds the full deleted item row — the only recovery path.

---

## 4. Re-scan — `admin-rescan-item` Edge Function

A **new** function, not a branch in `ai-enrich-item`. That function is 608 lines and owns a distinct job (search → create a new item, rate-limited per user via `user_enrichment_requests`). Re-scan is admin-only, bypasses that rate limit, and updates rather than inserts.

### Shared refactor (in scope)

Extract into `supabase/functions/_shared/`:

- `extraction.ts` — the Tavily search + Claude extraction, the `TOPIC_SCHEMAS` map, and the `ExtractedData` type.
- `images.ts` — `downloadAndStoreImage`.
- `slug.ts` — `generateSlug`.
- `cors.ts` — the shared `corsHeaders`.

`ai-enrich-item` is refactored to import these. Its behaviour must not change; this is a pure move. Without it the extraction prompt would be duplicated and the two functions would drift.

### Endpoints

**`POST /admin-rescan-item`** (preview) — verifies `is_admin()`, re-runs extraction using the item's existing name and topic slug, returns:

```json
{ "current": {...}, "proposed": {...}, "changed_fields": ["metadata.director"],
  "confidence": 0.87, "sources": ["https://..."] }
```

**No write occurs.**

**`POST /admin-rescan-item/apply`** — receives the item id, the proposal, and the admin's selected field list. Behaviour:

- Verifies `is_admin()`.
- **Re-validates the proposal server-side.** The client-echoed payload is trusted only for *which fields* to apply, never for their values.
- Applies the selected fields; stores a new image via `downloadAndStoreImage` only if `image_url` is among them.
- Writes an `apply_rescan` row to `admin_audit_log` with before/after.
- Does **not** touch flag status — the admin resolves flags explicitly.

Field-level selection matters: the AI being right about the director does not mean it is right about the release year.

---

## 5. Frontend — flag flow

### Entry point

A `Bug` icon button (`lucide-react`, already available) in the `ItemDetailModal` header action row. Signed-out users see the button; clicking prompts login rather than hiding the affordance — brand voice: *"You need to log in for this. I know, I know, another login."*

If the current user already has an open flag on the item, the icon renders filled/muted and is disabled with a tooltip.

### `FlagItemModal`

Built on the existing `ui/dialog.tsx`. One textarea, one submit.

The example texts are a **`placeholder`, not a prefilled value** — prefilled text gets submitted verbatim. The placeholder is chosen from the item's `topic.slug`:

| Topic | Placeholder |
|---|---|
| movies | `e.g. Director name is wrong` |
| series | `e.g. Number of seasons is wrong` |
| books | `e.g. Publish year is wrong` |
| anime | `e.g. Episode count is wrong` |
| games | `e.g. Developer is wrong` |
| restaurants | `e.g. Location is wrong` |
| *(fallback)* | `e.g. The release year is wrong` |

Submit is disabled under 10 characters, matching the DB `CHECK`. A `23505` unique-violation maps to a specific message — *"You've already flagged this one — it's in the queue"* — not a generic failure. On success: close, toast, mark the icon as flagged.

### `flagService.ts`

`createFlag`, `getMyFlagForItem`, `listFlags(status, page)`, `resolveFlag(id, status, note)`.

---

## 6. Frontend — `/admin`

### Guard

A new `AdminRoute` in `RouteGuards.tsx` alongside the existing guards; non-admins redirect to `/`. It must not redirect while the profile is still loading (no flash). The guard is UX only — every real check lives in RLS and the RPCs, so a forced route yields an empty, non-functional page.

### Queue

Primary view: the flag queue. `ui/tabs.tsx` for open / resolved / rejected, paginated with the existing `Pagination.tsx`. Each row shows item name, topic, thumbnail, reason, reporter, and age. Expanding a row reveals three actions.

**Re-scan** — calls the preview endpoint, renders `RescanDiff`, then applies. The Tavily + Claude round-trip is slow: spinner, disabled button, and a clear failure state are required.

**Delete** — calls `admin_item_links` first, then renders `DeleteItemDialog`:
- Zero links → plain confirm.
- Non-zero → warning listing exactly what breaks ("3 ratings, 1 TODO entry", with rater names), and a destructive confirm that requires **typing the item name** before `force = true` is sent. This is unrecoverable outside the audit log.

**Resolve / Reject** — with an optional note.

### Components

`RescanDiff.tsx` and `DeleteItemDialog.tsx` are their own components, not inlined into `AdminPage.tsx`: both hold real logic and both mount in two places (the queue and `ItemDetailModal`).

`RescanDiff` renders before/after per changed field with a checkbox each, all checked by default; unchecked fields are excluded from the apply payload.

### Inline admin actions

`ItemDetailModal` renders the same re-scan and delete components conditionally on `isAdmin`, so an item found through normal browsing can be acted on without hunting for it in the queue.

---

## 7. Testing

Vitest + React Testing Library, following existing patterns.

- `flagService` — success; `23505` → duplicate message; validation rejection.
- `FlagItemModal` — placeholder varies by topic and falls back; submit disabled under 10 chars; duplicate error surfaces; already-flagged state disables the trigger.
- `AdminRoute` — admin renders; non-admin redirects; loading state does not flash a redirect.
- `DeleteItemDialog` — zero-link and linked paths render different confirms; `force` is sent only after the typed confirmation.
- `RescanDiff` — unchecked fields are excluded from the apply payload.
- `authStore` — `isAdmin` derives from the profile; cleared on sign-out.

### SQL verification

No local Supabase precedent exists in this repo: `supabase/` contains only `config.toml`, `functions/`, and `migrations/`; there is no `tests/` directory or pgTAP setup, and the `supabase` CLI is not installed (Docker is). SQL checks are therefore **documented manual verification steps**, written as runnable `psql` snippets in the migration's companion doc so they can be lifted into pgTAP later without rework:

1. `admin_delete_item` raises for a non-admin caller.
2. `admin_delete_item(id, false)` raises, naming the counts, when links exist.
3. `admin_delete_item(id, true)` deletes and cascades ratings, todos, and flags.
4. A non-admin `UPDATE profiles SET is_admin = true` on their own row is rejected.
5. A non-admin cannot SELECT another user's `item_flags` row.
6. The partial unique index rejects a second open flag but permits a new one after the first is resolved.

### Definition of done

Per `CLAUDE.md`: `npm test -- --run` and `npm run build` both pass, and `docs/CHANGELOG.md` records what changed and why.

---

## Out of scope

- Any role system beyond the boolean.
- Undo / restore UI for deleted items (the audit log payload is the manual recovery path).
- Notifying the reporter when their flag is resolved.
- Flag categories or structured reasons — free text only.
- Bulk admin actions.
