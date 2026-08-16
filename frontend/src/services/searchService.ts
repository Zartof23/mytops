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
   * Match the item name only, ignoring the description. Used by the typeahead
   * suggestions, where a description hit produces a row whose title looks
   * unrelated to what was typed.
   */
  nameOnly?: boolean
}

/** Queries shorter than this never hit the network. */
export const MIN_QUERY_LENGTH = 2

const DEFAULT_LIMIT = 8

/**
 * Escape a query string for embedding in a PostgREST double-quoted `ilike` value.
 *
 * PostgREST's quoted-value grammar decodes any `\X` pair to the single literal
 * character `X` before the value ever reaches Postgres. That means a client-side
 * `\%` is not "escaped percent" by the time Postgres sees it — the backslash is
 * consumed by PostgREST's own parser and Postgres receives a bare `%`, which is
 * still a LIKE wildcard. To make Postgres itself see a backslash-escaped
 * wildcard (which its default `LIKE ... ESCAPE '\'` needs), the client string
 * has to contain a *doubled* backslash before the wildcard character, so that
 * PostgREST's decode leaves exactly one backslash in front of it. The same
 * doubling applies to a literal backslash in the query. `"` only needs a single
 * escape pair, since it isn't LIKE-special — it just has to survive PostgREST's
 * quote parsing.
 *
 * This DOES make `%` and `_` (and `\` and `"`) match literally. It does NOT and
 * CANNOT make `*` match literally: PostgREST treats `*` as a hard alias for `%`
 * in `like`/`ilike` patterns (to avoid having to URL-encode `%`), and that
 * substitution happens unconditionally with no escape mechanism — see
 * https://docs.postgrest.org, "Pattern Matching". A query containing `*`
 * therefore still has that position act as a wildcard. Callers must guard
 * against that separately (see the all-wildcard-characters check below).
 */
const ILIKE_ESCAPES: Record<string, string> = {
  '\\': '\\\\\\\\',
  '"': '\\"',
  '%': '\\\\%',
  _: '\\\\_'
}

function escapeForIlike(query: string): string {
  return query.replace(/[\\"%_]/g, (char) => ILIKE_ESCAPES[char])
}

/**
 * True when a query is made up entirely of characters that PostgREST/Postgres
 * treat as LIKE wildcards (`%`, `_`) or that PostgREST aliases to one (`*`),
 * plus whitespace. `_` and `%` are escaped literally by `escapeForIlike` above,
 * but `*` cannot be, so a query of only these characters (e.g. "*", "%%%")
 * would otherwise silently match every row up to the limit.
 */
function isOnlyWildcardCharacters(query: string): boolean {
  return /^[%_*\s]+$/.test(query)
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
    const { query, topicId, limit = DEFAULT_LIMIT, nameOnly = false } = params
    const trimmed = query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH || isOnlyWildcardCharacters(trimmed)) {
      return { data: [], error: null }
    }

    try {
      const escaped = escapeForIlike(trimmed)
      const pattern = `"%${escaped}%"`

      let request = supabase.from('items').select('*, topic:topics(*)')

      // Both branches go through `.or()` so the escaping above applies
      // identically; the name-only case just drops the description clause.
      request = request.or(
        nameOnly
          ? `name.ilike.${pattern}`
          : `name.ilike.${pattern},description.ilike.${pattern}`
      )

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
