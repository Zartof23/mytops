import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useDebouncedValue } from '../lib/hooks'
import { statsService } from '../services/statsService'
import { todoService } from '../services/todoService'
import { ratingService } from '../services/ratingService'
import { useAuthStore } from '../store/authStore'
import { ItemCard } from '../components/ItemCard'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { Pagination } from '../components/Pagination'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/SEO'
import { PageTransition } from '@/components/PageTransition'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Topic, ItemWithStats } from '../types'

// Witty taglines for each topic
const TOPIC_TAGLINES: Record<string, string> = {
  movies: 'Every masterpiece. Every guilty pleasure.',
  series: 'The ones you binged. The ones you pretend you didn\'t.',
  books: 'The ones you finished. The ones collecting dust.',
  anime: 'Your gateway into degeneracy. Own it.',
  games: 'Hundreds of hours well spent. Arguably.',
  restaurants: 'The spots you\'d actually recommend.',
} as const

const ITEMS_PER_PAGE = 24
const SEARCH_DEBOUNCE_MS = 300
const NEW_RELEASE_DAYS = 30

type FilterOption = 'all' | '5star' | '4plus' | 'new'

interface FilterParams {
  minAvgRating?: number
  releasedAfter?: Date
}

/**
 * Map filter options to database query parameters.
 */
function getFilterParams(filter: FilterOption): FilterParams {
  switch (filter) {
    case '5star':
      return { minAvgRating: 4.8 }
    case '4plus':
      return { minAvgRating: 4.0 }
    case 'new':
      return { releasedAfter: new Date(Date.now() - NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000) }
    default:
      return {}
  }
}

function ItemsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-32 w-full mb-3" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      ))}
    </div>
  )
}

/**
 * Topic detail page displaying items for a specific topic with search,
 * filtering, and pagination capabilities.
 *
 * Features:
 * - Server-side filtering and pagination for performance
 * - Debounced search to reduce API calls
 * - Optimistic UI updates for ratings and TODO list
 * - Accessible keyboard navigation and ARIA labels
 * - Reduced motion support
 */
