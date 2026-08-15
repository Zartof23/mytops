import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import {
  searchService,
  MIN_QUERY_LENGTH,
  type SearchResultItem
} from '../services/searchService'
import { SearchInput } from './SearchInput'
import { EnrichmentPrompt } from './EnrichmentPrompt'
import { LazyImage } from './LazyImage'
import { Card } from '@/components/ui/card'
import type { Item, Topic } from '@/types'

const RESULT_LIMIT = 24

interface ItemSearchProps {
  onSelectItem: (item: SearchResultItem) => void
  /**
   * Fires whenever the component starts or stops showing search output, so a
   * parent can collapse its hero and hand the space over to the results.
   */
  onActiveChange?: (isActive: boolean) => void
}

/** First usable image on an item, mirroring the modal's fallback chain. */
function getImageUrl(item: Item): string | null {
  if (item.image_url) return item.image_url
  if (typeof item.metadata?.poster_url === 'string') return item.metadata.poster_url
  if (typeof item.metadata?.image === 'string') return item.metadata.image
  return null
}

/**
 * Cross-topic search rendering results as cards grouped into per-topic sections.
 *
 * The query is only sent when the user presses Enter — no debounce — so typing
 * never fires a request and the layout only shifts on an explicit action. Owns
 * the query and the fetch; the parent decides what a selection means via
 * `onSelectItem`.
 */
export function ItemSearch({ onSelectItem, onActiveChange }: ItemSearchProps) {
  const { user } = useAuthStore()

  const [topics, setTopics] = useState<Topic[]>([])
  const [query, setQuery] = useState('')
  /** The query actually searched for — set on Enter, not on keystroke. */
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  /** Topic chosen in the "which topic is it?" step. */
  const [enrichTopicId, setEnrichTopicId] = useState<string | null>(null)

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
  }, [submittedQuery, isQueryLongEnough, activeTopicId])

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

  /** Flattened display order, so arrow keys match what the user sees. */
  const flatResults = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  )

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      onSelectItem(item)
    },
    [onSelectItem]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        // Enter picks the highlighted card if there is one, otherwise it is
        // what actually launches the search.
        if (highlightIndex >= 0 && flatResults[highlightIndex]) {
          handleSelect(flatResults[highlightIndex])
        } else {
          setSubmittedQuery(query.trim())
        }
        return
      }

      if (flatResults.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightIndex((prev) => (prev + 1) % flatResults.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightIndex((prev) =>
          prev <= 0 ? flatResults.length - 1 : prev - 1
        )
      } else if (event.key === 'Escape') {
        setHighlightIndex(-1)
      }
    },
    [flatResults, highlightIndex, handleSelect, query]
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
  const hasResults = flatResults.length > 0
  const highlightedOptionId =
    highlightIndex >= 0 && flatResults[highlightIndex]
      ? getOptionId(flatResults[highlightIndex].id)
      : undefined

  // Anything below the input counts as "active": the parent uses this to give
  // the results room by collapsing the hero.
  const isActive = isQueryLongEnough && (isSearching || hasSearched)
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

  return (
    <div onKeyDown={handleKeyDown} className="w-full">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="what are you into? (press Enter)"
        ariaLabel="Search everything"
        isSearching={isSearching}
        size="hero"
        topics={topics}
        activeTopicId={activeTopicId}
        onTopicChange={setActiveTopicId}
        role="combobox"
        ariaExpanded={hasResults}
        ariaControls={listboxId}
        ariaActiveDescendant={highlightedOptionId}
      />

      {hasResults && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="mt-8 flex flex-col gap-8 text-left"
        >
          {groups.map((group) => {
            const headingId = `${listboxId}-heading-${group.topic.id}`
            return (
              <li key={group.topic.id} role="group" aria-labelledby={headingId}>
                <p
                  id={headingId}
                  className="mb-3 flex items-center gap-2 border-b pb-2 text-sm font-medium text-muted-foreground"
                >
                  {group.topic.icon && <span aria-hidden="true">{group.topic.icon}</span>}
                  {group.topic.name}
                  <span className="text-xs">({group.items.length})</span>
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.items.map((item) => {
                    const index = flatResults.indexOf(item)
                    const imageUrl = getImageUrl(item)

                    return (
                      <motion.button
                        key={item.id}
                        id={getOptionId(item.id)}
                        type="button"
                        role="option"
                        aria-selected={index === highlightIndex}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setHighlightIndex(index)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
                        className={`group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                          index === highlightIndex ? 'border-foreground/40 bg-muted' : ''
                        }`}
                      >
                        <div className="flex h-32 w-full items-center justify-center overflow-hidden bg-muted">
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
                        <span className="line-clamp-2 px-3 py-2 text-sm font-medium">
                          {item.name}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
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
