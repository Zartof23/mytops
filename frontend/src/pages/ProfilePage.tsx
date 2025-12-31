import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { StarRating } from '../components/StarRating'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(2)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { topic: _, ...itemWithoutTopic } = item
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
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <ProfileSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Your Preferables</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Everything you've rated, organized by topic.
      </p>

      {ratingsByTopic.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">
            You haven't rated anything yet.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Go find something you love and give it some stars.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {ratingsByTopic.map(({ topic, ratings }, index) => (
            <div key={topic.id}>
              {index > 0 && <Separator className="mb-6" />}
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
                <span>{topic.icon}</span>
                <span>{topic.name}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  ({ratings.length})
                </span>
              </h2>

              <div className="space-y-2">
                {ratings.map((rating) => (
                  <Card
                    key={rating.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{rating.item?.name}</p>
                      {rating.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {rating.notes}
                        </p>
                      )}
                    </div>
                    <StarRating value={rating.rating} readOnly size="sm" />
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
