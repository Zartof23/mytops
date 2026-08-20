import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from './adminService'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: { invoke: vi.fn() }
  }
}))

describe('adminService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getItemLinks', () => {
    it('returns the link counts', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { rating_count: 3, todo_count: 1, flag_count: 2, raters: ['ada'] },
        error: null
      } as never)

      const result = await adminService.getItemLinks('item-1')

      expect(supabase.rpc).toHaveBeenCalledWith('admin_item_links', { p_item_id: 'item-1' })
      expect(result.data?.rating_count).toBe(3)
      expect(result.error).toBeNull()
    })

    it('surfaces a privilege error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null, error: { message: 'Admin privileges required' }
      } as never)

      const result = await adminService.getItemLinks('item-1')

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('Admin privileges required')
    })
  })

  describe('deleteItem', () => {
    it('passes force through to the RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { deleted: true }, error: null } as never)

      await adminService.deleteItem('item-1', true)

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_item', {
        p_item_id: 'item-1',
        p_force: true
      })
    })

    it('defaults to an unforced delete', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { deleted: true }, error: null } as never)

      await adminService.deleteItem('item-1', false)

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_item', {
        p_item_id: 'item-1',
        p_force: false
      })
    })

    it('returns the server error when links block the delete', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Item is linked to 3 rating(s) and 1 todo entries.' }
      } as never)

      const result = await adminService.deleteItem('item-1', false)

      expect(result.error?.message).toContain('3 rating(s)')
    })
  })

  describe('rescan', () => {
    it('previews without applying', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          proposal_id: 'p1',
          current: {},
          proposed: {},
          changed_fields: ['metadata.director'],
          confidence: 0.9,
          sources: []
        },
        error: null
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-rescan-item', {
        body: { item_id: 'item-1' }
      })
      expect(result.data?.changed_fields).toEqual(['metadata.director'])
      expect(result.data?.proposal_id).toBe('p1')
    })

    it('applies only the selected fields', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { item: { id: 'item-1' } }, error: null
      } as never)

      const result = await adminService.applyRescan('p1', ['metadata.director'])

      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-rescan-item/apply', {
        body: { proposal_id: 'p1', fields: ['metadata.director'] }
      })
      expect(result.data?.id).toBe('item-1')
    })

    it('surfaces an error returned in the response body (2xx with error field)', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { error: 'Admin privileges required' }, error: null
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(result.error?.message).toBe('Admin privileges required')
      expect(result.data).toBeNull()
    })

    it('surfaces the real message from a non-2xx FunctionsHttpError', async () => {
      const context = new Response(
        JSON.stringify({ error: 'That proposal expired — re-scan and review again' }),
        { status: 409 }
      )
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context })
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('That proposal expired — re-scan and review again')
    })

    it('falls back to the generic message when the error body cannot be parsed', async () => {
      const context = new Response('not json', { status: 500 })
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context })
      } as never)

      const result = await adminService.previewRescan('item-1')

      expect(result.data).toBeNull()
      expect(result.error?.message).toBe('Edge Function returned a non-2xx status code')
    })
  })
})
