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
