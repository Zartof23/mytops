import { describe, it, expect, vi, beforeEach } from 'vitest'
import { profileService } from './profileService'
import { supabase } from '../lib/supabase'

// Mock the supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}))

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCurrentProfile', () => {
    it('should return error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      } as any)

      const result = await profileService.getCurrentProfile()

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('Not authenticated')
    })

    it('should return profile when authenticated', async () => {
      const mockProfile = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
        bio: 'Test bio',
        is_public: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } } as any,
        error: null
      })

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.getCurrentProfile()

      expect(result.data).toEqual(mockProfile)
      expect(result.error).toBeNull()
    })
  })

  describe('getProfileByUsername', () => {
    it('should return null for non-existent or private profile', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.getProfileByUsername('nonexistent')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull() // Not an error, just not found
    })

    it('should return profile with ratings for public profile', async () => {
      const mockProfile = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
        bio: null,
        is_public: true
      }

      const mockRatings = [
        { id: 'r1', rating: 5, item: { id: 'i1', name: 'Item 1', topic: { id: 't1' } } }
      ]

      // First call returns profile
      const profileChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
      }

      // Second call returns ratings
      const ratingsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return profileChain as any
        return ratingsChain as any
      })

      const result = await profileService.getProfileByUsername('testuser')

      expect(result.data?.username).toBe('testuser')
      expect(result.data?.ratings).toBeDefined()
      expect(result.error).toBeNull()
    })
  })

  describe('updateProfile', () => {
    it('should return error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      } as any)

      const result = await profileService.updateProfile({ display_name: 'New Name' })

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('Not authenticated')
    })

    it('should update profile when authenticated', async () => {
      const mockUpdatedProfile = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'New Name',
        bio: null,
        is_public: true,
        updated_at: '2025-01-02T00:00:00Z'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } } as any,
        error: null
      })

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedProfile, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.updateProfile({ display_name: 'New Name' })

      expect(result.data?.display_name).toBe('New Name')
      expect(result.error).toBeNull()
    })
  })

  describe('isUsernameAvailable', () => {
    it('should return true for available username', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } } as any,
        error: null
      })

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.isUsernameAvailable('newuser')

      expect(result.available).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should return true if current user owns the username', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } } as any,
        error: null
      })

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.isUsernameAvailable('myusername')

      expect(result.available).toBe(true)
    })

    it('should return false if another user owns the username', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } } as any,
        error: null
      })

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-2' }, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.isUsernameAvailable('takenuser')

      expect(result.available).toBe(false)
    })
  })

  describe('getTopRatedItems', () => {
    it('should return 5-star items for user', async () => {
      const mockRatings = [
        { id: 'r1', rating: 5, item: { id: 'i1', name: 'Top Item', topic: { id: 't1' } } }
      ]

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockRatings, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.getTopRatedItems('user-1', 10)

      expect(result.data?.length).toBe(1)
      expect(result.data?.[0].rating).toBe(5)
      expect(result.error).toBeNull()
    })

    it('should handle database errors', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }
      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await profileService.getTopRatedItems('user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
    })
  })
})
