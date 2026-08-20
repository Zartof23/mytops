import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flagService, DUPLICATE_FLAG_MESSAGE } from './flagService'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() }
  }
}))

const authed = (id: string) => ({
  data: {
    user: {
      id, email: 'test@example.com', app_metadata: {}, user_metadata: {},
      aud: 'authenticated', created_at: '2026-01-01T00:00:00Z'
    } as User
  },
  error: null
})

const mockInsert = (result: { data: unknown; error: unknown }) => {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  vi.mocked(supabase.from).mockReturnValue({ insert } as never)
  return insert
}

describe('flagService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createFlag', () => {
    it('returns an error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never)

      const result = await flagService.createFlag('item-1', 'The director name is wrong')

      expect(result.error?.message).toBe('Must be signed in to flag an item')
      expect(result.data).toBeNull()
    })

    it('rejects a reason shorter than 10 characters without hitting the network', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)

      const result = await flagService.createFlag('item-1', 'too short')

      expect(result.error?.message).toBe('Tell us a bit more — at least 10 characters')
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('inserts the flag with the trimmed reason', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)
      const insert = mockInsert({ data: { id: 'f1', item_id: 'item-1', status: 'open' }, error: null })

      const result = await flagService.createFlag('item-1', '  The director name is wrong  ')

      expect(insert).toHaveBeenCalledWith({
        item_id: 'item-1',
        user_id: 'u1',
        reason: 'The director name is wrong'
      })
      expect(result.data?.id).toBe('f1')
      expect(result.error).toBeNull()
    })

    it('maps a unique-violation to the duplicate-flag message', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('u1') as never)
      mockInsert({ data: null, error: { code: '23505', message: 'duplicate key value' } })

      const result = await flagService.createFlag('item-1', 'The director name is wrong')

      expect(result.error?.message).toBe(DUPLICATE_FLAG_MESSAGE)
      expect(result.data).toBeNull()
    })
  })

  describe('getMyFlagForItem', () => {
    it('returns null data when signed out rather than erroring', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never)

      const result = await flagService.getMyFlagForItem('item-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  describe('resolveFlag', () => {
    it('stamps status, note and resolved_at', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue(authed('admin-1') as never)
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      vi.mocked(supabase.from).mockReturnValue({ update } as never)

      const result = await flagService.resolveFlag('f1', 'resolved', 'Re-scanned, fixed')

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolution_note: 'Re-scanned, fixed',
          resolved_by: 'admin-1'
        })
      )
      expect(eq).toHaveBeenCalledWith('id', 'f1')
      expect(result.error).toBeNull()
    })
  })
})