export function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()

  // Topic and items data
  const [topic, setTopic] = useState<Topic | null>(null)
  const [items, setItems] = useState<ItemWithStats[]>([])
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map())
  const [todoStatus, setTodoStatus] = useState<Set<string>>(new Set())
  const [totalCount, setTotalCount] = useState(0)

  // UI state
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadingUserData, setLoadingUserData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [selectedItem, setSelectedItem] = useState<ItemWithStats | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS)

  // Memoized computed values
  const tagline = useMemo(
    () => (topic ? TOPIC_TAGLINES[topic.slug] || topic.description : null),
    [topic]
  )
  const totalPages = useMemo(
    () => Math.ceil(totalCount / ITEMS_PER_PAGE),
    [totalCount]
  )

  /**
   * Fetch items with server-side filtering and pagination.
   * Also fetches user ratings and TODO status if user is logged in.
   *
   * This function is stable (no dependencies) and passed all params explicitly,
   * so it doesn't need to be in useEffect dependency arrays.
   */
  const fetchItems = useCallback(async (
    topicId: string,
    query: string,
    filter: FilterOption,
    page: number,
    userId: string | null
  ): Promise<void> => {
    setSearching(true)
    // Set loadingUserData BEFORE fetching to prevent skeleton flash
    if (userId) {
      setLoadingUserData(true)
    }

    try {
      const filterParams = getFilterParams(filter)

      const { data, error: fetchError } = await statsService.getFilteredItems({
        topicId,
        searchQuery: query || undefined,
        minAvgRating: filterParams.minAvgRating,
        releasedAfter: filterParams.releasedAfter,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE
      })

      if (fetchError) {
        console.error('Error fetching items:', fetchError)
        setLoadingUserData(false)
        return
      }

      setItems(data?.items || [])
      setTotalCount(data?.totalCount || 0)

      // Fetch user ratings and TODO status in parallel if logged in
      if (userId && data?.items && data.items.length > 0) {
        const itemIds = data.items.map(i => i.id)
        const [ratingsResult, todoResult] = await Promise.all([
          statsService.getUserRatingsBatch(itemIds, userId),
          todoService.getTodoStatusBatch(itemIds)
        ])

        if (ratingsResult.data) {
          setUserRatings(ratingsResult.data)
        }
        if (todoResult.data) {
          setTodoStatus(todoResult.data)
        }
      }
      setLoadingUserData(false)
    } catch (err) {
      console.error('Unexpected error in fetchItems:', err)
      setLoadingUserData(false)
    } finally {
      setSearching(false)
    }
  }, [])

  // Fetch topic on mount and when slug changes
  useEffect(() => {
    const abortController = new AbortController()

    async function loadTopic() {
      if (!slug) {
        setError('No topic specified')
        setLoading(false)
        return
      }

      // Reset state when navigating to different topic
      setLoading(true)
      setError(null)
      setSearchQuery('')
      setActiveFilter('all')
      setCurrentPage(1)
      setItems([])
      setUserRatings(new Map())
      setTodoStatus(new Set())
      setTotalCount(0)
      setLoadingUserData(false)
      setSelectedItem(null)
      setIsModalOpen(false)

      try {
        const { data, error: topicError } = await supabase
          .from('topics')
          .select('*')
          .eq('slug', slug)
          .single()

        if (abortController.signal.aborted) return

        if (topicError) {
          setError(topicError.message)
          setLoading(false)
          return
        }

        setTopic(data)
        setLoading(false)
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Error loading topic:', err)
          setError('Failed to load topic')
          setLoading(false)
        }
      }
    }

    loadTopic()

    return () => {
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    if (topic) {
      setCurrentPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, activeFilter])

  // Fetch items when search/filter/page changes or when topic loads
  useEffect(() => {
    if (!topic) return

    fetchItems(topic.id, debouncedSearchQuery, activeFilter, currentPage, user?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, activeFilter, currentPage, topic, user?.id])

  // Memoize event handlers to prevent unnecessary re-renders
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleFilterChange = useCallback((filter: FilterOption) => {
    setActiveFilter(filter)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleItemClick = useCallback((item: ItemWithStats) => {
    if (!topic) return
    // Create item with topic reference for modal
    const itemWithTopic: ItemWithStats & { topic: Topic } = { ...item, topic }
    setSelectedItem(itemWithTopic)
    setIsModalOpen(true)
  }, [topic])

  const handleRatingChange = useCallback(async (rating: number) => {
    if (!selectedItem) return

    const itemId = selectedItem.id

    // Optimistic update
    setUserRatings(prev => {
      const updated = new Map(prev)
      updated.set(itemId, rating)
      return updated
    })

    // Remove from TODO if rated
    setTodoStatus(prev => {
      if (!prev.has(itemId)) return prev
      const updated = new Set(prev)
      updated.delete(itemId)
      return updated
    })

    // Save to database
    const { error: ratingError } = await ratingService.upsertRating({
      item_id: itemId,
      rating
    })

    if (ratingError) {
      // Rollback on error
      setUserRatings(prev => {
        const rollback = new Map(prev)
        rollback.delete(itemId)
        return rollback
      })
      toast.error("Couldn't save that. The database is judging you.")
    } else {
      toast.success('Noted. Your taste is... interesting.')
    }
  }, [selectedItem])

  const handleAddToTodo = useCallback(async (itemId: string) => {
    if (!topic) return

    // Optimistic update
    setTodoStatus(prev => new Set(prev).add(itemId))

    const { error: todoError } = await todoService.addToTodo(itemId, topic.id)

    if (todoError) {
      // Rollback on error
      setTodoStatus(prev => {
        const rollback = new Set(prev)
        rollback.delete(itemId)
        return rollback
      })
      toast.error("Couldn't add to list. Try again?")
    } else {
      toast.success('Added to your list. No pressure to actually watch it.')
    }
  }, [topic])

  const handleRemoveFromTodo = useCallback(async (itemId: string) => {
    // Optimistic update
    setTodoStatus(prev => {
      const updated = new Set(prev)
      updated.delete(itemId)
      return updated
    })

    const { error: todoError } = await todoService.removeFromTodo(itemId)

    if (todoError) {
      // Rollback on error
      setTodoStatus(prev => new Set(prev).add(itemId))
      toast.error("Couldn't remove from list.")
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto" role="status" aria-live="polite">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-full mb-6" />
        <ItemsSkeleton />
        <span className="sr-only">Loading topic details...</span>
      </div>
    )
  }

  // Error state
  if (error || !topic) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-2 font-medium" role="alert">
              Topic not found
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {error || "Maybe it ran away. Topics do that sometimes."}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/topics">Back to topics</Link>
            </Button>
          </Card>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <SEO
        title={`Best ${topic.name} Rated by Real People`}
        description={`Discover and rate ${topic.name.toLowerCase()}. See what others think and add your favorites to your collection.`}
        url={`/topics/${topic.slug}`}
      />

      <div className="max-w-4xl mx-auto">
        {/* Topic Header */}
        <motion.div
          className="mb-6"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-1">
            {topic.icon && <span className="text-3xl">{topic.icon}</span>}
            <h1 className="text-xl font-bold">{topic.name}</h1>
          </div>
          {tagline && (
            <p className="text-sm text-muted-foreground italic">{tagline}</p>
          )}
        </motion.div>

        {/* Search Input */}
        <motion.div
          className="mb-4 relative"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            type="text"
            placeholder={`Search ${topic.name.toLowerCase()}...`}
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-10 pl-9"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          )}
        </motion.div>

        {/* Filter Pills */}
        <motion.div
          className="flex gap-2 mb-6 flex-wrap"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {[
            { key: 'all', label: 'All' },
            { key: '5star', label: '5★' },
            { key: '4plus', label: '4★+' },
            { key: 'new', label: 'New' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={activeFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(key as FilterOption)}
              className="h-7 px-3 text-xs"
            >
              {label}
            </Button>
          ))}

          {/* Results count */}
          {!searching && (
            <Badge variant="secondary" className="ml-auto h-7 px-3">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </Badge>
          )}
        </motion.div>

        {/* Items Grid or Empty State */}
        {items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ItemCard
                      item={{ ...item, topic }}
                      onClick={() => handleItemClick(item)}
                      avgRating={item.avg_rating}
                      ratingCount={item.rating_count}
                      initialUserRating={userRatings.get(item.id) ?? null}
                      isInTodo={todoStatus.has(item.id)}
                      onAddToTodo={() => handleAddToTodo(item.id)}
                      onRemoveFromTodo={() => handleRemoveFromTodo(item.id)}
                      isUserDataLoading={loadingUserData}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={searching}
              className="mt-8"
            />
          </>
        ) : (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-2 text-sm">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : activeFilter !== 'all'
                    ? 'No items match this filter.'
                    : 'No items yet. Be the first to search for something.'}
              </p>
              <p className="text-xs text-muted-foreground italic">
                {searchQuery
                  ? "Try a different search. I promise I'm looking."
                  : activeFilter !== 'all'
                    ? 'Try removing filters or search for something new.'
                    : 'The database grows with every search. In theory.'}
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        avgRating={selectedItem?.avg_rating}
        ratingCount={selectedItem?.rating_count}
        userRating={selectedItem ? userRatings.get(selectedItem.id) ?? null : null}
        onRatingChange={handleRatingChange}
        isInTodo={selectedItem ? todoStatus.has(selectedItem.id) : false}
        onAddToTodo={selectedItem ? () => handleAddToTodo(selectedItem.id) : undefined}
        onRemoveFromTodo={selectedItem ? () => handleRemoveFromTodo(selectedItem.id) : undefined}
        isAuthenticated={!!user}
      />
    </PageTransition>
  )
}
