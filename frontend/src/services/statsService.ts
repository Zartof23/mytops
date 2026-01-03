import { supabase } from '../lib/supabase'
import type { Item, Topic, ItemWithStats } from '../types'

export interface ItemStats {
  avgRating: number
  ratingCount: number
}

export interface UserStats {
  totalRatings: number
  byTopic: Record<string, { count: number; topicName: string; topicIcon: string | null }>
}

export interface PopularItem extends Item {
  avgRating: number
  ratingCount: number
  topic?: Topic
}

export interface FilterParams {
  topicId: string
  searchQuery?: string
  minAvgRating?: number
  releasedAfter?: Date
  limit?: number
  offset?: number
}

export interface FilteredItemsResult {
  items: ItemWithStats[]
  totalCount: number
}

/**
 * Service for fetching community statistics
 */
export const statsService = {
  /**
   * Get average rating and count for a specific item
   */
  async getItemStats(itemId: string): Promise<{ data: ItemStats | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('user_ratings')
        .select('rating')
        .eq('item_id', itemId)

      if (error) throw error

      if (!data || data.length === 0) {
        return { data: { avgRating: 0, ratingCount: 0 }, error: null }
      }

      const sum = data.reduce((acc, r) => acc + r.rating, 0)
      const avgRating = sum / data.length

      return {
        data: {
          avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          ratingCount: data.length
        },
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get stats for multiple items at once (batch)
   * Returns a map of itemId -> stats
   */
  async getItemStatsBatch(itemIds: string[]): Promise<{
    data: Map<string, ItemStats> | null
    error: Error | null
  }> {
    try {
      if (itemIds.length === 0) {
        return { data: new Map(), error: null }
      }

      const { data, error } = await supabase
        .from('user_ratings')
        .select('item_id, rating')
        .in('item_id', itemIds)

      if (error) throw error

      // Group by item_id and calculate stats
      const statsMap = new Map<string, ItemStats>()

      // Initialize all items with zero stats
      itemIds.forEach(id => {
        statsMap.set(id, { avgRating: 0, ratingCount: 0 })
      })

      // Group ratings by item
      const ratingsByItem = new Map<string, number[]>()
      data?.forEach(r => {
        if (!ratingsByItem.has(r.item_id)) {
          ratingsByItem.set(r.item_id, [])
        }
        ratingsByItem.get(r.item_id)!.push(r.rating)
      })

      // Calculate stats for each item
      ratingsByItem.forEach((ratings, itemId) => {
        const sum = ratings.reduce((a, b) => a + b, 0)
        statsMap.set(itemId, {
          avgRating: Math.round((sum / ratings.length) * 10) / 10,
          ratingCount: ratings.length
        })
      })

      return { data: statsMap, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get user's rating statistics by topic
   */
  async getUserStats(userId: string): Promise<{ data: UserStats | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('user_ratings')
        .select(`
          id,
          item:items (
            topic_id,
            topic:topics (
              id,
              name,
              icon
            )
          )
        `)
        .eq('user_id', userId)

      if (error) throw error

      const byTopic: UserStats['byTopic'] = {}
      let totalRatings = 0

      data?.forEach(rating => {
        totalRatings++
        const item = rating.item as unknown as { topic: Topic | null } | null
        const topic = item?.topic
        if (topic) {
          if (!byTopic[topic.id]) {
            byTopic[topic.id] = {
              count: 0,
              topicName: topic.name,
              topicIcon: topic.icon
            }
          }
          byTopic[topic.id].count++
        }
      })

      return {
        data: { totalRatings, byTopic },
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get popular items for homepage carousel
   * Returns items with highest rating count and good average
   */
  async getPopularItems(limit: number = 6): Promise<{
    data: PopularItem[] | null
    error: Error | null
  }> {
    try {
      // Get all ratings with item and topic data
      const { data: ratings, error: ratingsError } = await supabase
        .from('user_ratings')
        .select(`
          rating,
          item:items (
            *,
            topic:topics (*)
          )
        `)

      if (ratingsError) throw ratingsError

      // Aggregate ratings by item
      const itemStats = new Map<string, {
        item: Item & { topic: Topic }
        ratings: number[]
      }>()

      ratings?.forEach(r => {
        const item = r.item as unknown as (Item & { topic: Topic })
        if (!item) return

        if (!itemStats.has(item.id)) {
          itemStats.set(item.id, { item, ratings: [] })
        }
        itemStats.get(item.id)!.ratings.push(r.rating)
      })

      // Calculate averages and sort by popularity (rating count * avg)
      const popularItems: PopularItem[] = []
      itemStats.forEach(({ item, ratings }) => {
        const sum = ratings.reduce((a, b) => a + b, 0)
        const avgRating = sum / ratings.length
        popularItems.push({
          ...item,
          avgRating: Math.round(avgRating * 10) / 10,
          ratingCount: ratings.length,
          topic: item.topic
        })
      })

      // Sort by a combination of count and rating (weighted)
      // Higher ratings with more votes rank higher
      popularItems.sort((a, b) => {
        const scoreA = a.ratingCount * a.avgRating
        const scoreB = b.ratingCount * b.avgRating
        return scoreB - scoreA
      })

      return {
        data: popularItems.slice(0, limit),
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get recently rated items
   */
  async getRecentlyRatedItems(limit: number = 10): Promise<{
    data: PopularItem[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('user_ratings')
        .select(`
          rating,
          created_at,
          item:items (
            *,
            topic:topics (*)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit * 3) // Fetch more to dedupe

      if (error) throw error

      // Dedupe by item and get most recent rating per item
      const seenItems = new Set<string>()
      const recentItems: PopularItem[] = []

      data?.forEach(r => {
        const item = r.item as unknown as (Item & { topic: Topic })
        if (!item || seenItems.has(item.id)) return

        seenItems.add(item.id)
        recentItems.push({
          ...item,
          avgRating: r.rating,
          ratingCount: 1, // Just showing the recent rating
          topic: item.topic
        })
      })

      return {
        data: recentItems.slice(0, limit),
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get items with stats using server-side filtering (via database function)
   * This is the main method for TopicDetailPage with proper pagination and filtering
   */
  async getFilteredItems(params: FilterParams): Promise<{
    data: FilteredItemsResult | null
    error: Error | null
  }> {
    try {
      const {
        topicId,
        searchQuery,
        minAvgRating,
        releasedAfter,
        limit = 50,
        offset = 0
      } = params

      // Call the database function for filtered items
      const { data: items, error: itemsError } = await supabase.rpc('get_items_with_stats', {
        p_topic_id: topicId,
        p_search_query: searchQuery?.trim() || null,
        p_min_avg_rating: minAvgRating ?? null,
        p_released_after: releasedAfter?.toISOString().split('T')[0] ?? null,
        p_limit: limit,
        p_offset: offset
      })

      if (itemsError) throw itemsError

      // Call the count function for pagination
      const { data: totalCount, error: countError } = await supabase.rpc('get_items_with_stats_count', {
        p_topic_id: topicId,
        p_search_query: searchQuery?.trim() || null,
        p_min_avg_rating: minAvgRating ?? null,
        p_released_after: releasedAfter?.toISOString().split('T')[0] ?? null
      })

      if (countError) throw countError

      return {
        data: {
          items: items as ItemWithStats[],
          totalCount: totalCount as number
        },
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Batch fetch user ratings for multiple items
   * Uses database function for efficiency
   * @param itemIds - Array of item IDs to fetch ratings for
   * @param userId - User ID to fetch ratings for (pass from auth store to avoid extra API call)
   */
  async getUserRatingsBatch(itemIds: string[], userId?: string): Promise<{
    data: Map<string, number> | null
    error: Error | null
  }> {
    try {
      if (itemIds.length === 0) {
        return { data: new Map(), error: null }
      }

      // Use provided userId or fall back to fetching (for backwards compatibility)
      let resolvedUserId = userId
      if (!resolvedUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return { data: new Map(), error: null }
        }
        resolvedUserId = user.id
      }

      const { data, error } = await supabase.rpc('get_user_ratings_for_items', {
        p_user_id: resolvedUserId,
        p_item_ids: itemIds
      })

      if (error) throw error

      const ratingsMap = new Map<string, number>()
      data?.forEach((r: { item_id: string; rating: number }) => {
        ratingsMap.set(r.item_id, r.rating)
      })

      return { data: ratingsMap, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }
}
