import { supabase } from '../lib/supabase'
import type { Item, ItemLinks, RescanPreview } from '../types'
import { extractEdgeFunctionErrorMessage } from './edgeFunctionError'

/**
 * Admin-only item operations.
 *
 * Every method here is a thin wrapper. Authorization is enforced in the
 * database (is_admin() inside the RPCs) and in the Edge Function — never
 * by this file. Hiding a button is not a security control.
 */
export const adminService = {
  /**
   * What would be severed if this item were deleted.
   */
  async getItemLinks(itemId: string): Promise<{
    data: ItemLinks | null
    error: Error | null
  }> {
    const { data, error } = await supabase.rpc('admin_item_links', { p_item_id: itemId })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as ItemLinks, error: null }
  },

  /**
   * Hard delete. With force = false the server refuses when links exist.
   */
  async deleteItem(itemId: string, force: boolean): Promise<{ error: Error | null }> {
    const { error } = await supabase.rpc('admin_delete_item', {
      p_item_id: itemId,
      p_force: force
    })

    if (error) return { error: new Error(error.message) }
    return { error: null }
  },

  /**
   * Re-check an item's information on the web. Read-only — nothing is written.
   * The proposal is persisted server-side and returned as `proposal_id`,
   * which `applyRescan` uses to write from exactly what was reviewed.
   */
  async previewRescan(itemId: string): Promise<{
    data: RescanPreview | null
    error: Error | null
  }> {
    const { data, error } = await supabase.functions.invoke('admin-rescan-item', {
      body: { item_id: itemId }
    })

    if (error) {
      const message = await extractEdgeFunctionErrorMessage(error, error.message)
      return { data: null, error: new Error(message) }
    }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data: data as RescanPreview, error: null }
  },

  /**
   * Write the admin-approved subset of a previously stored proposal.
   */
  async applyRescan(proposalId: string, fields: string[]): Promise<{
    data: Item | null
    error: Error | null
  }> {
    const { data, error } = await supabase.functions.invoke('admin-rescan-item/apply', {
      body: { proposal_id: proposalId, fields }
    })

    if (error) {
      const message = await extractEdgeFunctionErrorMessage(error, error.message)
      return { data: null, error: new Error(message) }
    }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data: data.item as Item, error: null }
  }
}
