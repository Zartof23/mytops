import { supabase } from '../lib/supabase'
import type { Item } from '../types'

export interface EnrichmentRequest {
  topic_id: string
  topic_slug: string
  search_query: string
}

export interface EnrichmentResult {
  status: 'created' | 'existing'
  item: Item
  message: string
}

export interface RateLimitStatus {
  requests_today: number
  daily_limit: number
  can_request: boolean
}

export interface EnrichmentError {
  error: string
  requests_today?: number
  daily_limit?: number
}

export class OutOfGasError extends Error {
  constructor() {
    super('OUT_OF_GAS')
    this.name = 'OutOfGasError'
  }
}

export const enrichmentService = {
  /**
   * Trigger AI enrichment for a new item.
   * Returns the enriched item or an existing item if found.
   */
  async enrichItem(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase.functions.invoke('ai-enrich-item', {
      body: request
    })

    if (error) {
      throw error
    }

    if (data.error) {
      // Check for out of gas error
      if (data.error === 'OUT_OF_GAS' || data.errorType === 'insufficient_funds') {
        throw new OutOfGasError()
      }
      throw new Error(data.error)
    }

    return data as EnrichmentResult
  },

  /**
   * Check the user's current rate limit status.
   * Returns how many requests they've made today and if they can make more.
   */
  async checkRateLimit(): Promise<RateLimitStatus> {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .rpc('check_enrichment_rate_limit', { p_user_id: user.id })

    if (error) {
      throw error
    }

    if (!data || !data[0]) {
      throw new Error('Failed to check rate limit')
    }

    return {
      requests_today: data[0].requests_today,
      daily_limit: data[0].daily_limit,
      can_request: data[0].can_request
    }
  },

  /**
   * Get the user's enrichment request history.
   */
  async getRequestHistory(limit = 10): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('user_enrichment_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return data || []
  }
}
