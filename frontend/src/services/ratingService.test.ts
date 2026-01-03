import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ratingService } from './ratingService'
import { supabase } from '../lib/supabase'
import type { User, AuthError } from '@supabase/supabase-js'

// Mock the supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}))

// Helper to create mock user response for unauthenticated state
const mockUnauthenticatedResponse = () => ({
  data: { user: null },
  error: {
    message: 'Auth session missing',
    status: 401,
    name: 'AuthSessionMissingError'
  } as AuthError
})

// Helper to create mock user response for authenticated state
const mockAuthenticatedResponse = (userId: string) => ({
  data: {
    user: {
      id: userId,
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2025-01-01T00:00:00Z'
    } as User
  },
  error: null
})

describe('ratingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('upsertRating', () => {
    it('should return error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockUnauthenticatedResponse())

      const result = await ratingService.upsertRating({
        item_id: 'item-1',
        rating: 5
      })

      expect(result.error?.message).toBe('Must be authenticated to rate')
      expect(result.data).toBeNull()
    })

    it('should upsert rating when authenticated', async () => {
      const mockRating = {
        id: 'rating-1',
        user_id: 'user-1',
        item_id: 'item-1',
        rating: 5,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuthenticatedResponse('user-1'))

      const mockChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRating, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await ratingService.upsertRating({
        item_id: 'item-1',
        rating: 5
      })

      expect(result.data).toEqual(mockRating)
      expect(result.error).toBeNull()
      expect(supabase.from).toHaveBeenCalledWith('user_ratings')
    })

    it('should handle database errors', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuthenticatedResponse('user-1'))

      const mockChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'ERROR' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await ratingService.upsertRating({
        item_id: 'item-1',
        rating: 5
      })

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
    })
  })

  describe('getUserRating', () => {
    it('should return null data and no error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockUnauthenticatedResponse())

      const result = await ratingService.getUserRating('item-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
    })

    it('should return rating when authenticated and rating exists', async () => {
      const mockRating = {
        id: 'rating-1',
        user_id: 'user-1',
        item_id: 'item-1',
        rating: 4,
        notes: 'Great movie!',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuthenticatedResponse('user-1'))

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRating, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await ratingService.getUserRating('item-1')

      expect(result.data).toEqual(mockRating)
      expect(result.error).toBeNull()
    })

    it('should return null when no rating exists (PGRST116)', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuthenticatedResponse('user-1'))

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await ratingService.getUserRating('item-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
    })
  })

  describe('deleteRating', () => {
    it('should return error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockUnauthenticatedResponse())

      const result = await ratingService.deleteRating('item-1')

      expect(result.error?.message).toBe('Must be authenticated to delete rating')
    })

    it('should delete rating when authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuthenticatedResponse('user-1'))

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis()
      }
      // The last eq() call resolves the promise
      mockChain.eq = vi.fn().mockImplementation(() => {
        return { eq: vi.fn().mockResolvedValue({ error: null }) }
      })
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await ratingService.deleteRating('item-1')

      expect(result.error).toBeNull()
      expect(supabase.from).toHaveBeenCalledWith('user_ratings')
    })
  })
})
