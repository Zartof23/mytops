import { supabase } from '../lib/supabase'
import type { Profile, UserRating, Item, Topic } from '../types'

export interface ProfileWithRatings extends Profile {
  ratings: Array<UserRating & {
    item: Item & { topic: Topic }
  }>
}

/**
 * Service for profile-related operations
 */
export const profileService = {
  /**
   * Get current user's profile
   */
  async getCurrentProfile(): Promise<{ data: Profile | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get current user's profile with all their ratings (consolidated call)
   * This is more efficient than calling getCurrentProfile() + fetching ratings separately
   */
  async getCurrentProfileWithRatings(): Promise<{
    data: ProfileWithRatings | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      // Fetch profile and ratings in parallel
      const [profileResult, ratingsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_ratings')
          .select(`
            *,
            item:items (
              *,
              topic:topics (*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ])

      if (profileResult.error) throw profileResult.error
      if (ratingsResult.error) throw ratingsResult.error

      return {
        data: {
          ...profileResult.data,
          ratings: ratingsResult.data as unknown as ProfileWithRatings['ratings']
        },
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get a public profile by username
   */
  async getProfileByUsername(username: string): Promise<{
    data: ProfileWithRatings | null
    error: Error | null
  }> {
    try {
      // First get the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('is_public', true)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // No rows returned - profile not found or not public
          return { data: null, error: null }
        }
        throw profileError
      }

      // Then get their ratings
      const { data: ratings, error: ratingsError } = await supabase
        .from('user_ratings')
        .select(`
          *,
          item:items (
            *,
            topic:topics (*)
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (ratingsError) throw ratingsError

      return {
        data: {
          ...profile,
          ratings: ratings as unknown as ProfileWithRatings['ratings']
        },
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Update the current user's profile
   */
  async updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'is_public' | 'username'>>): Promise<{
    data: Profile | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username: string): Promise<{
    available: boolean
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (error) throw error

      // Available if no one has it, or if current user has it
      const available = !data || data.id === user?.id
      return { available, error: null }
    } catch (error) {
      return { available: false, error: error as Error }
    }
  },

  /**
   * Get user's top rated items (5 stars only)
   */
  async getTopRatedItems(userId: string, limit: number = 10): Promise<{
    data: Array<UserRating & { item: Item & { topic: Topic } }> | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('user_ratings')
        .select(`
          *,
          item:items (
            *,
            topic:topics (*)
          )
        `)
        .eq('user_id', userId)
        .eq('rating', 5)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return {
        data: data as unknown as Array<UserRating & { item: Item & { topic: Topic } }>,
        error: null
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }
}
