# Changelog

All notable decisions and changes to this project are documented in this file.

> **Archive Policy**: Entries older than 3 months move to `changelogs/YYYY-QX.md`
>
> **Format**: Each entry includes What, Why, Impact, and Files Changed

---

## Archives

- [2025 Q4](changelogs/2025-Q4.md) - Project foundation, architecture decisions, MVP 1

---

## 2026

### [2026-08-23] Profile Page Restructure

**What**: Reworked `/profile` from a flat stack of emoji-only mini-cards into a structured page with real item imagery and topic-based navigation of the TODO list.

- **`ItemPosterCard`** (new, `components/ItemPosterCard.tsx`) — poster-style card: image on top via `getItemImageUrl` + `LazyImage`, name underneath, optional `footer` and top-right `action` slots. Used by both Top Rated and Watch Later so the two surfaces are visually identical instead of each hand-rolling a card body inside `ProfilePage`. Falls back to the topic emoji when enrichment never found an image, which is still the common case for freshly added items.
- **`TodoSection`** (new, `components/profile/TodoSection.tsx`) — Watch Later as topic filter pills (`All 12` / `🎬 Movies 4` / …) over a poster grid, replacing the single flat horizontal strip. It consumes the topic-grouped `Map` that `todoService.getAllTodos()` already returned; `ProfilePage` previously flattened that grouping away with `flatMap` and threw the topic structure out. Filtering is now a group lookup rather than a re-scan. A topic whose last item is removed drops out of the pill row, and the view falls back to `All` rather than showing an empty grid.
- **`RatingRow`** (new, `components/profile/RatingRow.tsx`) — one rated item as a compact row with a thumbnail, name, note, and stars. **Deliberately not a poster grid**: a user with hundreds of ratings needs a scannable list, and poster cards would truncate notes and make the tab content very tall. Imagery was the goal, not uniformity of card shape.
- **Topic stats are now navigation.** The per-topic count tiles were decorative; each is now a `button` that selects that topic's ratings tab and scrolls the ratings section into view (`behavior: 'auto'` under `prefers-reduced-motion`). Header details (join date, total ratings) moved inside a bordered `Card` with a separator so the page opens with a defined block instead of floating text.
- `setActiveTab` in the fetch effect became a functional update. The old code read `activeTab` while omitting it from the dep array; with the stats tiles now able to set a tab before the fetch resolves, the functional form keeps the user's choice instead of overwriting it with the default topic.

**Why**: The page was plain — every card was an emoji on a blank background even though items already carry images — and the TODO list had no way to navigate by topic despite the data arriving grouped by topic.

**Impact**: Frontend only. No schema, RLS, service, route, or Edge Function changes; no new dependencies. Test count 239 → 261 (22 new across the three components). Optimistic-remove behaviour and its rollback are unchanged, just applied to the grouped shape.

