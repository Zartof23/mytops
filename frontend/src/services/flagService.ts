import { supabase } from '../lib/supabase'
import type { ItemFlag, FlagStatus } from '../types'

export const DUPLICATE_FLAG_MESSAGE =
  "You've already flagged this one — it's sitting in the queue."

export const MIN_REASON_LENGTH = 10
export const MAX_REASON_LENGTH = 1000

const FLAG_SELECT = `
  *,
  item:items (*, topic:topics (*)),
  reporter:profiles!item_flags_user_id_fkey (id, username, display_name)
`

/**
 * Service for user-submitted item flags and the admin flag queue.
 */
export const flagService = {
  /**
   * Report an item for incorrect information.
   */
  async createFlag(itemId: string, reason: string): Promise<{
    data: ItemFlag | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Must be signed in to flag an item') }
      }

      const trimmed = reason.trim()
      if (trimmed.length < MIN_REASON_LENGTH) {
        return { data: null, error: new Error('Tell us a bit more — at least 10 characters') }
      }
      if (trimmed.length > MAX_REASON_LENGTH) {
        return { data: null, error: new Error('That is a lot of detail. Keep it under 1000 characters.') }
      }

      const { data, error } = await supabase
        .from('item_flags')
        .insert({ item_id: itemId, user_id: user.id, reason: trimmed })
        .select()
        .single()

      if (error) {
        // Partial unique index on (item_id, user_id) where status = 'open'
        if ((error as { code?: string }).code === '23505') {
          return { data: null, error: new Error(DUPLICATE_FLAG_MESSAGE) }
        }
        throw error
      }

      return { data: data as ItemFlag, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * The current user's open flag for an item, if any.
   */
  async getMyFlagForItem(itemId: string): Promise<{
    data: ItemFlag | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: null }
      }

      const { data, error } = await supabase
        .from('item_flags')
        .select('*')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle()

      if (error) throw error
      return { data: (data as ItemFlag) ?? null, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Admin queue. RLS restricts the result set to admins automatically.
   */
  async listFlags(status: FlagStatus, page = 0, pageSize = 20): Promise<{
    data: ItemFlag[] | null
    count: number
    error: Error | null
  }> {
    try {
      const from = page * pageSize
      const { data, error, count } = await supabase
        .from('item_flags')
        .select(FLAG_SELECT, { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) throw error
      return { data: (data ?? []) as unknown as ItemFlag[], count: count ?? 0, error: null }
    } catch (error) {
      return { data: null, count: 0, error: error as Error }
    }
  },

  /**
   * Close a flag. Admin only — enforced by RLS, not by this function.
   */
  async resolveFlag(
    flagId: string,
    status: 'resolved' | 'rejected',
    note?: string
  ): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('Must be signed in') }
      }

      const { error } = await supabase
        .from('item_flags')
        .update({
          status,
          resolution_note: note?.trim() || null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', flagId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}
