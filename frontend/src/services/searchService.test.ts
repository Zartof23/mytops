import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchService, MIN_QUERY_LENGTH } from './searchService'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

/** Builds a chainable PostgREST mock whose terminal `limit` resolves. */
function mockQuery(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result)
  }
  vi.mocked(supabase.from).mockReturnValue(chain as never)
  return chain
}

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchItems', () => {
    it('returns empty data without querying when the query is too short', async () => {
      const result = await searchService.searchItems({ query: 'a' })

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('trims the query before measuring its length', async () => {
      const result = await searchService.searchItems({ query: '  a  ' })

      expect(result.data).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('queries items with an embedded topic join and an ilike filter', async () => {
      const items = [{ id: 'i1', name: 'Dune', topic: { id: 't1', slug: 'books' } }]
      const chain = mockQuery({ data: items, error: null })

      const result = await searchService.searchItems({ query: 'Dune' })

      expect(supabase.from).toHaveBeenCalledWith('items')
      expect(chain.select).toHaveBeenCalledWith('*, topic:topics(*)')
      expect(chain.or).toHaveBeenCalledWith('name.ilike."%Dune%",description.ilike."%Dune%"')
      expect(result.data).toEqual(items)
      expect(result.error).toBeNull()
    })

    it('preserves parentheses and hyphens inside quoted values', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'Sci-Fi (2020)' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike."%Sci-Fi (2020)%",description.ilike."%Sci-Fi (2020)%"'
      )
    })

    it('preserves commas inside quoted values', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'a,b' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike."%a,b%",description.ilike."%a,b%"'
      )
    })

    it('escapes percent signs as wildcards inside quoted values', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: '100%' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike."%100\\%%",description.ilike."%100\\%%"'
      )
    })

    it('escapes underscores as wildcards inside quoted values', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'a_b' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike."%a\\_b%",description.ilike."%a\\_b%"'
      )
    })

    it('escapes double quotes inside quoted values', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'a"b' })

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike."%a\\"b%",description.ilike."%a\\"b%"'
      )
    })

    it('scopes to a topic when topicId is given', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'Dune', topicId: 't1' })

      expect(chain.eq).toHaveBeenCalledWith('topic_id', 't1')
    })

    it('does not scope to a topic when topicId is omitted', async () => {
      const chain = mockQuery({ data: [], error: null })

      await searchService.searchItems({ query: 'Dune' })

      expect(chain.eq).not.toHaveBeenCalled()
    })

    it('defaults the limit to 8 and honours an override', async () => {
      const chain = mockQuery({ data: [], error: null })
      await searchService.searchItems({ query: 'Dune' })
      expect(chain.limit).toHaveBeenCalledWith(8)

      const chain2 = mockQuery({ data: [], error: null })
      await searchService.searchItems({ query: 'Dune', limit: 20 })
      expect(chain2.limit).toHaveBeenCalledWith(20)
    })

    it('accepts and ignores metadataFilters', async () => {
      const chain = mockQuery({ data: [], error: null })

      const result = await searchService.searchItems({
        query: 'Dune',
        metadataFilters: { year: 1965 }
      })

      expect(result.error).toBeNull()
      expect(chain.eq).not.toHaveBeenCalled()
    })

    it('returns the error and empty data when the query fails', async () => {
      mockQuery({ data: null, error: new Error('boom') })

      const result = await searchService.searchItems({ query: 'Dune' })

      expect(result.data).toEqual([])
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('boom')
    })

    it('exports a minimum query length of 2', () => {
      expect(MIN_QUERY_LENGTH).toBe(2)
    })
  })

  describe('listTopics', () => {
    it('returns topics ordered by name', async () => {
      const topics = [{ id: 't1', name: 'Anime' }]
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: topics, error: null })
      }
      vi.mocked(supabase.from).mockReturnValue(chain as never)

      const result = await searchService.listTopics()

      expect(supabase.from).toHaveBeenCalledWith('topics')
      expect(chain.order).toHaveBeenCalledWith('name')
      expect(result.data).toEqual(topics)
      expect(result.error).toBeNull()
    })

    it('returns empty data on error', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('nope') })
      }
      vi.mocked(supabase.from).mockReturnValue(chain as never)

      const result = await searchService.listTopics()

      expect(result.data).toEqual([])
      expect(result.error?.message).toBe('nope')
    })
  })
})
