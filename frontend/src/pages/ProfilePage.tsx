import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { StarRating } from '../components/StarRating'
import type { Item, Topic } from '../types'

interface RatingWithItem {
  id: string
  user_id: string
  item_id: string
  rating: number
  notes: string | null
  created_at: string
  updated_at: string
  item: Item & { topic: Topic }
}

interface RatingsByTopic {
  topic: Topic
  ratings: Array<{
    id: string
    rating: number
    notes: string | null
    item: Item
  }>
}

export function ProfilePage() {
  const { user } = useAuthStore()
  const [ratingsByTopic, setRatingsByTopic] = useState<RatingsByTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function fetchRatings() {
      const { data: ratings, error } = await supabase
        .from('user_ratings')
        .select(`
          *,
          item:items (
            *,
            topic:topics (*)
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching ratings:', error)
        setLoading(false)
        return
      }

      // Group ratings by topic
      const grouped: Record<string, RatingsByTopic> = {}

      for (const rating of (ratings as RatingWithItem[]) || []) {
        const item = rating.item
        const topic = item?.topic

        if (!topic) continue

        if (!grouped[topic.id]) {
          grouped[topic.id] = { topic, ratings: [] }
        }
        // Extract topic from item to avoid storing it redundantly
        const { topic: _topic, ...itemWithoutTopic } = item
        grouped[topic.id].ratings.push({
          id: rating.id,
          rating: rating.rating,
          notes: rating.notes,
          item: itemWithoutTopic
        })
      }

      setRatingsByTopic(Object.values(grouped))
      setLoading(false)
    }

    fetchRatings()
  }, [user])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading your favorites...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Your Preferables</h1>
      <p className="text-muted-foreground mb-8">
        Everything you've rated, organized by topic.
      </p>

      {ratingsByTopic.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-2">
            You haven't rated anything yet.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Go find something you love and give it some stars.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {ratingsByTopic.map(({ topic, ratings }) => (
            <div key={topic.id}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>{topic.icon}</span>
                <span>{topic.name}</span>
                <span className="text-sm text-muted-foreground font-normal">
                  ({ratings.length})
                </span>
              </h2>

              <div className="grid gap-3">
                {ratings.map((rating) => (
                  <div
                    key={rating.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{rating.item?.name}</p>
                      {rating.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {rating.notes}
                        </p>
                      )}
                    </div>
                    <StarRating value={rating.rating} readOnly size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
