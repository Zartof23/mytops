# Search-First UX Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the marketing-style home page with a cross-topic search box, rebuild the FAQ as scroll-revealed bands, and move the GitHub badge plus a new Buy Me a Coffee button to the right of the navbar.

**Architecture:** A new `searchService` queries `items` with an embedded `topics` join (PostgREST, not the topic-scoped `get_items_with_stats` RPC, which cannot search across topics). A presentational `SearchInput` is shared by the home page and the topic page; a home-only `ItemSearch` composes it with debounce, a results dropdown, and the existing AI enrichment flow. `TopicDetailPage`'s query pipeline is deliberately untouched.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, framer-motion, Zustand, Supabase JS, Vitest + React Testing Library.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-08-09-search-first-ux-design.md`. Read it before starting.
- Work from `frontend/`. Tests: `npm test -- --run`. Build: `npm run build`. Both must pass before every commit.
- No new routes. No changes to `supabase/` in this phase. No changes to the `ai-enrich-item` edge function.
- No external origins beyond those already used (`api.github.com`). No Google Fonts, no `cdnjs.buymeacoffee.com`.
- Buy Me a Coffee URL is exactly `https://buymeacoffee.com/robertocalo`. Colors: background `#FFDD00`, text `#000000`, 1px outline `#000000`. Font stack: `Cookie, 'Brush Script MT', cursive`.
- GitHub repo constant already exists as `Zartof23/mytops` in `GitHubStarBadge.tsx`. Do not duplicate it.
- Search debounce is 300ms, from the existing `useDebouncedValue` in `frontend/src/lib/hooks.ts`.
- Every animated component must render its content statically when `useReducedMotion()` returns true.
- Import alias `@/` maps to `frontend/src/`. Follow the existing mixed convention: `@/components/ui/*` for shadcn, relative paths for local services/stores.
- Tests import `render` from `../test/utils` (wraps `BrowserRouter` + `TooltipProvider`), never directly from `@testing-library/react`.
- Brand voice: dry, self-deprecating, no marketing language. Copy in this plan is final — use it verbatim.

---

## File Structure

**Create:**
- `frontend/src/services/searchService.ts` — cross-topic item search + topic list
- `frontend/src/services/searchService.test.ts`
- `frontend/src/components/SearchInput.tsx` — presentational input + topic chips
- `frontend/src/components/SearchInput.test.tsx`
- `frontend/src/components/ItemSearch.tsx` — home-page search behavior + dropdown + enrichment
- `frontend/src/components/ItemSearch.test.tsx`
- `frontend/src/components/BuyMeACoffeeButton.tsx`
- `frontend/src/components/BuyMeACoffeeButton.test.tsx`
- `frontend/src/components/FaqSection.tsx`
- `frontend/src/components/FaqSection.test.tsx`
- `frontend/src/pages/HomePage.test.tsx`

**Modify:**
- `frontend/src/pages/HomePage.tsx` — full rewrite
- `frontend/src/components/Layout.tsx:42-80` — navbar rearrangement
- `frontend/src/components/GitHubStarBadge.tsx:44-52` — larger padding, `size` prop
- `frontend/src/pages/TopicDetailPage.tsx:660-690` — swap search JSX for `<SearchInput>`
- `docs/CHANGELOG.md`, `docs/context/FRONTEND_CONTEXT.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`

---

## Task 1: searchService

**Files:**
- Create: `frontend/src/services/searchService.ts`
- Test: `frontend/src/services/searchService.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`; `Item`, `Topic` from `../types`.
- Produces:
  - `type SearchResultItem = Item & { topic: Topic }`
  - `searchService.searchItems(params: SearchItemsParams): Promise<{ data: SearchResultItem[]; error: Error | null }>`
  - `searchService.listTopics(): Promise<{ data: Topic[]; error: Error | null }>`
  - `interface SearchItemsParams { query: string; topicId?: string; limit?: number; metadataFilters?: Record<string, unknown> }`
  - `export const MIN_QUERY_LENGTH = 2`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/services/searchService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchService, MIN_QUERY_LENGTH } from './searchService'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

/** Builds a chainable PostgREST mock whose terminal `limit` resolves. */
function mockQuery(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result)
  }
  vi.mocked(supabase.from).mockReturnValue(chain as never)
  return chain
}

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchItems', () => {
    it('returns empty data without querying when the query is too short', async () => {
      const result = await searchService.searchItems({ query: 'a' })

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('trims the query before measuring its length', async () => {
      const result = await searchService.searchItems({ query: '  a  ' })

      expect(result.data).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('queries items with an embedded topic join and an ilike filter', async () => {
      const items = [{ id: 'i1', name: 'Dune', topic: { id: 't1', slug: 'books' } }]
      const chain = mockQuery({ data: items, error: null })

      const result = await searchService.searchItems({ query: 'Dune' })

      expect(supabase.from).toHaveBeenCalledWith('items')
      expect(chain.select).toHaveBeenCalledWith('*, topic:topics(*)')
      expect(chain.or).toHaveBeenCalledWith('name.ilike.%Dune%,description.ilike.%Dune%')
      expect(result.data).toEqual(items)
      expect(result.error).toBeNull()
    })

    it('escapes commas and percent signs in the query', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'a,b%c' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike.%a b c%,description.ilike.%a b c%'
      )
    })

    it('scopes to a topic when topicId is given', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'Dune', topicId: 't1' })

      expect(chain.eq).toHaveBeenCalledWith('topic_id', 't1')
    })

    it('does not scope to a topic when topicId is omitted', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'Dune' })

      expect(chain.eq).not.toHaveBeenCalled()
    })

    it('defaults the limit to 8 and honours an override', async () => {
      const chain = mockQuery({ data: [], error: null })
      await searchService.searchItems({ query: 'Dune' })
      expect(chain.limit).toHaveBeenCalledWith(8)

      const chain2 = mockQuery({ data: [], error: null })
      await searchService.searchItems({ query: 'Dune', limit: 20 })
      expect(chain2.limit).toHaveBeenCalledWith(20)
    })

    it('accepts and ignores metadataFilters', async () => {
      const chain = mockQuery({ data: [], error: null })

      const result = await searchService.searchItems({
        query: 'Dune',
        metadataFilters: { year: 1965 }
      })

      expect(result.error).toBeNull()
      expect(chain.eq).not.toHaveBeenCalled()
    })

    it('returns the error and empty data when the query fails', async () => {
      mockQuery({ data: null, error: new Error('boom') })

      const result = await searchService.searchItems({ query: 'Dune' })

      expect(result.data).toEqual([])
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('boom')
    })

    it('exports a minimum query length of 2', () => {
      expect(MIN_QUERY_LENGTH).toBe(2)
    })
  })

  describe('listTopics', () => {
    it('returns topics ordered by name', async () => {
      const topics = [{ id: 't1', name: 'Anime' }]
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: topics, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(chain as never)

      const result = await searchService.listTopics()

      expect(supabase.from).toHaveBeenCalledWith('topics')
      expect(chain.order).toHaveBeenCalledWith('name')
      expect(result.data).toEqual(topics)
      expect(result.error).toBeNull()
    })

    it('returns empty data on error', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('nope') })
      }
      vi.mocked(supabase.from).mockReturnValue(chain as never)

      const result = await searchService.listTopics()

      expect(result.data).toEqual([])
      expect(result.error?.message).toBe('nope')
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/services/searchService.test.ts`
Expected: FAIL — cannot resolve `./searchService`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/services/searchService.ts`:

```ts
import { supabase } from '../lib/supabase'
import type { Item, Topic } from '../types'

/** An item together with the topic it belongs to. */
export type SearchResultItem = Item & { topic: Topic }

export interface SearchItemsParams {
  query: string
  /** Restrict to a single topic. Omit to search every topic. */
  topicId?: string
  /** Maximum results. Defaults to 8 (the dropdown cap). */
  limit?: number
  /**
   * Reserved for metadata-based search. Accepted and ignored today so that
   * adding it later does not change this signature at any call site.
   */
  metadataFilters?: Record<string, unknown>
}

/** Queries shorter than this never hit the network. */
export const MIN_QUERY_LENGTH = 2

const DEFAULT_LIMIT = 8

/**
 * Neutralise characters that carry meaning inside a PostgREST `or` filter.
 * Commas separate conditions and `%` is the wildcard, so a raw user query
 * containing either would change the shape of the request.
 */
function sanitizeForIlike(query: string): string {
  return query.replace(/[,%()]/g, ' ')
}

/**
 * Cross-topic search over the item catalogue.
 *
 * Deliberately does not use the `get_items_with_stats` RPC: that function
 * requires a topic id and so cannot answer an "all topics" query. Results
 * therefore carry no rating stats — fetch those per item with
 * `statsService.getItemStats` when opening a detail view.
 */
export const searchService = {
  async searchItems(params: SearchItemsParams): Promise<{
    data: SearchResultItem[]
    error: Error | null
  }> {
    const { query, topicId, limit = DEFAULT_LIMIT } = params
    const trimmed = query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { data: [], error: null }
    }

    try {
      const pattern = `%${sanitizeForIlike(trimmed)}%`

      let request = supabase
        .from('items')
        .select('*, topic:topics(*)')
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)

      if (topicId) {
        request = request.eq('topic_id', topicId)
      }

      const { data, error } = await request.order('name').limit(limit)

      if (error) throw error

      return { data: (data ?? []) as SearchResultItem[], error: null }
    } catch (error) {
      return { data: [], error: error as Error }
    }
  },

  /** All topics, alphabetical. Used for the search scope chips. */
  async listTopics(): Promise<{ data: Topic[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name')

      if (error) throw error

      return { data: (data ?? []) as Topic[], error: null }
    } catch (error) {
      return { data: [], error: error as Error }
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/services/searchService.test.ts`
Expected: PASS, 12 tests.

Note: the `sanitizeForIlike` test expects `a,b%c` → `a b c`. If the ordering of
`.or()` versus `.eq()` in your implementation differs from the mock's
`mockReturnThis` chain, the assertions still hold because every method returns
the same object.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/searchService.ts frontend/src/services/searchService.test.ts
git commit -m "feat: add cross-topic searchService"
```

---

## Task 2: SearchInput component

**Files:**
- Create: `frontend/src/components/SearchInput.tsx`
- Test: `frontend/src/components/SearchInput.test.tsx`

**Interfaces:**
- Consumes: `Input` from `@/components/ui/input`; `Search`, `Loader2` from `lucide-react`; `Topic` from `@/types`.
- Produces: `<SearchInput>` with props exactly as in the `SearchInputProps` interface below. Used by Task 3 (`ItemSearch`) and Task 8 (`TopicDetailPage`).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/SearchInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../test/utils'
import { SearchInput } from './SearchInput'
import type { Topic } from '@/types'

const topics = [
  { id: 't1', name: 'Movies', slug: 'movies', icon: '🎬' },
  { id: 't2', name: 'Books', slug: 'books', icon: '📚' }
] as Topic[]

describe('SearchInput', () => {
  it('renders as a controlled input', () => {
    render(
      <SearchInput
        value="dune"
        onChange={vi.fn()}
        placeholder="search anything..."
        ariaLabel="Search everything"
      />
    )

    expect(screen.getByLabelText('Search everything')).toHaveValue('dune')
  })

  it('calls onChange with the new value', () => {
    const onChange = vi.fn()
    render(
      <SearchInput
        value=""
        onChange={onChange}
        placeholder="search anything..."
        ariaLabel="Search everything"
      />
    )

    fireEvent.change(screen.getByLabelText('Search everything'), {
      target: { value: 'akira' }
    })

    expect(onChange).toHaveBeenCalledWith('akira')
  })

  it('shows a busy status only while searching', () => {
    const { rerender } = render(
      <SearchInput value="d" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <SearchInput value="d" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" isSearching />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders no chip row when topics are omitted', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" />)

    expect(screen.queryByRole('group', { name: 'Search scope' })).not.toBeInTheDocument()
  })

  it('renders an "All" chip plus one per topic', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId={null}
        onTopicChange={vi.fn()}
      />
    )

    const group = screen.getByRole('group', { name: 'Search scope' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search all topics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search Movies only' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search Books only' })).toBeInTheDocument()
  })

  it('marks the active chip as pressed', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId="t1"
        onTopicChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Search Movies only' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Search all topics' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('reports null when the All chip is picked and the id otherwise', () => {
    const onTopicChange = vi.fn()
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId="t1"
        onTopicChange={onTopicChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search all topics' }))
    expect(onTopicChange).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Search Books only' }))
    expect(onTopicChange).toHaveBeenCalledWith('t2')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/components/SearchInput.test.tsx`