**Files Changed**:
- `frontend/src/components/ItemPosterCard.tsx` (new) + `.test.tsx`
- `frontend/src/components/profile/TodoSection.tsx` (new) + `.test.tsx`
- `frontend/src/components/profile/RatingRow.tsx` (new)
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/ProfilePage.test.tsx` (new — the page had no test coverage before)
- `docs/context/FRONTEND_CONTEXT.md`, `CLAUDE.md`

---


### [2026-08-17] Item Flags and Admin Tools

**What**: The full item-flags-and-admin-tools branch, closed out — user-facing report flow, admin identity, hard delete, AI re-scan, and the `/admin` page.

- `profiles.is_admin` (boolean, default false) plus `public.is_admin()` — a `security definer` function with `search_path = public` that reads `is_admin` for `auth.uid()`. This is now the canonical authorization check for any new admin-only policy or RPC: a `using`/`with check` clause calls `is_admin()` rather than re-deriving admin status inline. Granted by SQL only; there is no UI to promote a user, and a `with check` on the `profiles` UPDATE policy blocks a user from setting their own `is_admin`.
- `public.item_flags` — users can INSERT and SELECT their own flags; admins can SELECT and UPDATE all flags; nobody can DELETE. A partial unique index enforces at most one *open* flag per user per item, so a user can re-flag after a prior flag is resolved but not spam duplicates. Frontend: `flagService`, `FlagItemModal`, a bug-icon trigger in `ItemDetailModal`; signed-out users are redirected to `/login` before they can open the modal.
- `public.admin_item_links(uuid)` and `public.admin_delete_item(uuid, boolean)` — both `security definer`, both admin-gated, both revoked from `anon`. `admin_item_links` previews the rating/todo/flag counts a delete would cascade into. `admin_delete_item` hard-deletes: it re-counts links server-side under a `for update` row lock (closing the TOCTOU window between the preview call and the delete call), refuses without `force=true` when links exist, and writes an `admin_audit_log` row *before* the delete so an audit entry can never be lost to a mid-transaction failure. `DeleteItemDialog` requires the item's name to be typed back when links exist, on top of the server-side force flag.
- **Delete is hard, not soft.** The two options considered were a hard delete and a `deleted_at` soft-delete. Soft delete was rejected for two reasons: (1) the feature's purpose is to remove bad imports (wrong item, garbled AI extraction, duplicate) from user-facing surfaces entirely, not to hide them while they keep counting against real state; (2) items carry a `UNIQUE(topic_id, slug)` constraint, and a soft-deleted row still occupies that slug — re-adding the same item (the common case right after deleting a bad duplicate) would collide on the unique index unless the slug were also mutated on delete, which is more moving parts for less benefit than just deleting the row. Cascades (`user_ratings`, `user_todo_lists` via `ON DELETE CASCADE`; `item_flags` and `admin_rescan_proposals` deleted explicitly) mean nothing is left pointing at a row that no longer exists.
- `admin-rescan-item` Edge Function — two endpoints, preview and apply, replacing what a single-shot re-extract-and-overwrite design would have been. **Re-scan previews rather than auto-applies** because AI extraction can be wrong or drift from what's already correct in the DB (a name capitalization "fix" that isn't a fix, a stale year), and applying it unreviewed would trade one bad-data problem for another with no human in the loop. Preview stores its result as a row in `admin_rescan_proposals` (keyed to the item, with an expiry) and returns a `proposal_id`; apply loads that stored proposal by id and writes only the fields the admin selected, then deletes the proposal so it can't be replayed. **Apply reads the stored proposal instead of re-running extraction** because extraction (a Claude tool-use loop over live web search) is non-deterministic — re-extracting at apply time could silently write a different value than the one the admin reviewed and approved, which defeats the point of having a review step at all. It also doubled the Claude/Tavily cost and latency of every applied re-scan for no benefit. The one invariant this makes explicit: preview is not a pure read once `admin_rescan_proposals` exists — it writes there — but it never touches `items`, so `items.updated_at` stays put until an apply actually happens.
- `supabase/functions/_shared/{cors,slug,images,extraction}.ts` — the extraction pipeline (Tavily search + Claude tool-use loop), image download/storage, slug generation, and CORS headers, factored out of `ai-enrich-item` so `admin-rescan-item` could reuse the same extraction logic instead of forking it. A change to either shared module affects both functions; redeploy both when editing anything under `_shared/`.
- `/admin` page (`AdminPage`) — flag queue plus `AdminItemActions` (delete, re-scan), gated by `AdminRoute`. The same actions are also available inline in `ItemDetailModal` for admins. `AdminRoute` waits on both `initialized` (session known) and `profileLoading` (profile, and therefore `is_admin`, fetched) before deciding whether to redirect — deciding on `initialized` alone would flash-redirect an admin whose profile hadn't loaded yet. This gating is cosmetic UX only; every RPC and Edge Function re-checks `is_admin()` / the `is_admin` RPC server-side regardless of what the client believes.
- One dead line removed from `ai-enrich-item/index.ts`: `supabaseForCleanup = supabaseClient` was immediately overwritten by the service-role client assignment a few lines later with nothing throwable in between, so it never took effect — misleading in a security-relevant spot (a reader could think the cleanup path ran user-scoped). Redeployed as version 12.

**Breaking**: None. 239 tests pass across 25 files; production build succeeds.

**Impact**: Backend (Database, RLS, Edge Functions), Frontend (new admin surface)

**Files Changed**: `supabase/migrations/20260816181100_add_is_admin_to_profiles.sql`, `20260816182202_create_item_flags.sql`, `20260816190737_create_admin_item_functions.sql`, `20260816202107_lock_item_row_in_admin_delete.sql`, `20260816205729_create_admin_rescan_proposals.sql`, `supabase/functions/ai-enrich-item/index.ts`, `supabase/functions/admin-rescan-item/index.ts`, `supabase/functions/_shared/{cors,slug,images,extraction}.ts` (new), `frontend/src/services/flagService.ts`, `adminService.ts`, `frontend/src/components/FlagItemModal.tsx`, `AdminItemActions.tsx`, `RescanDiff.tsx`, `DeleteItemDialog.tsx`, `AdminRoute.tsx`, `frontend/src/pages/AdminPage.tsx`, `docs/admin-sql-verification.md`, `docs/context/BACKEND_CONTEXT.md`, `docs/context/FRONTEND_CONTEXT.md`, `CLAUDE.md`.

---

### [2026-08-17] Fix Silent Enrichment Status Writes, Harden RPC Surface

**What**: Three pre-existing production defects found while investigating a row-count discrepancy during Task 7, confirmed against live data and the Supabase security advisors. Unrelated to the flagging feature, fixed at the owner's request.

**Defect 1 — enrichment request status was never written.** `user_enrichment_requests` has RLS policies for INSERT and SELECT only, no UPDATE. `ai-enrich-item/index.ts` performed all status bookkeeping (`processing` → `completed`/`failed`) through the user-scoped client, so every `.update()` matched zero rows. PostgREST returns no error for an update matching nothing, and the code didn't check the result, so this failed completely silently. Live evidence: 10 rows stuck in `processing`, 12 in `failed`, zero ever reached `completed`.

This was not cosmetic: `check_enrichment_rate_limit` counts `status != 'failed'` against the daily quota, because failed attempts are meant to be free. Since the `failed` write silently no-op'd, every failed enrichment permanently burned one of the user's 5 daily requests — a user whose searches kept failing could be locked out for the rest of the day by attempts that were supposed to be free.

**Fix rejected**: adding a user-facing UPDATE policy would let a user set their own rows to `status = 'failed'` and reset their quota at will — a rate-limit bypass. Request status is server-managed state, not user data.

**Fix applied**: `ai-enrich-item/index.ts` now constructs a service-role client and uses it for every `user_enrichment_requests` UPDATE (the two `failed` paths, the `completed` path, and the outer-catch `inFlightRequestId` cleanup). The INSERT stays on the user-scoped client — its policy correctly enforces `auth.uid() = user_id`. Every update's error is now checked and logged. No other behaviour in the function changed (extraction pipeline, rate limiting, response shapes all untouched). Deployed as version 11.

The 10 historical stuck `processing` rows and 12 `failed` rows were left alone — `result_item_id` was written by the same update that silently failed, so it's null everywhere, and rewriting them would be guesswork against real user data.

**Defect 2 — mutable search_path on SECURITY DEFINER functions.** Linter flagged `function_search_path_mutable` on `check_enrichment_rate_limit`, plus four others added since the earlier `fix_function_search_path` migration: `update_user_todo_lists_updated_at`, `get_items_with_stats`, `get_items_with_stats_count`, `get_user_ratings_for_items`. All five are `SECURITY DEFINER` with a caller-controlled `search_path` — the exact exploit shape that migration was written to close. Pinned with `alter function ... set search_path = public` on each (body unchanged); verified `proconfig = {search_path=public}` and re-ran each function against live data to confirm behaviour is unchanged.

**Defect 3 — `anon` retained EXECUTE on the admin RPCs.** `revoke all ... from public` (Tasks 1 & 6) removed the `PUBLIC` grant but not Supabase's default explicit `anon` grant on new `public` functions. `is_admin`, `admin_item_links`, `admin_delete_item` all had `anon=X/postgres` in `proacl`. Not currently exploitable — `is_admin()` resolves `auth.uid()` to null for `anon` and fails closed — but there's no reason an unauthenticated caller should be able to invoke a hard-delete RPC. Revoked `anon` EXECUTE on all three. Re-verified via JWT impersonation: an authenticated non-admin still gets `42501 Admin privileges required` from the in-function check (not a permission error from the wrong layer), and the admin path still succeeds.

**Migration**: `supabase/migrations/20260817182712_harden_rpc_surface.sql`.

**Left for the owner**: the linter also reports leaked-password protection disabled (HaveIBeenPwned check). That's a Supabase Auth dashboard toggle, not code — out of scope here.

**Breaking**: None. Data untouched: `items=13`, `user_ratings=5`, `user_todo_lists=8`, `user_enrichment_requests` still 10 `processing` / 12 `failed` (unchanged, by design). 239 tests pass across 25 files.

**Impact**: Backend (Database, Edge Functions)

**Files Changed**: `supabase/functions/ai-enrich-item/index.ts`, `supabase/migrations/20260817182712_harden_rpc_surface.sql`, `docs/context/BACKEND_CONTEXT.md`.

---

### [2026-08-16] Search-First Cleanup Pass

**What**: Quality pass over the search-first branch — no behaviour changes.
- Extracted `lib/itemImage.ts` (`getItemImageUrl`); `ItemCard`, `ItemDetailModal` and `ItemSearch` had three copies of the `image_url → metadata.poster_url → metadata.image` chain.
- Extracted `lib/links.ts` (`GITHUB_REPO`, `GITHUB_REPO_URL`, `BUY_ME_A_COFFEE_URL`) out of the two components that hardcoded them.
- `GitHubStarBadge` now shares one module-level fetch promise across instances — the badge renders twice on the home page (navbar + FAQ), which doubled the calls against GitHub's 60/hr anonymous limit.
- `ItemSearch` uses the existing `useDebouncedValue` hook instead of a hand-rolled `setTimeout`; hoisted the word-boundary regex out of the sort comparator and scores each suggestion once; dropped the `flatResults` memo and its per-card `indexOf` scan in favour of a running counter; derived `highlightedSuggestion` once instead of repeating the condition.
- `SearchInput` renders "All" and the topic chips from one list; exported `CHIP_BASE` so the enrichment chip row reuses it.
- `searchService`: `escapeForIlike` became a single `replace` over a lookup table, merged the two identical empty-result guards, and removed the unused `metadataFilters` param (dead API surface — adding an optional param later is non-breaking anyway).

**Why**: Duplication introduced across a fast-moving feature branch drifts once it is touched separately. Fixing the image chain or the chip styling in one place should not require finding two more.

**Breaking**: None. 186 tests pass; the `metadataFilters` test was rewritten to cover the "no topic filter" case it was actually asserting.

**Files Changed**: `frontend/src/lib/itemImage.ts` (new), `lib/links.ts` (new), `components/ItemSearch.tsx`, `SearchInput.tsx`, `ItemCard.tsx`, `ItemDetailModal.tsx`, `GitHubStarBadge.tsx`, `BuyMeACoffeeButton.tsx`, `FaqSection.tsx`, `services/searchService.ts`, `searchService.test.ts`, `docs/ARCHITECTURE.md`, `docs/context/FRONTEND_CONTEXT.md`.

---

### [2026-08-16] Enter-Key Hint, Single-Pass Band Blur

**What**:
- `SearchInput` gained a `showEnterHint` prop: a small ⏎ Enter badge at the end of the field, plus an `aria-describedby` "Press Enter to search" for screen readers. `ItemSearch` shows it only while the typed query is long enough and not yet submitted; the badge yields the slot to the searching spinner.
- **Fixed**: the topic bands flashed at full saturation before settling. The seam-softening blur was a `backdrop-blur` overlay, and a backdrop filter is a second compositing pass over a snapshot of what sits behind it — the first painted frame shows the bands raw. Replaced with a plain `blur-[60px]` on the band container itself, which is part of the element's own paint, with the container inset negatively (`-inset-32`) so the blur's soft edges fall outside the viewport.

**Why**: With the query committed only on Enter, nothing in the UI said so — the hint is the affordance for the interaction model chosen on 2026-08-15. The band flash was the second of two separate defects in the same component; the first (z-index) was fixed earlier the same day.

**Breaking**: None.

**Files Changed**: `frontend/src/components/SearchInput.tsx`, `ItemSearch.tsx`, `ItemSearch.test.tsx`, `TopicBands.tsx`.

### [2026-08-16] Search Suggestions Restored, Poster-Shaped Cards, Topic-Band Z-Index Fix

**What**:
- **Fixed**: the topic bands flashed on load and then vanished. `TopicBands` used `-z-10`, which only stays visible while an ancestor establishes a stacking context — `PageTransition` does exactly that *during* its transform animation and stops the moment it ends, dropping the bands behind the layout's opaque background. Now `z-0`, with the home page content lifted onto `relative z-10`.
- **Typeahead suggestions are back**: up to 5 title-only matches in a dropdown while typing (200 ms debounce), via a new `nameOnly` option on `searchService.searchItems`. Arrow keys walk them, Enter opens the highlighted one, Escape dismisses. Enter with nothing highlighted still runs the full search.
- Suggestions over-fetch 20 rows and re-rank client-side (exact title → prefix → word-boundary → rest) before slicing to 5, because the server can only sort alphabetically.
- Result cards are now **2:3**, matching posters and book covers, in a 3/4/6-column grid. They were 32px-tall landscape boxes cropping the top and bottom off every image.
- Input copy: "what are you into? (press Enter)" → "What are you looking for?".

**Why**: The Enter-only search from 2026-08-15 removed the as-you-type affordance entirely; suggestions restore it for the common "I know exactly which item I want" case without bringing back the layout-shifting debounced search. Suggestions match on title only because a description hit surfaces a row whose title looks unrelated to what was typed.

**Decisions worth recording**:
- The combobox ARIA now wires to the **suggestion dropdown**, not the results grid. Two listboxes on one input is invalid, and the suggestion list is the one that behaves like a popup. Result cards became plain buttons inside `<section aria-labelledby>` — they are in-flow, tabbable content, not options.
- Both search modes share one escaped `ilike` pattern through `.or()`; the name-only case just drops the description clause, so there is no second escaping regime to keep correct.
- `TopicBands` carries a comment about the negative-z-index trap, since `-z-10` looks correct in isolation and only fails in combination with the page transition.

**Breaking**: None.

**Files Changed**: `frontend/src/components/ItemSearch.tsx`, `ItemSearch.test.tsx`, `TopicBands.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/services/searchService.ts`.

### [2026-08-15] Home Page Polish: Collapsing Hero, Result Cards, Topic-Band Background

**What**:
- Search now runs on **Enter**, not on a debounce. `ItemSearch` keeps a separate `submittedQuery`; typing changes nothing until the user commits.
- Results moved out of the absolutely-positioned dropdown and into in-flow **card sections grouped per topic** (image + title, responsive 2/3/4-column grid). Result limit raised 8 → 24.
- The hero collapses when a search is active: `ItemSearch` reports its state via a new `onActiveChange` prop, and `HomePage` animates the container's min-height (70vh → 22vh) and fades out the tagline, so the input travels upward and hands the space to the results.
- Moved the "What the heck is this?" button from the bottom-right to the top-left of the hero.
- New `TopicBands` background: six faint vertical topic-colored gradients fading out down the page, behind a blur to soften the seams.
- Custom `.custom-scrollbar` utility (`index.css`), applied to `ItemDetailModal`'s scroll container.
- FAQ copy: "What is this?" reframed around organizing tops across topics plus a to-do dimension; removed "One is cheaper for you." from "Is it free?".

**Why**: Typing-triggered search made the layout jump on every keystroke and fired a request per pause; a dropdown constrained results to a narrow list with no room for imagery. Committing on Enter makes the space reclaimed by the collapsing hero available for a proper card grid.

**Decisions worth recording**:
- The listbox/option ARIA structure was kept even though results are now a grid, so keyboard navigation and the combobox wiring survive the visual change unmodified. Escape now clears the highlight instead of closing a dropdown — there is nothing to close.
- Click-outside handling was dropped along with the dropdown; in-flow results have no reason to disappear on an outside click.
- Changing a topic chip re-runs the last **submitted** query rather than clearing results, so scoping stays a one-click refinement.

**Breaking**: None.

**Files Changed**: `frontend/src/components/ItemSearch.tsx`, `ItemSearch.test.tsx`, `TopicBands.tsx` (new), `FaqSection.tsx`, `FaqSection.test.tsx`, `ItemDetailModal.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/index.css`.

---

### [2026-08-12] Search-First Home Page: Cross-Topic Search, New FAQ, Navbar Rearrange

**What**:
- Rebuilt `HomePage` around a cross-topic search box. Removed the carousel, hero banner, and CTAs that previously buried discovery behind `/topics`.
- Rebuilt the FAQ as scroll-revealed alternating bands with new copy and a new order (`FaqSection`, exports `FAQ_ANCHOR_ID`).
- Moved the GitHub star badge to the right of the navbar and enlarged it (`GitHubStarBadge` now takes a `size` prop). Added a Buy Me a Coffee button to the navbar and repeated it in the last FAQ band (`BuyMeACoffeeButton`).

**Why**: Discovery is the product's core loop and was buried two clicks deep behind `/topics`. Search-first makes the first screen the useful one.

**Decisions worth recording**:
- `searchService.searchItems` queries PostgREST directly (`items` table, `.or()` on `name`/`description` ilike) rather than the `get_items_with_stats` RPC, because that RPC requires a `topic_id` and therefore cannot search across topics. Consequence: search results carry no rating stats, so `HomePage` fetches stats per item (via `statsService`) when opening the detail modal. Two distinct search paths now exist side by side: PostgREST for cross-topic search, the RPC for topic-scoped browsing with stats.
- ilike values are escaped, not stripped. `searchService`'s `escapeForIlike` helper wraps the value in double quotes and backslash-escapes `%`, `_`, `"`, and `\`. An earlier approach that stripped those characters was rejected because it mangled legitimate queries like "Sci-Fi (2020)".
- Search extraction split into two components rather than one: `SearchInput` (presentational, controlled, shared by `HomePage` and `TopicDetailPage`) and `ItemSearch` (home-page only — debounce, dropdown, keyboard navigation, enrichment fallback). `TopicDetailPage` drives a filtered, paginated grid through the `get_items_with_stats` RPC, which needs a `topic_id` and can't answer a cross-topic query; unifying the two would have meant rebuilding that pipeline for no user-visible gain.
- `HomePage` seeds a signed-in user's existing rating when opening an item from search results, and guards all three of its async calls (search, stats fetch, existing-rating fetch) against stale responses with a latest-request ref. This wasn't in the original plan; it was added during review so reopening an already-rated item doesn't show it as unrated.
- Buy Me a Coffee is reimplemented rather than script-embedded: the vendor script injects at its own tag position, needs an external-origin allowance, and is not unit-testable.
- Cross-topic AI enrichment asks the user which topic the item belongs to, because `ai-enrich-item` requires a `topic_id` and misclassification would write rows into the wrong topic.
- `.wrangler/` added to `.gitignore`; local Cloudflare cache artifacts had been committed by accident and were purged from the branch history.

