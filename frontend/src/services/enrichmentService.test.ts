import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichmentService } from './enrichmentService'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

// Mock the supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn()
    },
    functions: {
      invoke: vi.fn()
    },
    rpc: vi.fn(),
    from: vi.fn()
  }
}))

// Helper to create mock user
const mockUser = (userId: string): User => ({
  id: userId,
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2025-01-01T00:00:00Z'
})

describe('enrichmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enrichItem', () => {
    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })

      await expect(
        enrichmentService.enrichItem({
          topic_id: 'topic-123',
          topic_slug: 'movies',
          search_query: 'The Matrix'
        })
      ).rejects.toThrow('Authentication required')
    })

    it('should call edge function with correct parameters', async () => {
      const mockSession: Session = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser('user-123')
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          status: 'created',
          item: {
            id: 'item-123',
            name: 'The Matrix',
            slug: 'the-matrix',
            topic_id: 'topic-123'
          },
          message: 'Success'
        },
        error: null
      })

      const result = await enrichmentService.enrichItem({
        topic_id: 'topic-123',
        topic_slug: 'movies',
        search_query: 'The Matrix'
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('ai-enrich-item', {
        body: {
          topic_id: 'topic-123',
          topic_slug: 'movies',
          search_query: 'The Matrix'
        }
      })

      expect(result.status).toBe('created')
      expect(result.item.name).toBe('The Matrix')
    })

    it('should throw error when edge function returns error', async () => {
      const mockSession: Session = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser('user-123')
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          error: 'Rate limit exceeded'
        },
        error: null
      })

      await expect(
        enrichmentService.enrichItem({
          topic_id: 'topic-123',
          topic_slug: 'movies',
          search_query: 'The Matrix'
        })
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('checkRateLimit', () => {
    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null } as any,
        error: null
      })

      await expect(enrichmentService.checkRateLimit()).rejects.toThrow('Authentication required')
    })

    it('should return rate limit status', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser('user-123') },
        error: null
      })

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            requests_today: 2,
            daily_limit: 5,
            can_request: true
          }
        ],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as any)

      const result = await enrichmentService.checkRateLimit()

      expect(supabase.rpc).toHaveBeenCalledWith('check_enrichment_rate_limit', {
        p_user_id: 'user-123'
      })

      expect(result.requests_today).toBe(2)
      expect(result.daily_limit).toBe(5)
      expect(result.can_request).toBe(true)
    })

    it('should throw error when database call fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser('user-123') },
        error: null
      })

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('Database error') as any,
        count: null,
        status: 500,
        statusText: 'Error'
      } as any)

      await expect(enrichmentService.checkRateLimit()).rejects.toThrow('Database error')
    })
  })

  describe('getRequestHistory', () => {
    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null } as any,
        error: null
      })

      await expect(enrichmentService.getRequestHistory()).rejects.toThrow('Authentication required')
    })

    it('should return request history', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser('user-123') },
        error: null
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'req-1',
            search_query: 'The Matrix',
            status: 'completed'
          }
        ],
        error: null
      })

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit
      }) as any)

      const result = await enrichmentService.getRequestHistory(10)

      expect(supabase.from).toHaveBeenCalledWith('user_enrichment_requests')
      expect(result).toHaveLength(1)
      expect(result[0].search_query).toBe('The Matrix')
    })
  })
})