Expected: FAIL — cannot resolve `./SearchInput`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/SearchInput.tsx`:

```tsx
import { useCallback, useId } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/types'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Accessible name for the input. */
  ariaLabel: string
  /** Shows an inline spinner with a polite live region. */
  isSearching?: boolean
  /** Scope chips. Omit entirely to hide the chip row. */
  topics?: Topic[]
  /** Currently selected scope. `null` means "all topics". */
  activeTopicId?: string | null
  onTopicChange?: (topicId: string | null) => void
  /** Extra classes for the wrapping element. */
  className?: string
  /** Larger styling for the home page hero. */
  size?: 'default' | 'hero'
}

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary'

/**
 * Presentational search field with an optional topic scope chip row.
 *
 * Holds no query state and performs no fetching — the parent owns both. This is
 * what lets the home page (dropdown results) and the topic page (paginated grid)
 * share one input without sharing a results pipeline.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  isSearching = false,
  topics,
  activeTopicId = null,
  onTopicChange,
  className = '',
  size = 'default'
}: SearchInputProps) {
  const inputId = useId()

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value)
    },
    [onChange]
  )

  const showChips = Boolean(topics && topics.length > 0 && onTopicChange)

  return (
    <div className={className}>
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {ariaLabel}
        </label>
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${
            size === 'hero' ? 'h-5 w-5' : 'h-4 w-4'
          }`}
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          aria-label={ariaLabel}
          className={size === 'hero' ? 'h-14 pl-11 text-base' : 'h-10 pl-9'}
        />
        {isSearching && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Searching...</span>
          </span>
        )}
      </div>

      {showChips && (
        <div
          role="group"
          aria-label="Search scope"
          className="mt-3 flex flex-wrap justify-center gap-2"
        >
          <button
            type="button"
            onClick={() => onTopicChange?.(null)}
            aria-pressed={activeTopicId === null}
            aria-label="Search all topics"
            className={`${CHIP_BASE} ${
              activeTopicId === null
                ? 'bg-foreground text-background border-foreground'
                : 'hover:bg-muted'
            }`}
          >
            All
          </button>
          {topics?.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onTopicChange?.(topic.id)}
              aria-pressed={activeTopicId === topic.id}
              aria-label={`Search ${topic.name} only`}
              className={`${CHIP_BASE} ${
                activeTopicId === topic.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {topic.icon && <span aria-hidden="true">{topic.icon}</span>}
              {topic.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/components/SearchInput.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SearchInput.tsx frontend/src/components/SearchInput.test.tsx
git commit -m "feat: add shared SearchInput component"
```

---

## Task 3: ItemSearch component

**Files:**
- Create: `frontend/src/components/ItemSearch.tsx`
- Test: `frontend/src/components/ItemSearch.test.tsx`

**Interfaces:**
- Consumes: `searchService.searchItems`, `searchService.listTopics`, `MIN_QUERY_LENGTH`, `SearchResultItem` (Task 1); `<SearchInput>` (Task 2); `useDebouncedValue` from `../lib/hooks`; `useAuthStore` from `../store/authStore`; `EnrichmentPrompt` from `./EnrichmentPrompt` (existing, props: `searchQuery`, `topicSlug`, `topicId`, `topicName`, `onEnrichmentComplete`, `onCancel`).
- Produces: `<ItemSearch onSelectItem={(item: SearchResultItem) => void} />`. Consumed by Task 7 (`HomePage`).

**Behavior contract** (from the spec's search-behavior table):

| State | Result |
|---|---|
| Trimmed query below `MIN_QUERY_LENGTH` | dropdown closed |
| Matches found | dropdown, grouped by topic when scope is "all" |
| Item clicked or Enter on a highlighted row | `onSelectItem(item)` |
| ArrowDown / ArrowUp | move highlight, wrapping |
| Escape | close dropdown, keep the query |
| No matches, logged out | "Nothing here yet." + login link |
| No matches, logged in, chip active | `EnrichmentPrompt` for that topic |
| No matches, logged in, scope "all" | "Not in here yet. Which topic is it?" + topic buttons |

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ItemSearch.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/utils'
import { ItemSearch } from './ItemSearch'
import { searchService } from '../services/searchService'
import { useAuthStore } from '../store/authStore'

vi.mock('../services/searchService', () => ({
  MIN_QUERY_LENGTH: 2,
  searchService: {
    searchItems: vi.fn(),
    listTopics: vi.fn()
  }
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
}))

vi.mock('./EnrichmentPrompt', () => ({
  EnrichmentPrompt: ({ topicName }: { topicName: string }) => (
    <div data-testid="enrichment-prompt">{topicName}</div>
  )
}))

const topics = [
  { id: 't1', name: 'Movies', slug: 'movies', icon: '🎬' },
  { id: 't2', name: 'Books', slug: 'books', icon: '📚' }
]

const results = [
  { id: 'i1', name: 'Dune', topic: topics[1] },
  { id: 'i2', name: 'Dune (2021)', topic: topics[0] }
]

function setAuth(user: { id: string } | null) {
  vi.mocked(useAuthStore).mockReturnValue({ user } as never)
}

async function type(value: string) {
  fireEvent.change(screen.getByLabelText('Search everything'), { target: { value } })
}

describe('ItemSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setAuth({ id: 'u1' })
    vi.mocked(searchService.listTopics).mockResolvedValue({ data: topics as never, error: null })
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: results as never, error: null })
  })

  it('does not search for queries shorter than the minimum', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('d')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(searchService.searchItems).not.toHaveBeenCalled()
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('searches after the debounce and shows results grouped by topic', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    expect(searchService.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dune', topicId: undefined })
    )
    expect(screen.getByText('Books')).toBeInTheDocument()
    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('scopes the search when a topic chip is active', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))

    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(searchService.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune', topicId: 't1' })
      )
    })
  })

  it('calls onSelectItem when a result is clicked', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => screen.getByRole('listbox'))
    fireEvent.click(screen.getByRole('option', { name: /Dune \(2021\)/ }))

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('moves the highlight with arrow keys and selects with Enter', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    await type('dune')
    vi.advanceTimersByTime(400)
    await waitFor(() => screen.getByRole('listbox'))

    const input = screen.getByLabelText('Search everything')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('closes the dropdown on Escape but keeps the query', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('dune')
    vi.advanceTimersByTime(400)
    await waitFor(() => screen.getByRole('listbox'))

    fireEvent.keyDown(screen.getByLabelText('Search everything'), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search everything')).toHaveValue('dune')
  })

  it('prompts a logged-out user to log in when nothing matches', async () => {
    setAuth(null)
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Log in/ })).toHaveAttribute('href', '/login')
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()
  })

  it('asks which topic it is when nothing matches an all-topics search', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByText(/Which topic is it/)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to Books' }))
    expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Books')
  })

  it('skips the topic question when a chip is already active', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))

    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Movies')
    })
    expect(screen.queryByText(/Which topic is it/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/components/ItemSearch.test.tsx`
Expected: FAIL — cannot resolve `./ItemSearch`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/ItemSearch.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDebouncedValue } from '../lib/hooks'
import { useAuthStore } from '../store/authStore'
import {
  searchService,
  MIN_QUERY_LENGTH,
  type SearchResultItem
} from '../services/searchService'
import { SearchInput } from './SearchInput'
import { EnrichmentPrompt } from './EnrichmentPrompt'
import { Card } from '@/components/ui/card'
import type { Item, Topic } from '@/types'

const SEARCH_DEBOUNCE_MS = 300
const RESULT_LIMIT = 8

interface ItemSearchProps {
  onSelectItem: (item: SearchResultItem) => void
}

/**
 * Cross-topic search with a results dropdown and AI enrichment fallback.
 *
 * Owns the query, the debounce, the fetch and the dropdown. It does not decide
 * what happens when a result is chosen — the parent does, via `onSelectItem`.
 */
