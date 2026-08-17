import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import {
  searchService,
  MIN_QUERY_LENGTH,
  type SearchResultItem
} from '../services/searchService'
import { SearchInput, CHIP_BASE } from './SearchInput'
import { EnrichmentPrompt } from './EnrichmentPrompt'
import { LazyImage } from './LazyImage'
import { useDebouncedValue } from '@/lib/hooks'
import { getItemImageUrl } from '@/lib/itemImage'
import { Card } from '@/components/ui/card'
import type { Item, Topic } from '@/types'

const RESULT_LIMIT = 24
/** How many typeahead suggestions to show. */
const SUGGESTION_LIMIT = 5
/**
 * Over-fetch suggestions so the prefix-first ranking below has something to
 * reorder — the server can only sort alphabetically.
 */
const SUGGESTION_FETCH_LIMIT = 20
/** Idle time after a keystroke before suggestions are fetched. */
const SUGGESTION_DEBOUNCE_MS = 200

interface ItemSearchProps {
  onSelectItem: (item: SearchResultItem) => void
  /**
   * Fires whenever the component starts or stops showing search output, so a
   * parent can collapse its hero and hand the space over to the results.
   */
  onActiveChange?: (isActive: boolean) => void
  /**
   * Bump this to re-run the current search (same query/scope) without
   * resetting anything the user typed — e.g. after an admin deletes or
   * rescans an item from the detail modal, so the stale row doesn't linger
   * in the results list.
   */
  refreshSignal?: number
}

/**
 * Order suggestions by how well the title matches, best first.
 *
 * The server can only sort alphabetically, so a query like "dune" would put
 * "Dune: Part Two" above "Dune". Exact titles come first, then prefix matches,
 * then matches at a word boundary, then everything else; ties keep the
 * alphabetical order the server returned.
 */
function rankByTitleMatch(
  items: SearchResultItem[],
  query: string
): SearchResultItem[] {
  const needle = query.toLowerCase()
  const atWordBoundary = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

  const score = (name: string): number => {
    const title = name.toLowerCase()
    if (title === needle) return 0
    if (title.startsWith(needle)) return 1
    if (atWordBoundary.test(title)) return 2
    return 3
  }

  // Score once per item rather than twice per comparison.
  return items
    .map((item) => ({ item, score: score(item.name) }))
    .sort((a, b) => a.score - b.score)
    .map(({ item }) => item)
}

/**
 * Cross-topic search: a typeahead suggestion list while typing, and full
 * per-topic result sections once a query is submitted.
 *
 * Suggestions match on title only and are capped at five — they are a shortcut
 * to one specific item, not a preview of the results. The full search still
 * only runs on Enter, so the layout shifts on an explicit action rather than on
 * every keystroke. Owns the query and both fetches; the parent decides what a
 * selection means via `onSelectItem`.
 */
