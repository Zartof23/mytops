import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDebouncedValue } from '../lib/hooks'
import { ItemCard } from '../components/ItemCard'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { Topic, Item } from '../types'

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

  const [topic, setTopic] = useState<Topic | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce search query - waits 300ms after user stops typing
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  // Fetch topic on mount
  useEffect(() => {
    async function fetchTopic() {
      if (!slug) {
        setError('No topic specified')
        setLoading(false)
        return
      }

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
      await fetchItems(data.id, '')
      setLoading(false)
    }

    fetchTopic()
  }, [slug])

  // Fetch items for topic
  async function fetchItems(topicId: string, query: string) {
    setSearching(true)

    let queryBuilder = supabase
      .from('items')
      .select('*')
      .eq('topic_id', topicId)
      .order('name')

    if (query.trim()) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`)
    }

    const { data, error: itemsError } = await queryBuilder

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      setSearching(false)
      return
    }

    setItems(data || [])
    setSearching(false)
  }

  // Fetch items when debounced search query changes
  useEffect(() => {
    if (topic) {
      fetchItems(topic.id, debouncedSearchQuery)
    }
  }, [debouncedSearchQuery, topic])

  // Handle search input - just updates state, actual fetch is debounced
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
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
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Topic Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {topic.icon && <span className="text-3xl">{topic.icon}</span>}
          <h1 className="text-xl font-bold">{topic.name}</h1>
        </div>
        {topic.description && (
          <p className="text-sm text-muted-foreground">{topic.description}</p>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-6 relative">
        <Input
          id="search"
          type="text"
          placeholder={`Search ${topic.name.toLowerCase()}...`}
          value={searchQuery}
          onChange={handleSearchChange}
          className="h-10"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        )}
      </div>

      {/* Items Grid or Empty State */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2 text-sm">
            {searchQuery
              ? `No results for "${searchQuery}"`
              : 'No items yet. Be the first to search for something.'}
          </p>
          <p className="text-xs text-muted-foreground italic">
            {searchQuery
              ? "Try a different search. I promise I'm looking."
              : 'The database grows with every search. In theory.'}
          </p>
        </Card>
      )}
    </div>
  )
}
