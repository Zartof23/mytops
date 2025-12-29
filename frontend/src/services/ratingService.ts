import { supabase } from '../lib/supabase'
import type { UserRating } from '../types'

export interface CreateRatingInput {
  item_id: string
  rating: number
  notes?: string
}

export interface RatingResult {
  data: UserRating | null
  error: Error | null
}

export const ratingService = {
  /**
   * Create or update a rating for an item.
   * Uses upsert to handle the UNIQUE(user_id, item_id) constraint.
   */
  async upsertRating(input: CreateRatingInput): Promise<RatingResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return { data: null, error: new Error('Must be authenticated to rate') }
    }

    const { data, error } = await supabase
      .from('user_ratings')
      .upsert(
        {
          user_id: session.user.id,
          item_id: input.item_id,
          rating: input.rating,
          notes: input.notes || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,item_id', ignoreDuplicates: false }
      )
      .select()
      .single()

    return {
      data: data as UserRating | null,
      error: error ? new Error(error.message) : null
    }
  },

  /**
   * Get the current user's rating for a specific item.
   * Returns null if user hasn't rated the item.
   */
  async getUserRating(itemId: string): Promise<RatingResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('item_id', itemId)
      .single()

    // PGRST116 = no rows returned, which is not an error for our use case
    if (error && error.code !== 'PGRST116') {
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as UserRating | null, error: null }
  },

  /**
   * Delete the current user's rating for an item.
   */
  async deleteRating(itemId: string): Promise<{ error: Error | null }> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return { error: new Error('Must be authenticated to delete rating') }
    }

    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('user_id', session.user.id)
      .eq('item_id', itemId)

    return { error: error ? new Error(error.message) : null }
  }
}