export function ItemSearch({ onSelectItem, onActiveChange, refreshSignal }: ItemSearchProps) {
  const { user } = useAuthStore()

  const [topics, setTopics] = useState<Topic[]>([])
  const [query, setQuery] = useState('')
  /** The query actually searched for — set on Enter, not on keystroke. */
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  /** Title-only typeahead matches for whatever is currently typed. */
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([])
  /** Query the user dismissed suggestions for with Escape. */
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null)
  /** Index into `suggestions`; -1 means nothing is highlighted. */
  const [highlightIndex, setHighlightIndex] = useState(-1)
  /** Topic chosen in the "which topic is it?" step. */
  const [enrichTopicId, setEnrichTopicId] = useState<string | null>(null)

  const debouncedQuery = useDebouncedValue(query, SUGGESTION_DEBOUNCE_MS)
  const listboxId = useId()
  const getOptionId = useCallback(
    (itemId: string) => `${listboxId}-option-${itemId}`,
    [listboxId]
  )
  const isQueryLongEnough = submittedQuery.length >= MIN_QUERY_LENGTH

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

  // Run the search whenever a query is submitted or the scope changes.
  useEffect(() => {
    if (!isQueryLongEnough) {
      setResults([])
      setHasSearched(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    searchService
      .searchItems({
        query: submittedQuery,
        topicId: activeTopicId ?? undefined,
        limit: RESULT_LIMIT
      })
      .then(({ data }) => {
        if (cancelled) return
        setResults(data)
        setHasSearched(true)
        setHighlightIndex(-1)
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [submittedQuery, isQueryLongEnough, activeTopicId, refreshSignal])

  // Typeahead suggestions, debounced so a fast typist fires one request rather
  // than one per keystroke. Skipped once the typed text is what was searched
  // for, so submitting a query leaves the suggestion list closed.
  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH || trimmed === submittedQuery) {
      setSuggestions([])
      setHighlightIndex(-1)
      return
    }

    // Still typing: the effect re-runs (cancelling any in-flight fetch) on every
    // keystroke, but only the settled value gets to hit the network.
    if (debouncedQuery !== query) return

    let cancelled = false

    searchService
      .searchItems({
        query: trimmed,
        topicId: activeTopicId ?? undefined,
        limit: SUGGESTION_FETCH_LIMIT,
        nameOnly: true
      })
      .then(({ data }) => {
        if (cancelled) return
        setSuggestions(rankByTitleMatch(data, trimmed).slice(0, SUGGESTION_LIMIT))
        setHighlightIndex(-1)
      })

    return () => {
      cancelled = true
    }
  }, [query, debouncedQuery, submittedQuery, activeTopicId])

  // Reset the enrichment topic choice whenever the question changes.
  useEffect(() => {
    setEnrichTopicId(null)
  }, [submittedQuery, activeTopicId])

  /** Results in display order, grouped by topic. */
  const groups = useMemo(() => {
    const byTopic = new Map<string, { topic: Topic; items: SearchResultItem[] }>()

    for (const item of results) {
      // The embedded `topics(*)` join can come back null for a row whose topic
      // is missing or unreadable. Skip it rather than crash the whole render.
      if (!item.topic) continue

      const existing = byTopic.get(item.topic.id)
      if (existing) {
        existing.items.push(item)
      } else {
        byTopic.set(item.topic.id, { topic: item.topic, items: [item] })
      }
    }

    return [...byTopic.values()]
  }, [results])

  const showSuggestions = suggestions.length > 0 && dismissedQuery !== query
  /** The suggestion the user has arrowed onto, if any. */
  const highlightedSuggestion =
    showSuggestions && highlightIndex >= 0 ? suggestions[highlightIndex] : undefined
  /**
   * True when there is a searchable query the user has not committed yet — the
   * only state in which the Enter hint is worth showing.
   */
  const hasPendingQuery =
    query.trim().length >= MIN_QUERY_LENGTH && query.trim() !== submittedQuery

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      // Picking something closes the suggestion list — it has done its job, and
      // leaving it open would hover over whatever the parent opens.
      setDismissedQuery(query)
      setHighlightIndex(-1)
      onSelectItem(item)
    },
    [onSelectItem, query]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        // Enter opens the highlighted suggestion if the user arrowed onto one,
        // otherwise it is what actually launches the full search.
        if (highlightedSuggestion) {
          handleSelect(highlightedSuggestion)
        } else {
          setSubmittedQuery(query.trim())
        }
        return
      }

      if (event.key === 'Escape') {
        setDismissedQuery(query)
        setHighlightIndex(-1)
        return
      }

      if (!showSuggestions) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightIndex((prev) => (prev + 1) % suggestions.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        )
      }
    },
    [suggestions, showSuggestions, highlightedSuggestion, handleSelect, query]
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
    setSubmittedQuery('')
    setEnrichTopicId(null)
  }, [])

  const noMatches = isQueryLongEnough && hasSearched && !isSearching && results.length === 0
  const enrichTopic = topics.find(
    (topic) => topic.id === (activeTopicId ?? enrichTopicId)
  )
  const hasResults = groups.length > 0
  const highlightedOptionId = highlightedSuggestion
    ? getOptionId(highlightedSuggestion.id)
    : undefined

  // Anything below the input counts as "active": the parent uses this to give
  // the results room by collapsing the hero.
  const isActive = isQueryLongEnough && (isSearching || hasSearched)
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

  /** Running position across all result groups, consumed while rendering. */
  let renderedCount = 0

  return (
    <div onKeyDown={handleKeyDown} className="w-full">
      <div className="relative">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="What are you looking for?"
          ariaLabel="Search everything"
          isSearching={isSearching}
          showEnterHint={hasPendingQuery}
          size="hero"
          topics={topics}
          activeTopicId={activeTopicId}
          onTopicChange={setActiveTopicId}
          role="combobox"
          ariaExpanded={showSuggestions}
          ariaControls={listboxId}
          ariaActiveDescendant={highlightedOptionId}
        />

        {/*
          Typeahead suggestions. Absolutely positioned so opening them never
          moves the input — only submitting a query changes the layout.
        */}
        {showSuggestions && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Suggestions"
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border bg-popover text-left shadow-lg"
          >
            {suggestions.map((item, index) => (
              <li key={item.id}>
                <button
                  id={getOptionId(item.id)}
                  type="button"
                  role="option"
                  aria-selected={index === highlightIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors focus:outline-none focus:bg-muted ${
                    index === highlightIndex ? 'bg-muted' : ''
                  }`}
                >
                  <span aria-hidden="true" className="opacity-60">
                    {item.topic.icon ?? '•'}
                  </span>
                  <span className="truncate">{item.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {item.topic.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasResults && (
        <div
          aria-label="Search results"
          className="mt-8 flex flex-col gap-8 text-left"
        >
          {groups.map((group) => {
            const headingId = `${listboxId}-heading-${group.topic.id}`
            return (
              <section key={group.topic.id} aria-labelledby={headingId}>
                <p
                  id={headingId}
                  className="mb-3 flex items-center gap-2 border-b pb-2 text-sm font-medium text-muted-foreground"
                >
                  {group.topic.icon && <span aria-hidden="true">{group.topic.icon}</span>}
                  {group.topic.name}
                  <span className="text-xs">({group.items.length})</span>
                </p>

                {/*
                  Narrow columns on purpose: posters and book covers are 2:3,
                  so a card sized to that ratio shows the whole artwork instead
                  of cropping the top and bottom off it.
                */}
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {group.items.map((item) => {
                    // Position in the flattened display order, for the
                    // staggered entrance below.
                    const index = renderedCount++
                    const imageUrl = getItemImageUrl(item)

                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
                        className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-foreground/40 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden bg-muted">
                          {imageUrl ? (
                            <LazyImage
                              src={imageUrl}
                              alt={item.name}
                              className="h-full w-full"
                              aspectRatio="auto"
                              objectFit="cover"
                            />
                          ) : (
                            <span className="text-2xl opacity-40" aria-hidden="true">
                              {item.topic.icon ?? '?'}
                            </span>
                          )}
                        </div>
                        <span className="line-clamp-2 px-2 py-2 text-xs font-medium">
                          {item.name}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {noMatches && !user && (
        <Card className="mt-8 p-4 text-center text-sm text-muted-foreground">
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
        <Card className="mt-8 p-4 text-center">
          <p className="mb-3 text-sm">Not in here yet. Which topic is it?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setEnrichTopicId(topic.id)}
                aria-label={`Add to ${topic.name}`}
                className={`${CHIP_BASE} hover:bg-muted`}
              >
                {topic.icon && <span aria-hidden="true">{topic.icon}</span>}
                {topic.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {noMatches && user && enrichTopic && (
        <div className="mt-8">
          <EnrichmentPrompt
            searchQuery={submittedQuery}
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
