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
