import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
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
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/PageTransition'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Topic, ItemWithStats } from '../types'

// Witty taglines for each topic
const topicTaglines: Record<string, string> = {
  movies: 'Every masterpiece. Every guilty pleasure.',
  series: 'The ones you binged. The ones you pretend you didn\'t.',
  books: 'The ones you finished. The ones collecting dust.',
  anime: 'Your gateway into degeneracy. Own it.',
  games: 'Hundreds of hours well spent. Arguably.',
  restaurants: 'The spots you\'d actually recommend.',
}

type FilterOption = 'all' | '5star' | '4plus' | 'new'

const ITEMS_PER_PAGE = 24

// Map filter options to database parameters
function getFilterParams(filter: FilterOption): {
  minAvgRating?: number
  releasedAfter?: Date
} {
  switch (filter) {
    case '5star':
      return { minAvgRating: 4.8 }
    case '4plus':
      return { minAvgRating: 4.0 }
    case 'new':
      // Last 30 days
      return { releasedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
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

export function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [items, setItems] = useState<ItemWithStats[]>([])
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map())
  const [todoStatus, setTodoStatus] = useState<Set<string>>(new Set())
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [selectedItem, setSelectedItem] = useState<ItemWithStats | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Track last fetched params to prevent duplicate calls
  const lastFetchParams = useRef<string | null>(null)
  const hasFetchedTopic = useRef(false)
  const currentSlug = useRef<string | null>(null)

  // Debounce search query - waits 300ms after user stops typing
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  // Get tagline for current topic
  const tagline = topic ? topicTaglines[topic.slug] || topic.description : null
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // Fetch items with server-side filtering
  const fetchItems = useCallback(async (
    topicId: string,
    query: string,
    filter: FilterOption,
    page: number
  ) => {
    const fetchKey = `${topicId}-${query}-${filter}-${page}`

    // Prevent duplicate fetches
    if (lastFetchParams.current === fetchKey) {
      return
    }
    lastFetchParams.current = fetchKey

    setSearching(true)

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
      setSearching(false)
      return
    }

    setItems(data?.items || [])
    setTotalCount(data?.totalCount || 0)

    // Fetch user ratings and TODO status for these items if logged in
    if (user && data?.items && data.items.length > 0) {
      const itemIds = data.items.map(i => i.id)
      const [ratingsResult, todoResult] = await Promise.all([
        statsService.getUserRatingsBatch(itemIds, user.id),
        todoService.getTodoStatusBatch(itemIds)
      ])
      if (ratingsResult.data) {
        setUserRatings(ratingsResult.data)
      }
      if (todoResult.data) {
        setTodoStatus(todoResult.data)
      }
    }

    setSearching(false)
  }, [user])

  // Fetch topic on mount
  useEffect(() => {
    async function fetchTopic() {
      if (!slug) {
        setError('No topic specified')
        setLoading(false)
        return
      }

      // Prevent duplicate fetch on StrictMode or when only fetchItems ref changed
      if (hasFetchedTopic.current && currentSlug.current === slug) return
      hasFetchedTopic.current = true
      currentSlug.current = slug

      const { data, error: topicError } = await supabase
        .from('topics')
        .select('*')
        .eq('slug', slug)
        .single()

      if (topicError) {
        setError(topicError.message)
        setLoading(false)
        return
      }

      setTopic(data)
      // Initial fetch
      await fetchItems(data.id, '', 'all', 1)
      setLoading(false)
    }

    // Only reset state when slug actually changes
    if (currentSlug.current !== slug) {
      lastFetchParams.current = null
      hasFetchedTopic.current = false
      setSearchQuery('')
      setActiveFilter('all')
      setCurrentPage(1)
      setItems([])
      setUserRatings(new Map())
      setTodoStatus(new Set())
      setTotalCount(0)
      setSelectedItem(null)
      setIsModalOpen(false)
    }

    fetchTopic()
  }, [slug, fetchItems])

  // Fetch items when search/filter/page changes
  useEffect(() => {
    if (!topic || loading) return

    fetchItems(topic.id, debouncedSearchQuery, activeFilter, currentPage)
  }, [debouncedSearchQuery, activeFilter, currentPage, topic, loading, fetchItems])

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, activeFilter])

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Handle filter change
  const handleFilterChange = (filter: FilterOption) => {
    setActiveFilter(filter)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle item click - open modal
  const handleItemClick = (item: ItemWithStats) => {
    // Attach topic to item for modal display
    setSelectedItem({ ...item, topic } as ItemWithStats & { topic: Topic })
    setIsModalOpen(true)
  }

  // Handle rating change from modal
  const handleRatingChange = async (rating: number) => {
    if (!selectedItem || !topic) return

    // Optimistic update
    const newUserRatings = new Map(userRatings)
    newUserRatings.set(selectedItem.id, rating)
    setUserRatings(newUserRatings)

    // Remove from TODO if rated
    if (todoStatus.has(selectedItem.id)) {
      const newTodoStatus = new Set(todoStatus)
      newTodoStatus.delete(selectedItem.id)
      setTodoStatus(newTodoStatus)
    }

    // Save to database
    const { error: ratingError } = await ratingService.upsertRating({
      item_id: selectedItem.id,
      rating
    })

    if (ratingError) {
      // Rollback on error
      const rollbackRatings = new Map(userRatings)
      rollbackRatings.delete(selectedItem.id)
      setUserRatings(rollbackRatings)
      toast.error("Couldn't save that. The database is judging you.")
    } else {
      toast.success('Noted. Your taste is... interesting.')
    }
  }

  // Handle add to TODO from modal or card
  const handleAddToTodo = async (itemId: string) => {
    if (!topic) return

    // Optimistic update
    const newTodoStatus = new Set(todoStatus)
    newTodoStatus.add(itemId)
    setTodoStatus(newTodoStatus)

    const { error: todoError } = await todoService.addToTodo(itemId, topic.id)

    if (todoError) {
      // Rollback on error
      const rollbackTodoStatus = new Set(todoStatus)
      rollbackTodoStatus.delete(itemId)
      setTodoStatus(rollbackTodoStatus)
      toast.error("Couldn't add to list. Try again?")
    } else {
      toast.success('Added to your list. No pressure to actually watch it.')
    }
  }

  // Handle remove from TODO
  const handleRemoveFromTodo = async (itemId: string) => {
    // Optimistic update
    const newTodoStatus = new Set(todoStatus)
    newTodoStatus.delete(itemId)
    setTodoStatus(newTodoStatus)

    const { error: todoError } = await todoService.removeFromTodo(itemId)

    if (todoError) {
      // Rollback on error
      const rollbackTodoStatus = new Set(todoStatus)
      rollbackTodoStatus.add(itemId)
      setTodoStatus(rollbackTodoStatus)
      toast.error("Couldn't remove from list.")
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-full mb-6" />
        <ItemsSkeleton />
      </div>
    )
  }

  // Error state
  if (error || !topic) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-2 font-medium">Topic not found</p>
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
            <StaggerContainer
              key={`${debouncedSearchQuery}-${activeFilter}-${currentPage}`}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {items.map((item) => (
                <StaggerItem key={item.id}>
                  <ItemCard
                    item={{ ...item, topic }}
                    onClick={() => handleItemClick(item)}
                    avgRating={item.avg_rating}
                    ratingCount={item.rating_count}
                    initialUserRating={userRatings.get(item.id) ?? null}
                    isInTodo={todoStatus.has(item.id)}
                    onAddToTodo={() => handleAddToTodo(item.id)}
                    onRemoveFromTodo={() => handleRemoveFromTodo(item.id)}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>

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
