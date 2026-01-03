import { describe, it, expect, vi, beforeEach } from 'vitest'
import { statsService } from './statsService'
import { supabase } from '../lib/supabase'

// Mock the supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('statsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getItemStats', () => {
    it('should return zero stats for item with no ratings', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getItemStats('item-1')

      expect(result.data).toEqual({ avgRating: 0, ratingCount: 0 })
      expect(result.error).toBeNull()
    })

    it('should calculate average rating correctly', async () => {
      const mockRatings = [
        { rating: 5 },
        { rating: 4 },
        { rating: 3 }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getItemStats('item-1')

      expect(result.data).toEqual({ avgRating: 4, ratingCount: 3 })
      expect(result.error).toBeNull()
    })

    it('should round average rating to one decimal', async () => {
      const mockRatings = [
        { rating: 5 },
        { rating: 4 },
        { rating: 4 }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getItemStats('item-1')

      // (5+4+4)/3 = 4.333... rounds to 4.3
      expect(result.data?.avgRating).toBe(4.3)
    })

    it('should handle database errors', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getItemStats('item-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
    })
  })

  describe('getItemStatsBatch', () => {
    it('should return empty map for empty item list', async () => {
      const result = await statsService.getItemStatsBatch([])

      expect(result.data).toEqual(new Map())
      expect(result.error).toBeNull()
    })

    it('should calculate stats for multiple items', async () => {
      const mockRatings = [
        { item_id: 'item-1', rating: 5 },
        { item_id: 'item-1', rating: 4 },
        { item_id: 'item-2', rating: 3 }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getItemStatsBatch(['item-1', 'item-2', 'item-3'])

      expect(result.data?.get('item-1')).toEqual({ avgRating: 4.5, ratingCount: 2 })
      expect(result.data?.get('item-2')).toEqual({ avgRating: 3, ratingCount: 1 })
      expect(result.data?.get('item-3')).toEqual({ avgRating: 0, ratingCount: 0 })
    })
  })

  describe('getUserStats', () => {
    it('should return stats grouped by topic', async () => {
      const mockRatings = [
        { id: '1', item: { topic_id: 'topic-1', topic: { id: 'topic-1', name: 'Movies', icon: '🎬' } } },
        { id: '2', item: { topic_id: 'topic-1', topic: { id: 'topic-1', name: 'Movies', icon: '🎬' } } },
        { id: '3', item: { topic_id: 'topic-2', topic: { id: 'topic-2', name: 'Books', icon: '📚' } } }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getUserStats('user-1')

      expect(result.data?.totalRatings).toBe(3)
      expect(result.data?.byTopic['topic-1']).toEqual({
        count: 2,
        topicName: 'Movies',
        topicIcon: '🎬'
      })
      expect(result.data?.byTopic['topic-2']).toEqual({
        count: 1,
        topicName: 'Books',
        topicIcon: '📚'
      })
    })
  })

  describe('getPopularItems', () => {
    it('should return popular items sorted by score', async () => {
      const mockRatings = [
        { rating: 5, item: { id: 'item-1', name: 'Item 1', topic: { id: 'topic-1' } } },
        { rating: 5, item: { id: 'item-1', name: 'Item 1', topic: { id: 'topic-1' } } },
        { rating: 4, item: { id: 'item-2', name: 'Item 2', topic: { id: 'topic-1' } } }
      ]

      const mockChain = {
        select: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getPopularItems(2)

      expect(result.data?.length).toBeLessThanOrEqual(2)
      expect(result.error).toBeNull()
    })

    it('should handle database errors', async () => {
      const mockChain = {
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getPopularItems()

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
    })
  })

  describe('getRecentlyRatedItems', () => {
    it('should return unique recently rated items', async () => {
      const mockRatings = [
        { rating: 5, created_at: '2025-01-01', item: { id: 'item-1', name: 'Item 1', topic: { id: 't1' } } },
        { rating: 4, created_at: '2025-01-01', item: { id: 'item-1', name: 'Item 1', topic: { id: 't1' } } }, // duplicate
        { rating: 3, created_at: '2025-01-01', item: { id: 'item-2', name: 'Item 2', topic: { id: 't1' } } }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await statsService.getRecentlyRatedItems(10)

      // Should dedupe - only 2 unique items
      expect(result.data?.length).toBe(2)
      expect(result.error).toBeNull()
    })
  })
})
