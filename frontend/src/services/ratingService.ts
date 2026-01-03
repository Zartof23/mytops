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
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { data: null, error: new Error('Must be authenticated to rate') }
      }

      const { data, error } = await supabase
        .from('user_ratings')
        .upsert(
          {
            user_id: user.id,
            item_id: input.item_id,
            rating: input.rating,
            notes: input.notes || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,item_id', ignoreDuplicates: false }
        )
        .select()
        .single()

      if (error) throw error
      return { data: data as UserRating, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get the current user's rating for a specific item.
   * Returns null if user hasn't rated the item.
   */
  async getUserRating(itemId: string): Promise<RatingResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { data: null, error: null }
      }

      const { data, error } = await supabase
        .from('user_ratings')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .single()

      // PGRST116 = no rows returned, which is not an error for our use case
      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return { data: data as UserRating | null, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Delete the current user's rating for an item.
   */
  async deleteRating(itemId: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { error: new Error('Must be authenticated to delete rating') }
      }

      const { error } = await supabase
        .from('user_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}