**Breaking**: None.

**Follow-on phases**: Flagging (Phase 2) and admin review / soft delete / re-scan (Phase 3), per `docs/superpowers/specs/2026-08-09-search-first-ux-design.md`.

**Files**: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/TopicDetailPage.tsx`, `frontend/src/services/searchService.ts` (new), `frontend/src/components/SearchInput.tsx` (new), `ItemSearch.tsx` (new), `FaqSection.tsx` (new), `BuyMeACoffeeButton.tsx` (new), `GitHubStarBadge.tsx`, `.gitignore`

---

### [2026-08-06] MVP 2 Complete: Removed Curated Seed Items, Dropped Source Badge

**What**:
- Marked MVP 2 (AI-powered database growth) complete in `README.md` and `docs/ROADMAP.md` — merged its delivered scope into "current state," moved MVP 3 up as next priority.
- Deleted all 21 `source = 'seed'` rows from the production `items` table (cascaded to 10 dependent `user_ratings` and 6 `user_todo_lists` rows on those items). The database now contains only AI-generated items (8, at time of writing).
- Removed the `SOURCE_BADGES` "Curated / AI Generated / User Submitted" badge from `ItemCard` and the equivalent source badge (plus `ai_confidence` display) from `ItemDetailModal`. With every item now AI-generated, the label was redundant.

**Why**: User request — MVP 2 is done, seed/curated content no longer reflects the product (100% AI-populated database), so the "how was this added" badge stopped being useful information.

**Breaking**: Existing user ratings/watch-later entries tied to the 21 deleted seed items are gone (cascade delete). No schema change; `items.source` still accepts `'seed'` for forward-compatibility but the app no longer writes or displays it specially.

**Files**: `README.md`, `docs/ROADMAP.md`, `frontend/src/components/ItemCard.tsx`, `ItemCard.test.tsx`, `ItemDetailModal.tsx` — plus a one-off `DELETE FROM items WHERE source = 'seed'` run directly against production (not a migration, since it's data cleanup not schema).

---

### [2026-08-06] GitHub Badge Style, TODO Removal Toast, Rating Removal, Dead Watch-Later Link

**What**:
- `GitHubStarBadge` now matches the n8n-style badge: GitHub logo icon + raw star count only (no "Star" text, no star icon).
- `ProfilePage`'s `handleRemoveTodo` now shows a success toast on successful removal; previously it only surfaced errors, so a successful removal produced no feedback at all.
- Users can now remove an existing rating, not just change it. Added a remove ("X") control next to the star rating in both `ItemCard` (grid) and `ItemDetailModal`, wired to `ratingService.deleteRating`. `TopicDetailPage` recomputes community avg/count on removal (`removeItemStats`) and rolls back optimistic state on failure, mirroring the existing rate/add-to-todo pattern.
- Removed the `Link` to `/topics/:slug` wrapping item names in the Profile page's "Watch Later" section — there's no item detail page at that route, so the link went nowhere useful. Item names are now plain text.

**Why**: User-reported bugs — see task list. Silent TODO removal looked broken; ratings were a one-way action once submitted; the Watch Later link implied a destination that doesn't exist.

**Breaking**: None.

**Files**: `frontend/src/components/GitHubStarBadge.tsx`, `ItemCard.tsx`, `ItemDetailModal.tsx`, `frontend/src/pages/ProfilePage.tsx`, `TopicDetailPage.tsx`

---

### [2026-08-05] Detail Dialog Image Crop, Rating View Sync, TODO List Surface, Homepage/Footer Content

**What**:
- `LazyImage` gained an `objectFit` prop (`cover` | `contain`); `ItemDetailModal`'s hero image now uses `contain` so posters/covers aren't cropped.
- Rating an item from the `TopicDetailPage` grid (`ItemCard`) now updates the item's community avg rating/count in local state via a new `onRatingChange` callback, matching the modal's existing behavior — both entry points now keep stats in sync without a refetch.
- `ProfilePage` now has a "Watch Later" section rendering the user's pinned/TODO items (via `todoService.getAllTodos`), with a remove action. Previously there was no way to see what you'd pinned.
- Rewrote the "What is this?", "Is my data private?", and "Why does this exist?" FAQ answers on `HomePage`; added a new "Is it free?" FAQ item. Privacy answer now explicitly notes public profiles aren't implemented yet.
- Removed the duplicated "Built by a backend dev..." quote from `HomePage` (it already lives in the footer).
- Added a live GitHub star badge (`GitHubStarBadge`, fetches `api.github.com/repos/Zartof23/mytops`) to the header, and personal site / LinkedIn badges to the footer.

**Why**: User-reported UX bugs and content gaps — see task list. Users had no visibility into their TODO/pinned items, ratings didn't visibly update after submission, and FAQ copy was outdated/inaccurate about privacy and project motivation.

**Breaking**: None.

**Files**: `frontend/src/components/LazyImage.tsx`, `ItemDetailModal.tsx`, `ItemCard.tsx`, `GitHubStarBadge.tsx` (new), `Layout.tsx`, `frontend/src/pages/TopicDetailPage.tsx`, `ProfilePage.tsx`, `HomePage.tsx`

---

### [2026-04-24] Fix AI Enrichment Edge Function (Model Retirement + Parallel Tool Use)

**What**: Restored the `ai-enrich-item` Edge Function, which had been silently returning HTTP 500 since 2026-01-15.

**Root causes**:
1. **Retired model** — function was pinned to `claude-3-5-haiku-20241022`, which Anthropic retired. API returned `404 not_found_error`, which didn't match any of the OUT_OF_GAS branches and fell through to the generic 500 catch-all.
2. **Silent failure** — outer `try/catch` returned 500 without updating `user_enrichment_requests.status`. 12 rows had been stuck in `processing` since January with `error_message = NULL`, making the outage invisible.
3. **Parallel tool use (after model bump)** — Claude 4.x emits multiple `tool_use` blocks per assistant turn. Original code handled only the first via `.find()`, leaving other `tool_use` blocks without matching `tool_result` blocks → API rejected the next turn with `400 invalid_request_error`.

**Fixes**:
- Bumped model to `claude-haiku-4-5-20251001` (current Haiku).
- Outer `catch` now writes `error.name`, `error.message`, and `error.status` into `user_enrichment_requests.error_message` so failures are observable.
- Tool-use loop now uses `.filter()` + `Promise.all` to execute all parallel `tool_use` blocks and return one `tool_result` per `tool_use`. Per-tool errors are isolated with `is_error: true` so one failed search doesn't kill the whole turn.
- Saved Edge Function source to `supabase/functions/ai-enrich-item/index.ts` (was previously not in the repo — only deployed).
- Backfilled the 12 stuck `processing` rows to `failed` with an explanatory message.

**Impact**: AI enrichment works again. Future Claude/Anthropic failures will surface real diagnostics instead of a generic 500.

**Files**: `supabase/functions/ai-enrich-item/index.ts` (new in repo, deployed v9)

---

### [2026-01-15] Skills Restructure with Context Integration

**What**: Updated and created skills to use the new context file structure.

**Changes**:
- **react-specialist**: Slimmed down from 629 to 267 lines, now references `FRONTEND_CONTEXT.md` and `TESTING_CONTEXT.md`
- **backend-specialist** (NEW): Supabase backend development including database design, RLS policies, Edge Functions, migrations. References `BACKEND_CONTEXT.md`
- **seo-optimization** (NEW): SEO and web performance optimization including meta tags, structured data, Core Web Vitals, accessibility. References `DEPLOYMENT_CONTEXT.md`

**Impact**: Documentation, Developer Experience
**Files**: `.claude/skills/*/SKILL.md`

---

### [2026-01-14] Documentation Restructure for Task-Specific Context

**What**: Restructured documentation into task-specific context files for efficient AI assistance.

**Why**:
- Original CLAUDE.md was a monolithic file (~2.6k tokens) loaded on every conversation
- No way to load only relevant context for specific task types
- Documentation updates required editing multiple sections

**Changes**:
- Created `docs/context/` directory with 4 task-specific files:
  - `BACKEND_CONTEXT.md` - Database, RLS, Edge Functions, migrations
  - `FRONTEND_CONTEXT.md` - React, components, state, styling
  - `TESTING_CONTEXT.md` - Test patterns, mocks, coverage
  - `DEPLOYMENT_CONTEXT.md` - CI/CD, production, monitoring
- Slimmed CLAUDE.md to router format (~800 tokens)
- Created `docs/changelogs/` for archived entries
- Archived 2025 entries to `changelogs/2025-Q4.md`

**Impact**: Backend, Frontend, Documentation
**Files**: CLAUDE.md, docs/context/*.md, docs/changelogs/2025-Q4.md

---

### [2026-01-13] Bug Fix: Edge Function 401 Authentication Error

**What**: Fixed authentication error preventing AI enrichment from working.

**Why**: Edge function was deployed with `verify_jwt: true`, causing Supabase to reject requests before function code could handle authentication.

**Solution**: Redeployed with `verify_jwt: false`. Function has comprehensive manual auth handling.

**Impact**: Backend (Edge Functions)
**Files**: ai-enrich-item edge function (version 4)

---

### [2026-01-11] MVP 2: AI-Powered Database Enrichment

**What**: Implemented the core "self-building database" feature. When users search for items that don't exist, the system offers to search the web, extract structured data using Claude AI, and automatically add enriched items to the database.

**Why**: Core innovation of mytops - database grows organically as users search.

**How It Works**:
1. User searches for non-existent item
2. System offers "Search the Web" button
3. Claude API with tool_use calls Tavily web search
4. AI extracts structured, topic-specific metadata
5. System downloads and stores poster/cover image
6. Enriched item inserted into database

**Security & Abuse Prevention**:
- Authentication: Valid JWT required
- Rate Limiting: 5 requests/user/day
- Input Validation: 200 char max, topic validation
- Confidence Scoring: ≥0.8 auto-approve, 0.6-0.8 flagged, <0.6 rejected

**Impact**: Backend, Frontend, Database
**Files Created**:
- Database migrations for app_config, user_enrichment_requests, rate limiting
- Edge function `ai-enrich-item`
- frontend/src/services/enrichmentService.ts
- frontend/src/hooks/useEnrichment.ts
- frontend/src/components/EnrichmentPrompt.tsx

**Test Count**: 119 (was 96, +23 new tests)

---

### [2026-01-05] SEO & Performance Optimization

**What**: Comprehensive SEO infrastructure and performance optimizations.

**Why**: Application lacked basic SEO infrastructure, no build-time compression, missing accessibility labels.

**Changes**:
- Added robots.txt, sitemap.xml, site.webmanifest
- Added Open Graph and Twitter Card meta tags
- Build-time gzip/brotli compression
- Route-level code splitting for auth and detail pages
- LazyImage enhancements for CLS optimization
- Accessibility improvements (aria-labels, live regions)
- Structured data schemas (BreadcrumbList, CollectionPage)

**Impact**: Frontend, SEO, Accessibility
**Test Count**: 101 (was 96, +5 new tests)

---

### [2026-01-05] Complete Image Storage Implementation

**What**: Topics and items now have visual imagery with lazy loading.

**Why**: Database had image_url fields but no storage infrastructure.

**Changes**:
- Created `topic-images` and `item-images` storage buckets
- Fixed critical LazyImage bug (IntersectionObserver watched wrong element)
- Updated TopicsPage, ItemCard, ItemDetailModal with images
- Background image design with gradient overlays

**Impact**: Backend (Storage), Frontend (Components)

---

### [2026-01-04] Add Skeleton Loading for User Data in ItemCard

**What**: Added loading skeletons when fetching user ratings and TODO status.

**Why**: ItemCards showed empty stars and TODO buttons before data loaded, creating misleading UI.

**Solution**: Added `isUserDataLoading` prop to ItemCard with skeleton placeholders.

**Impact**: Frontend (ItemCard)

---

### [2026-01-04] Fix Topic Filter Rendering Issues

**What**: Fixed items scattering and becoming invisible during filter changes.

**Why**: StaggerContainer with dynamic key prop caused full grid remount on filter changes.

**Solution**:
- Removed key prop from grid container
- Replaced StaggerContainer with AnimatePresence mode="popLayout"
- Simpler opacity-only transitions with layout animation

**Impact**: Frontend (TopicDetailPage)

---

### [2026-01-04] Rewrite README.md with Accurate Project State

**What**: Complete rewrite of README.md to align with documentation.

**Why**: README contained false claims (AI enrichment was working), incorrect project structure, missing critical info.

**Impact**: Documentation

---

### [2026-01-03] TopicDetailPage Performance & UI Fixes

**What**: Fixed duplicate API calls and invisible items on topic pages.

**Bugs Fixed**:
1. Duplicate /topics API calls due to hasFetchedTopic ref reset
2. Duplicate /user API calls (service fetched user internally)
3. User rating not displaying after async load
4. Items invisible (opacity=0) between searches

**Impact**: Frontend (TopicDetailPage, ItemCard, statsService)

---

### [2026-01-03] Documentation Restructure (Original)

**What**: Split CLAUDE.md into focused documents.

**Why**: CLAUDE.md had grown to ~4.6k tokens with mixed concerns.

**Changes**:
- CLAUDE.md: Core reference with current E2E flows
- docs/DEVELOPMENT_GUIDELINES.md: Mandatory standards
- docs/ROADMAP.md: Future MVPs
- docs/ARCHITECTURE.md: Technical details

**Impact**: Documentation

---

### [2026-01-02] Modal Integration & Final Wiring

**What**: Connected ItemDetailModal to TopicDetailPage.

**Features**:
- Clickable item cards open detail modal
- Rating in modal with optimistic updates
- TODO list management from modal
- Pre-fetched data for instant modal display

**Impact**: Frontend (TopicDetailPage)

---

### [2026-01-01] Major Feature Update: Server-Side Filtering, Pagination, TODO Lists

**What**: Server-side filtering with PostgreSQL functions, pagination, and TODO lists.

**Database Changes**:
- `user_todo_lists` table for per-topic watchlists
- `get_items_with_stats()` function for server-side filtering
- `get_user_ratings_for_items()` function for batch rating fetches

**Frontend Changes**:
- Server-side filtering (All, 5★, 4★+, New)
- Pagination (24 items/page)
- TODO service and UI integration
- Item detail modal with topic-specific metadata

**Impact**: Backend (Database), Frontend (TopicDetailPage, ItemCard)

---

### [2026-01-01] Bug Fixes and Testing Expansion

**What**: Fixed several issues from UX overhaul, added 46 new tests.

**Bugs Fixed**:
1. StarRating half-star display (fractional ratings)
2. TopicDetailPage duplicate API calls
3. TopicDetailPage filter logic (items without ratings)
4. ProfilePage double fetch
5. ItemCard duplicate rating fetch
6. Deprecated React.ElementRef

**Test Count**: 96 (was 50, +46 new tests)

---

### [2026-01-01] Complete UX Overhaul

**What**: Comprehensive UX redesign with Framer Motion animations, public profiles, and SEO.

**Design Philosophy**: "Notion's clarity meets Letterboxd's soul, built by someone who'd rather be writing SQL."

**Key Improvements**:
- Micro-interactions using Framer Motion
- Page transitions with fade + slide effects
- SEO optimization with React 19 native meta tags
- Public shareable profiles at `/@username`
- Community stats on items
- Filter pills for topic browsing

**Build Size**: 680KB (increased due to Framer Motion)

---

**Last updated**: 2026-01-15
