import { supabase } from '../lib/supabase'
import type { Item, Topic } from '../types'

/** An item together with the topic it belongs to. */
export type SearchResultItem = Item & { topic: Topic }

export interface SearchItemsParams {
  query: string
  /** Restrict to a single topic. Omit to search every topic. */
  topicId?: string
  /** Maximum results. Defaults to 8 (the dropdown cap). */
  limit?: number
  /**
   * Reserved for metadata-based search. Accepted and ignored today so that
   * adding it later does not change this signature at any call site.
   */
  metadataFilters?: Record<string, unknown>
}

/** Queries shorter than this never hit the network. */
export const MIN_QUERY_LENGTH = 2

const DEFAULT_LIMIT = 8

/**
 * Neutralise characters that carry meaning inside a PostgREST `or` filter.
 * Commas separate conditions and `%` is the wildcard, so a raw user query
 * containing either would change the shape of the request.
 */
function sanitizeForIlike(query: string): string {
  return query.replace(/[,%()]/g, ' ')
}

/**
 * Cross-topic search over the item catalogue.
 *
 * Deliberately does not use the `get_items_with_stats` RPC: that function
 * requires a topic id and so cannot answer an "all topics" query. Results
 * therefore carry no rating stats — fetch those per item with
 * `statsService.getItemStats` when opening a detail view.
 */
export const searchService = {
  async searchItems(params: SearchItemsParams): Promise<{
    data: SearchResultItem[]
    error: Error | null
  }> {
    const { query, topicId, limit = DEFAULT_LIMIT } = params
    const trimmed = query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { data: [], error: null }
    }

    try {
      const pattern = `%${sanitizeForIlike(trimmed)}%`

      let request = supabase
        .from('items')
        .select('*, topic:topics(*)')
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)

      if (topicId) {
        request = request.eq('topic_id', topicId)
      }

      const { data, error } = await request.order('name').limit(limit)

      if (error) throw error

      return { data: (data ?? []) as SearchResultItem[], error: null }
    } catch (error) {
      return { data: [], error: error as Error }
    }
  },

  /** All topics, alphabetical. Used for the search scope chips. */
  async listTopics(): Promise<{ data: Topic[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name')

      if (error) throw error

      return { data: (data ?? []) as Topic[], error: null }
    } catch (error) {
      return { data: [], error: error as Error }
    }
  }
}
