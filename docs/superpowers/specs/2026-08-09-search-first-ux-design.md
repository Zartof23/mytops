# Search-First UX — Design (Phase 1 of 3)

Date: 2026-08-09
Status: Approved for planning

## Context

mytops currently opens on a marketing-style home page: hero banner, auto-rotating
carousel of popular items, two CTA buttons, and an accordion FAQ. Discovery happens
only after the user navigates to `/topics` and then into a topic page, where the
search box lives.

This inverts that. Search becomes the product's front door and works across all
topics by default. The personal dashboard path is explicitly not the focus of this
phase.

## Scope

This spec covers Phase 1 only:

1. Home page rebuilt around a single search input
2. `<ItemSearch>` extracted from `TopicDetailPage` and reused on both pages
3. Cross-topic search with optional topic narrowing
4. Navbar: GitHub star badge moved right and enlarged, Buy Me a Coffee added
5. FAQ rebuilt as scroll-revealed alternating bands with new copy and order

Two follow-on phases have their own specs and are **out of scope here**:

- **Phase 2 — Flagging.** `item_flags` table, bug button in the item detail modal.
- **Phase 3 — Admin.** `profiles.is_admin`, `items.deleted_at` soft delete,
  `/admin` flag review table, `admin-rescan-item` edge function.

Also out of scope, but designed around (see Forward Compatibility): metadata-based
search, and the user dashboard restyle.

## Non-Goals

- No new routes. Search results never navigate to a `/search` page.
- No changes to the `ai-enrich-item` edge function. It keeps receiving an explicit
  `topic_id`.
- `/topics` and topic detail pages are not removed; they are de-emphasized in
  prominence only.
- No pagination or filter UI on the home page.

## Architecture

### New: `frontend/src/components/ItemSearch.tsx`

`TopicDetailPage.tsx` is 825 lines and inlines debouncing, querying, empty-state
selection, and the enrichment trigger. Both pages now need that behavior, so it
moves into one component with a single job: **take a query and a topic scope,
render matches, and offer AI enrichment when there are none.**

```ts
interface ItemSearchProps {
  /** Locks search to one topic (topic pages). Undefined = user-selectable scope. */
  topicId?: string
  /** Show the all/per-topic chip row. False on topic pages. */
  showTopicChips?: boolean
  /** Rendered when the query is empty. */
  placeholder?: string
  onSelectItem: (item: ItemWithStats) => void
}
```

Responsibilities it owns: the input, the debounce (`useDebouncedValue`, existing
300ms constant), calling `searchService.searchItems`, the results dropdown, the
topic chip row, empty/loading states, and the enrichment flow.

Responsibilities it does **not** own: what happens when an item is picked. The
parent decides — both current parents open `ItemDetailModal`, but the component
does not know that.

`TopicDetailPage` keeps its own concerns (filters, pagination, the item grid,
TODO list) and delegates only the search box. Its inline search state, debounce,
`getEmptyStateConfig`, and `shouldShowEnrichment` helpers move into `ItemSearch`
or its test file and are deleted from the page.

### New: `frontend/src/services/searchService.ts`

```ts
searchItems(params: {
  query: string
  topicId?: string
  limit?: number            // default 8
  metadataFilters?: Record<string, unknown>  // Phase-future, ignored for now
}): Promise<{ data: ItemWithStats[]; error: Error | null }>
```

Queries `items` joined to `topics`, name/description ILIKE match, ordered by
rating count then name. `metadataFilters` is accepted and ignored in this phase so
that adding metadata search later does not change the call signature at any call
site.

Results carry their topic so the dropdown can group by it.

### Rewritten: `frontend/src/pages/HomePage.tsx`

Top-to-bottom:

1. **Tagline** — two lines, centered:
   - "Search anything. Movies, books, games, ramen shops."
   - "If it's not here yet, AI finds it and adds it — for everyone."
2. **`<ItemSearch showTopicChips />`** — the visual center of the page.
3. **"What the heck is this?" button** — bottom corner of the first viewport,
   rotated ~-4deg, scrolls smoothly to the FAQ section.
4. **`<FaqSection />`** — below the fold.

The carousel, `statsService.getPopularItems` call, hero banner, and both CTA
buttons are removed. `getPopularItems` stays in the service (used elsewhere);
only this page stops calling it.

### New: `frontend/src/components/FaqSection.tsx`

Five full-width bands, alternating left / right / left / right / left. Each
animates in on scroll via framer-motion `whileInView` with `once: true`, and
renders statically when `useReducedMotion()` is true.

