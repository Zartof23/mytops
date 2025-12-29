import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDebouncedValue } from '../lib/hooks'
import { ItemCard } from '../components/ItemCard'
import type { Topic, Item } from '../types'

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
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading topic...</p>
      </div>
    )
  }

  // Error state
  if (error || !topic) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-2">Topic not found</p>
        <p className="text-sm text-muted-foreground mb-4">
          {error || "Maybe it ran away. Topics do that sometimes."}
        </p>
        <Link
          to="/topics"
          className="text-sm text-primary hover:underline"
        >
          Back to topics
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Topic Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {topic.icon && <span className="text-4xl">{topic.icon}</span>}
          <h1 className="text-2xl font-bold">{topic.name}</h1>
        </div>
        {topic.description && (
          <p className="text-muted-foreground">{topic.description}</p>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-6 relative">
        <label htmlFor="search" className="sr-only">
          Search {topic.name.toLowerCase()}
        </label>
        <input
          id="search"
          type="text"
          placeholder={`Search ${topic.name.toLowerCase()}...`}
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            Searching...
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
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-2">
            {searchQuery
              ? `No results for "${searchQuery}"`
              : 'No items yet. Be the first to search for something.'}
          </p>
          <p className="text-sm text-muted-foreground italic">
            {searchQuery
              ? "Try a different search. I promise I'm looking."
              : 'The database grows with every search. In theory.'}
          </p>
        </div>
      )}
    </div>
  )
}