export function ItemSearch({ onSelectItem }: ItemSearchProps) {
  const { user } = useAuthStore()

  const [topics, setTopics] = useState<Topic[]>([])
  const [query, setQuery] = useState('')
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  /** Topic chosen in the "which topic is it?" step. */
  const [enrichTopicId, setEnrichTopicId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const trimmedQuery = debouncedQuery.trim()
  const isQueryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH

  // Load topics once for the scope chips and the enrichment question.
  useEffect(() => {
    let cancelled = false

    searchService.listTopics().then(({ data }) => {
      if (!cancelled) setTopics(data)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Run the search whenever the debounced query or the scope changes.
  useEffect(() => {
    if (!isQueryLongEnough) {
      setResults([])
      setHasSearched(false)
      setIsOpen(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    searchService
      .searchItems({
        query: trimmedQuery,
        topicId: activeTopicId ?? undefined,
        limit: RESULT_LIMIT
      })
      .then(({ data }) => {
        if (cancelled) return
        setResults(data)
        setHasSearched(true)
        setIsOpen(true)
        setHighlightIndex(-1)
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [trimmedQuery, isQueryLongEnough, activeTopicId])

  // Reset the enrichment topic choice whenever the question changes.
  useEffect(() => {
    setEnrichTopicId(null)
  }, [trimmedQuery, activeTopicId])

  // Close the dropdown when focus leaves the component.
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  /** Results in display order, grouped by topic when the scope is "all". */
  const groups = useMemo(() => {
    const byTopic = new Map<string, { topic: Topic; items: SearchResultItem[] }>()

    for (const item of results) {
      const existing = byTopic.get(item.topic.id)
      if (existing) {
        existing.items.push(item)
      } else {
        byTopic.set(item.topic.id, { topic: item.topic, items: [item] })
      }
    }

    return [...byTopic.values()]
  }, [results])

  /** Flattened display order, so arrow keys match what the user sees. */
  const flatResults = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  )

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setIsOpen(false)
      onSelectItem(item)
    },
    [onSelectItem]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen || flatResults.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightIndex((prev) => (prev + 1) % flatResults.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightIndex((prev) =>
          prev <= 0 ? flatResults.length - 1 : prev - 1
        )
      } else if (event.key === 'Enter') {
        if (highlightIndex >= 0) {
          event.preventDefault()
          handleSelect(flatResults[highlightIndex])
        }
      } else if (event.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [isOpen, flatResults, highlightIndex, handleSelect]
  )

  const handleEnrichmentComplete = useCallback(
    (item: Item) => {
      const topic = topics.find((candidate) => candidate.id === item.topic_id)
      if (topic) {
        handleSelect({ ...item, topic })
      }
    },
    [topics, handleSelect]
  )

  const handleEnrichmentCancel = useCallback(() => {
    setQuery('')
    setEnrichTopicId(null)
  }, [])

  const noMatches = isQueryLongEnough && hasSearched && !isSearching && results.length === 0
  const enrichTopic = topics.find(
    (topic) => topic.id === (activeTopicId ?? enrichTopicId)
  )

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} className="relative w-full">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="what are you into?"
        ariaLabel="Search everything"
        isSearching={isSearching}
        size="hero"
        topics={topics}
        activeTopicId={activeTopicId}
        onTopicChange={setActiveTopicId}
      />

      {isOpen && flatResults.length > 0 && (
        <Card className="absolute left-0 right-0 top-16 z-40 max-h-96 overflow-y-auto p-2 text-left shadow-lg">
          <ul role="listbox" aria-label="Search results">
            {groups.map((group) => (
              <li key={group.topic.id}>
                {activeTopicId === null && (
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group.topic.name}
                  </p>
                )}
                <ul>
                  {group.items.map((item) => {
                    const index = flatResults.indexOf(item)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === highlightIndex}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setHighlightIndex(index)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                            index === highlightIndex ? 'bg-muted' : ''
                          }`}
                        >
                          {item.topic.icon && (
                            <span aria-hidden="true">{item.topic.icon}</span>
                          )}
                          <span className="truncate">{item.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {noMatches && !user && (
        <Card className="mt-4 p-4 text-center text-sm text-muted-foreground">
          <p>Nothing here yet.</p>
          <p>
            <Link to="/login" className="underline">
              Log in
            </Link>{' '}
            and AI will go find it.
          </p>
        </Card>
      )}

      {noMatches && user && !enrichTopic && (
        <Card className="mt-4 p-4 text-center">
          <p className="mb-3 text-sm">Not in here yet. Which topic is it?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setEnrichTopicId(topic.id)}
                aria-label={`Add to ${topic.name}`}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {topic.icon && <span aria-hidden="true">{topic.icon}</span>}
                {topic.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {noMatches && user && enrichTopic && (
        <div className="mt-4">
          <EnrichmentPrompt
            searchQuery={trimmedQuery}
            topicId={enrichTopic.id}
            topicSlug={enrichTopic.slug}
            topicName={enrichTopic.name}
            onEnrichmentComplete={handleEnrichmentComplete}
            onCancel={handleEnrichmentCancel}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/components/ItemSearch.test.tsx`
Expected: PASS, 9 tests.

If a test hangs on the debounce, confirm `vi.useFakeTimers({ shouldAdvanceTime: true })` is set in `beforeEach` — `waitFor` needs real time to progress.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ItemSearch.tsx frontend/src/components/ItemSearch.test.tsx
git commit -m "feat: add ItemSearch with cross-topic dropdown and enrichment fallback"
```

---

## Task 4: BuyMeACoffeeButton

**Files:**
- Create: `frontend/src/components/BuyMeACoffeeButton.tsx`
- Test: `frontend/src/components/BuyMeACoffeeButton.test.tsx`

**Interfaces:**
- Produces: `<BuyMeACoffeeButton size?: 'sm' | 'default' />`. Consumed by Task 5 (`Layout`) and Task 6 (`FaqSection`).

**Why not the vendor script:** the snippet injects its button at the `<script>` tag's DOM position, which does not survive SPA route changes, requires a CSP allowance for `cdnjs.buymeacoffee.com`, and cannot be asserted on in a unit test.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/BuyMeACoffeeButton.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/utils'
import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'

describe('BuyMeACoffeeButton', () => {
  it('links to the correct buymeacoffee page', () => {
    render(<BuyMeACoffeeButton />)

    expect(screen.getByRole('link', { name: /Buy me a coffee/i }))
      .toHaveAttribute('href', 'https://buymeacoffee.com/robertocalo')
  })

  it('opens in a new tab safely', () => {
    render(<BuyMeACoffeeButton />)
    const link = screen.getByRole('link', { name: /Buy me a coffee/i })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows the label text', () => {
    render(<BuyMeACoffeeButton />)

    expect(screen.getByText('Buy me a coffee')).toBeInTheDocument()
  })

  it('hides the label on small screens in the compact size', () => {
    render(<BuyMeACoffeeButton size="sm" />)

    expect(screen.getByText('Buy me a coffee').className).toContain('hidden')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/components/BuyMeACoffeeButton.test.tsx`
Expected: FAIL — cannot resolve `./BuyMeACoffeeButton`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/BuyMeACoffeeButton.tsx`:

```tsx
const BMC_URL = 'https://buymeacoffee.com/robertocalo'

interface BuyMeACoffeeButtonProps {
  /** `sm` collapses to the emoji only on narrow screens (navbar use). */
  size?: 'sm' | 'default'
}

/**
 * Buy Me a Coffee link, styled to match the official widget.
 *
 * Reimplemented rather than loading the vendor script: that script injects at
 * its own tag position (unreliable in an SPA), needs an external-origin CSP
 * allowance, and cannot be unit tested.
 */
export function BuyMeACoffeeButton({ size = 'default' }: BuyMeACoffeeButtonProps) {
  const isCompact = size === 'sm'

  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        backgroundColor: '#FFDD00',
        color: '#000000',
        borderColor: '#000000',
        fontFamily: "Cookie, 'Brush Script MT', cursive"
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary ${
        isCompact ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-lg'
      }`}
      aria-label="Buy me a coffee on buymeacoffee.com"
    >
      <span aria-hidden="true">☕</span>
      <span className={isCompact ? 'hidden sm:inline' : ''}>Buy me a coffee</span>
    </a>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/components/BuyMeACoffeeButton.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BuyMeACoffeeButton.tsx frontend/src/components/BuyMeACoffeeButton.test.tsx
git commit -m "feat: add self-hosted Buy Me a Coffee button"
```

---

## Task 5: Navbar rearrangement

**Files:**
- Modify: `frontend/src/components/GitHubStarBadge.tsx` (the returned anchor, currently lines 44-52)
- Modify: `frontend/src/components/Layout.tsx` (lines 42-80)

**Interfaces:**
- Consumes: `<BuyMeACoffeeButton>` (Task 4).
- Produces: `<GitHubStarBadge size?: 'sm' | 'default' />`. The default is `sm`, so no existing call site changes meaning.

- [ ] **Step 1: Add a size prop to GitHubStarBadge**

In `frontend/src/components/GitHubStarBadge.tsx`, change the signature and the
returned anchor's classes. Everything above the `return` is unchanged.

```tsx
interface GitHubStarBadgeProps {
  /** `default` gives the roomier navbar treatment. */
  size?: 'sm' | 'default'
}

export function GitHubStarBadge({ size = 'sm' }: GitHubStarBadgeProps) {
```

Replace the anchor's `className` with:

```tsx
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        size === 'default' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'
      }`}
```

and the icon's:

```tsx
      <Github className={size === 'default' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
```

- [ ] **Step 2: Move the badge into the right-hand nav in Layout**

In `frontend/src/components/Layout.tsx`:

Add the import beside the existing `GitHubStarBadge` import:

```tsx
import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'
```

Replace the left-hand group (currently lines 42-47) with just the wordmark:

```tsx
          <Link to="/" className="text-lg font-bold tracking-tight">
            mytops
          </Link>
```

Then, inside the `<nav>`, after the auth buttons and before the existing
`<Separator orientation="vertical" className="mx-2 h-4" />`, insert:

```tsx
            <Separator orientation="vertical" className="mx-2 h-4" />
            <GitHubStarBadge size="default" />
            <BuyMeACoffeeButton size="sm" />
```

- [ ] **Step 3: Verify manually and with the suite**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: PASS and a clean build.

Then run `npm run dev` and confirm at http://localhost:5173 that the wordmark is
alone on the left, and that the star badge and coffee button sit at the right end
of the nav before the theme toggle. At a 375px viewport the coffee label collapses
to the ☕ emoji and the header does not wrap or overflow horizontally.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/components/GitHubStarBadge.tsx
git commit -m "feat: move GitHub badge right and add coffee button to navbar"
```

---

## Task 6: FaqSection

**Files:**
- Create: `frontend/src/components/FaqSection.tsx`
- Test: `frontend/src/components/FaqSection.test.tsx`

**Interfaces:**
- Consumes: `<BuyMeACoffeeButton>` (Task 4), `<GitHubStarBadge>` (Task 5), `motion` and `useReducedMotion` from `framer-motion`.
- Produces: `<FaqSection />` and `export const FAQ_ANCHOR_ID = 'faq'`. Consumed by Task 7 (`HomePage`), which scrolls to that id.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/FaqSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/utils'
import { FaqSection, FAQ_ANCHOR_ID } from './FaqSection'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

describe('FaqSection', () => {
  it('exposes the anchor id used by the scroll button', () => {
    const { container } = render(<FaqSection />)

    expect(FAQ_ANCHOR_ID).toBe('faq')
    expect(container.querySelector(`#${FAQ_ANCHOR_ID}`)).toBeInTheDocument()
  })

  it('renders the five questions in the specified order', () => {
    render(<FaqSection />)

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(headings).toEqual([
      'What is this?',
      'What can I track?',
      'Why does this exist?',
      'Is my data private?',
      'Is it free?'
    ])
  })

  it('alternates band alignment left, right, left, right, left', () => {
    const { container } = render(<FaqSection />)

    const bands = [...container.querySelectorAll('[data-faq-band]')]
    expect(bands.map((band) => band.getAttribute('data-align'))).toEqual([
      'left',
      'right',
      'left',
      'right',
      'left'
    ])
  })

  it('renders the GitHub and coffee links inside the last band', () => {
    const { container } = render(<FaqSection />)

    const lastBand = container.querySelector('[data-faq-band="free"]')

    expect(lastBand?.querySelector('a[href="https://buymeacoffee.com/robertocalo"]'))
      .toBeInTheDocument()
    expect(lastBand?.querySelector('a[href="https://github.com/Zartof23/mytops"]'))
      .toBeInTheDocument()
  })

  it('renders answer copy when reduced motion is preferred', () => {
    render(<FaqSection />)

    expect(screen.getByText(/One search box for everything you like/)).toBeInTheDocument()
    expect(screen.getByText(/I pay for the AI tokens/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/components/FaqSection.test.tsx`
Expected: FAIL — cannot resolve `./FaqSection`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/FaqSection.tsx`:

```tsx
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'
import { GitHubStarBadge } from './GitHubStarBadge'

/** Scroll target for the "What the heck is this?" button on the home page. */
export const FAQ_ANCHOR_ID = 'faq'

interface FaqBand {
  id: string
  question: string
  answer: ReactNode
}

const FAQ_BANDS: FaqBand[] = [
  {
    id: 'what',
    question: 'What is this?',
    answer: (
      <>
        One search box for everything you like. Movies, series, books, anime,
        games, restaurants. Find a thing, rate it, it&apos;s yours. If it&apos;s
        not in the database, AI goes and finds it, and then it&apos;s in there
        permanently for everyone.
      </>
    )
  },
  {
    id: 'track',
    question: 'What can I track?',
    answer: (
      <>
        Six topics today: movies, series, books, anime, games, restaurants. More
        when someone asks for one convincingly enough.
      </>
    )
  },
  {
    id: 'why',
    question: 'Why does this exist?',
    answer: (
      <>
        I wanted one organized, private list of my favorites across everything,
        and nothing covered all of it — especially the unconventional and indie
        picks. So the database gets built by AI, on demand, as people search. It
        grows because you use it.
      </>
    )
  },
  {
    id: 'privacy',
    question: 'Is my data private?',
    answer: (
      <>
        Your ratings are yours and private by default. I don&apos;t sell anything
        to anyone. Public profiles are planned, opt-in, and not built yet.
      </>
    )
  },
  {
    id: 'free',
    question: 'Is it free?',
    answer: (
      <>
        <p className="mb-4">
          Yes. I pay for the AI tokens. If you want to help, star the repo or buy
          me a coffee. Both work. One is cheaper for you.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <GitHubStarBadge size="default" />
          <BuyMeACoffeeButton />
        </div>
      </>
    )
  }
]

/**
 * The FAQ, as full-width bands the reader discovers while scrolling.
 *
 * Bands alternate left / right so the eye zig-zags down the page. Each fades in
 * once when it enters the viewport, or renders immediately when the visitor
 * prefers reduced motion.
 */
export function FaqSection() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id={FAQ_ANCHOR_ID} aria-label="Frequently asked questions" className="py-16">
      <div className="flex flex-col gap-16">
        {FAQ_BANDS.map((band, index) => {
          const align = index % 2 === 0 ? 'left' : 'right'

          return (
            <motion.div
              key={band.id}
              data-faq-band={band.id}
              data-align={align}
              className={`flex ${align === 'left' ? 'justify-start' : 'justify-end'}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: align === 'left' ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className={`w-full max-w-xl border-l-2 border-foreground/20 pl-6 ${
                  align === 'right' ? 'text-right border-l-0 border-r-2 pl-0 pr-6' : ''
                }`}
              >
                <h3 className="mb-3 text-2xl font-bold tracking-tight">{band.question}</h3>
                <div className="text-muted-foreground">{band.answer}</div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/components/FaqSection.test.tsx`
Expected: PASS, 5 tests.

The last-band test asserts the GitHub href is `https://github.com/Zartof23/mytops`.
That comes from the existing `REPO_URL` constant in `GitHubStarBadge.tsx` — do not
hardcode a second copy.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FaqSection.tsx frontend/src/components/FaqSection.test.tsx
git commit -m "feat: rebuild FAQ as scroll-revealed alternating bands"
```

---

## Task 7: HomePage rewrite

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx` (full rewrite)
- Create: `frontend/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `<ItemSearch>` (Task 3), `<FaqSection>` and `FAQ_ANCHOR_ID` (Task 6), `SearchResultItem` (Task 1), the existing `ItemDetailModal`, `statsService.getItemStats`, `ratingService`, `SEO`/`WebSiteSchema`, `PageTransition`.
- Produces: nothing consumed elsewhere.

Removed in this rewrite: the popular-items carousel and its `getPopularItems`
call, the hero banner, and both CTA buttons. `statsService.getPopularItems` itself
stays — other code uses it.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/HomePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../test/utils'
import { HomePage } from './HomePage'

vi.mock('../components/ItemSearch', () => ({
  ItemSearch: () => <div data-testid="item-search" />
}))

vi.mock('../components/FaqSection', () => ({
  FaqSection: () => <div data-testid="faq-section" id="faq" />,
  FAQ_ANCHOR_ID: 'faq'
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: null })
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the two-line tagline', () => {
    render(<HomePage />)

    expect(
      screen.getByText('Search anything. Movies, books, games, ramen shops.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/If it's not here yet, AI finds it and adds it/)
    ).toBeInTheDocument()
  })

  it('renders the search box and the FAQ', () => {
    render(<HomePage />)

    expect(screen.getByTestId('item-search')).toBeInTheDocument()
    expect(screen.getByTestId('faq-section')).toBeInTheDocument()
  })

  it('renders a button that scrolls to the FAQ', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<HomePage />)
    screen.getByRole('button', { name: /What the heck is this/i }).click()

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('no longer renders the popular items carousel', () => {
    render(<HomePage />)

    expect(screen.queryByText('What people are rating')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Popular items' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run src/pages/HomePage.test.tsx`
Expected: FAIL — the tagline is not present and the carousel still is.

- [ ] **Step 3: Rewrite the page**

Replace the entire contents of `frontend/src/pages/HomePage.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { statsService } from '../services/statsService'
import { ratingService } from '../services/ratingService'
import { ItemSearch } from '../components/ItemSearch'
import { FaqSection, FAQ_ANCHOR_ID } from '../components/FaqSection'
import { ItemDetailModal } from '@/components/ItemDetailModal'
import { SEO, WebSiteSchema } from '@/components/SEO'
import { PageTransition } from '@/components/PageTransition'
import type { SearchResultItem } from '../services/searchService'

/**
 * Home page: one search box across every topic, with the FAQ below the fold.
 *
 * Search is the whole product here — there is deliberately no carousel, banner
 * or call-to-action competing with the input.
 */
export function HomePage() {
  const { user } = useAuthStore()
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [stats, setStats] = useState({ avgRating: 0, ratingCount: 0 })
  const [userRating, setUserRating] = useState<number | null>(null)

  const handleSelectItem = useCallback(async (item: SearchResultItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
    setStats({ avgRating: 0, ratingCount: 0 })
    setUserRating(null)

    // Search results carry no stats, so fetch them for just this item.
    const { data } = await statsService.getItemStats(item.id)
    if (data) setStats(data)
  }, [])

  const handleRatingChange = useCallback(
    async (rating: number) => {
      if (!selectedItem) return

      setUserRating(rating)
      const { error } = await ratingService.upsertRating({
        item_id: selectedItem.id,
        rating
      })
      if (error) {
        setUserRating(null)
        return
      }

      const { data } = await statsService.getItemStats(selectedItem.id)
      if (data) setStats(data)
    },
    [selectedItem]
  )

  const scrollToFaq = useCallback(() => {
    document.getElementById(FAQ_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <PageTransition>
      <SEO
        title="mytops - Search and Rate Movies, Books, Games & More"
        description="One search box for everything you like. Rate movies, series, books, anime, games and restaurants. If it's not in the database yet, AI finds it and adds it for everyone."
        url="/"
      />
      <WebSiteSchema />

      <div className="mx-auto max-w-3xl px-4">
        {/* Hero: tagline + search, sized to fill the first viewport */}
        <div className="relative flex min-h-[70vh] flex-col justify-center">
          <motion.div
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">
              Search anything. Movies, books, games, ramen shops.
            </p>
            <p className="mt-2 text-muted-foreground">
              If it&apos;s not here yet, AI finds it and adds it — for everyone.
            </p>
          </motion.div>

          <ItemSearch onSelectItem={handleSelectItem} />

          <button
            type="button"
            onClick={scrollToFaq}
            className="absolute bottom-0 right-0 -rotate-6 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            What the heck is this?
          </button>
        </div>

        <FaqSection />
      </div>

      <ItemDetailModal
        item={selectedItem}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        avgRating={stats.avgRating}
        ratingCount={stats.ratingCount}
        userRating={userRating}
        onRatingChange={handleRatingChange}
        isAuthenticated={Boolean(user)}
      />
    </PageTransition>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run src/pages/HomePage.test.tsx`
Expected: PASS, 4 tests.

`ratingService.upsertRating` takes `{ item_id, rating, notes? }` and
`statsService.getItemStats(itemId)` resolves to `{ data: { avgRating, ratingCount } }`
— both verified against the current source.

- [ ] **Step 5: Verify the full suite and build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: everything passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/HomePage.test.tsx
git commit -m "feat: rebuild home page around cross-topic search"
```

---

## Task 8: TopicDetailPage adopts SearchInput

**Files:**
- Modify: `frontend/src/pages/TopicDetailPage.tsx` (the search input block, currently lines 660-690)

**Interfaces:**
- Consumes: `<SearchInput>` (Task 2).
- Produces: nothing new. **Behavior must not change** — this is a presentational swap only. The page keeps its own `searchQuery` state, `useDebouncedValue`, `statsService.getFilteredItems` pipeline, filters, pagination, grid, TODO list, `getEmptyStateConfig` and `shouldShowEnrichment`.

- [ ] **Step 1: Add the import**

In `frontend/src/pages/TopicDetailPage.tsx`, beside the other component imports:

```tsx
import { SearchInput } from '../components/SearchInput'
```

- [ ] **Step 2: Replace the search input block**

Replace the whole `{/* Search Input */}` `<motion.div>` block with:

```tsx
        {/* Search Input */}
        <motion.div
          className="mb-4"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search ${topic.name.toLowerCase()}...`}
            ariaLabel={`Search ${topic.name.toLowerCase()}`}
            isSearching={searching}
          />
        </motion.div>
```

No `topics` prop: the topic page's scope is already fixed, so no chip row renders.

- [ ] **Step 3: Delete the now-unused handler and imports**

Remove the `handleSearchChange` callback — `setSearchQuery` is passed directly and
`SearchInput` hands back a string, not an event.

Then remove any import that TypeScript now reports as unused. Expect `Input`,
`Search`, and `Loader2` to be among them; keep `Loader2` only if it is still used
elsewhere in the file. Let the build tell you:

Run: `cd frontend && npm run build`

- [ ] **Step 4: Verify no regression**

Run: `cd frontend && npm test -- --run`
Expected: PASS. The existing `TopicDetailPage` tests must pass **unmodified** — if
any needs editing, the swap changed behavior and should be reworked instead.

Then run `npm run dev` and confirm on a topic page that typing filters the grid,
the spinner appears while searching, the filter pills still work, pagination still
works, and searching for something absent still shows the AI enrichment prompt.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TopicDetailPage.tsx
git commit -m "refactor: use shared SearchInput on topic detail page"
```

---

## Task 9: Documentation

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/context/FRONTEND_CONTEXT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read each file before editing**

Read all four so the additions match the existing structure, heading levels and
tone. Do not restructure anything — add to what is there.

- [ ] **Step 2: Add the CHANGELOG entry**

Add a new dated entry at the top of `docs/CHANGELOG.md`, matching the format of
the entries already there. It must cover:

- **What changed:** home page rebuilt around a cross-topic search box; carousel,
  hero banner and CTAs removed; FAQ rebuilt as scroll-revealed alternating bands
  with new copy and a new order; GitHub star badge moved to the right of the
  navbar and enlarged; Buy Me a Coffee button added to the navbar and the last
  FAQ band.
- **Why:** discovery is the product's core loop and was buried two clicks deep
  behind `/topics`. Search-first makes the first screen the useful one.
- **Decisions worth recording:**
  - `searchService` uses a direct PostgREST query rather than the
    `get_items_with_stats` RPC, because that RPC requires a `topic_id` and
    therefore cannot search across topics. Consequence: search results carry no
    rating stats, so the home page fetches stats per item when opening the modal.
  - Search extraction split into presentational `SearchInput` (shared) and
    behavioral `ItemSearch` (home only), rather than one component for both
    pages. The topic page drives a filtered paginated grid and the home page
    drives a dropdown; unifying them would have meant rebuilding the topic page's
    query pipeline for no user-visible gain.
  - Buy Me a Coffee is reimplemented rather than script-embedded: the vendor
    script injects at its own tag position, needs an external-origin allowance,
    and is not unit-testable.
  - Cross-topic AI enrichment asks the user which topic the item belongs to,
    because `ai-enrich-item` requires a `topic_id` and misclassification would
    write rows into the wrong topic.
- **Follow-on phases:** flagging (Phase 2) and admin review / soft delete /
  re-scan (Phase 3), per
  `docs/superpowers/specs/2026-08-09-search-first-ux-design.md`.

- [ ] **Step 3: Update FRONTEND_CONTEXT.md**

Add the new modules to the component and service inventories:

- `services/searchService.ts` — `searchItems({ query, topicId?, limit?, metadataFilters? })` and `listTopics()`. Note that `metadataFilters` is accepted and ignored, reserved for metadata search.
- `components/SearchInput.tsx` — presentational, controlled, optional topic chip row; shared by `HomePage` (via `ItemSearch`) and `TopicDetailPage`.
- `components/ItemSearch.tsx` — home-only; debounce, dropdown, keyboard navigation, enrichment fallback with the "which topic?" step.
- `components/FaqSection.tsx` — exports `FAQ_ANCHOR_ID`.
- `components/BuyMeACoffeeButton.tsx`.
- `components/GitHubStarBadge.tsx` — now takes `size`.

Also record the pattern: **components own presentation, pages own what happens on
selection.** `ItemSearch` calls `onSelectItem`; it does not know the modal exists.

- [ ] **Step 4: Update ARCHITECTURE.md and CLAUDE.md**

In `docs/ARCHITECTURE.md`, update the home page / discovery flow description to
the new path: home search → dropdown → detail modal, with AI enrichment when
nothing matches. Note the two distinct search paths (PostgREST for cross-topic,
RPC for topic-scoped) and why.

In `CLAUDE.md`, under "Current Capabilities", replace the browse-oriented wording
with cross-topic search from the home page. Leave "Known Limitations" alone —
flagging and admin arrive in Phases 2 and 3.

- [ ] **Step 5: Final verification**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: all tests pass, clean build.

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: record search-first UX changes and decisions"
```

---

## Self-Review Notes

Spec coverage check, section by section:

| Spec requirement | Task |
|---|---|
| `searchService` with `metadataFilters` forward-compat | 1 |
| `SearchInput` shared presentational component | 2 |
| `ItemSearch` dropdown, grouping, keyboard, enrichment | 3 |
| Search behavior table (all 8 rows) | 3 |
| "Which topic is it?" step before enrichment | 3 |
| Buy Me a Coffee, own markup, correct URL and colors | 4 |
| GitHub badge right-aligned and larger; coffee beside it | 5 |
| FAQ: 5 bands, new order, new copy, alternating, scroll-reveal | 6 |
| Reduced-motion handling | 6, 7 |
| Tagline, carousel/banner/CTA removal | 7 |
| "What the heck is this?" rotated button scrolling to FAQ | 7 |
| Item click opens `ItemDetailModal` | 7 |
| GitHub + coffee repeated in the last FAQ band | 6 |
| `/topics` kept, de-emphasized | 5 (nav unchanged), 8 (no behavior change) |
| Documentation updates | 9 |

Not covered by a task, by design: Phase 2 (flagging) and Phase 3 (admin, soft
delete, re-scan) have their own specs and plans.