Order and copy (brand voice — "backend developer who reluctantly built a
frontend"):

1. **What is this?** — One search box for everything you like. Movies, series,
   books, anime, games, restaurants. Find a thing, rate it, it's yours. If it's
   not in the database, AI goes and finds it, and then it's in there permanently
   for everyone.
2. **What can I track?** — Six topics today: movies, series, books, anime, games,
   restaurants. More when someone asks for one convincingly enough.
3. **Why does this exist?** — I wanted one organized, private list of my favorites
   across everything, and nothing covered all of it — especially the
   unconventional and indie picks. So the database gets built by AI, on demand,
   as people search. It grows because you use it.
4. **Is my data private?** — Your ratings are yours and private by default. I
   don't sell anything to anyone. Public profiles are planned, opt-in, and not
   built yet.
5. **Is it free?** — Yes. I pay for the AI tokens. If you want to help, star the
   repo or buy me a coffee. Both work. One is cheaper for you.
   Renders the GitHub link and the Buy Me a Coffee button inline.

### New: `frontend/src/components/BuyMeACoffeeButton.tsx`

Our own markup — the vendor `<script>` widget is not used: it injects at the
script tag's DOM position (unreliable in an SPA), requires a CSP allowance for
`cdnjs.buymeacoffee.com`, and cannot be unit tested.

An anchor to `https://buymeacoffee.com/robertocalo`, `target="_blank"`,
`rel="noopener noreferrer"`, background `#FFDD00`, black text and 1px black
outline, ☕ emoji, "Buy me a coffee" in a cursive stack
(`Cookie, 'Brush Script MT', cursive`) — no external font CDN, so it degrades to
a system cursive rather than pulling from Google Fonts. Accepts a `size` prop
so the navbar and FAQ variants share one implementation.

### Modified: `frontend/src/components/Layout.tsx`

`<GitHubStarBadge />` moves out of the left wordmark group into the right-hand
`<nav>`, placed after the auth buttons and before the theme toggle separator, with
increased internal padding and a slightly larger label. `<BuyMeACoffeeButton />`
sits immediately next to it. On small screens both collapse to icon-only.

## Search Behavior

| State | Result |
|---|---|
| Query below 2 chars | Dropdown closed |
| Debounced query, matches found | Dropdown, max 8, grouped by topic when scope is "all" |
| Item clicked | Parent opens `ItemDetailModal` |
| Enter pressed | Dropdown expands into an inline list on the same page |
| Escape / click outside | Dropdown closes, query retained |
| No matches, logged out | "Nothing here yet. Log in and AI will go find it." + login link |
| No matches, logged in, chip active | Enrichment prompt for that topic, one click |
| No matches, logged in, scope "all" | "Not in here yet. Which topic is it?" + 6 topic chips → enrich |

The "which topic is it?" step exists because `ai-enrich-item` requires a
`topic_id`; asking the user is one click and avoids AI topic misclassification
writing rows into the wrong topic.

Keyboard: arrow keys move through results, Enter selects the highlighted one,
`role="listbox"`/`option` semantics, `aria-activedescendant` on the input.

## Forward Compatibility

- **Metadata search.** `items.metadata` is already `jsonb` and `topics.schema_template`
  already describes per-topic fields. `searchItems` accepts `metadataFilters` from
  day one, and `ItemSearch` owns the input, so the future filter UI has exactly
  one place to live.
- **Dashboard restyle.** Nothing in this phase touches `ProfilePage`. Extracting
  `ItemSearch` means a future dashboard search reuses the same component.

## Testing

- `searchService.test.ts` — query building with and without `topicId`, limit,
  error propagation, `metadataFilters` accepted and ignored.
- `ItemSearch.test.tsx` — debounce, dropdown open/close, grouping, keyboard
  navigation, and each row of the search-behavior table above.
- `FaqSection.test.tsx` — five bands render in the specified order, alternation
  classes, reduced-motion path renders content without animation.
- `BuyMeACoffeeButton.test.tsx` — correct href, `rel`, external-link a11y label.
- `HomePage.test.tsx` — new; tagline present, search rendered, no carousel, the
  "What the heck is this?" button targets the FAQ anchor.
- `TopicDetailPage` existing tests updated for the delegated search box; its
  filter/pagination/TODO coverage must not regress.

## Risks

- **Regression in topic-page search.** The extraction is the riskiest change here.
  Mitigation: port the existing empty-state logic verbatim into `ItemSearch`
  along with its tests before changing any behavior.
- **Perceived feature loss.** The carousel was the only social-proof signal on the
  home page. Accepted: search-first is the point, and popular items remain
  reachable through topic pages.

## Documentation Updates

`docs/CHANGELOG.md`, `docs/context/FRONTEND_CONTEXT.md` (new components and the
search service), `docs/ARCHITECTURE.md` (home page flow), and `CLAUDE.md`
capabilities list.
