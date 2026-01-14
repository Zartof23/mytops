import { useState, useCallback, useRef } from 'react'
import { enrichmentService, OutOfGasError } from '../services/enrichmentService'
import type { Item } from '../types'

export type EnrichmentStatus =
  | 'idle'           // Initial state, showing prompt
  | 'searching'      // Searching the web
  | 'extracting'     // Gathering details
  | 'saving'         // Saving to database
  | 'success'        // Item created
  | 'error'          // Something went wrong
  | 'out_of_gas'     // API credits exhausted

export interface UseEnrichmentReturn {
  status: EnrichmentStatus
  error: string | null
  remainingRequests: number | null
  dailyLimit: number | null
  enrichItem: (topicId: string, topicSlug: string, searchQuery: string) => Promise<Item | null>
  checkRateLimit: () => Promise<void>
  reset: () => void
}

const EXTRACTING_PHASE_DELAY = 1500
const SAVING_PHASE_DELAY = 500

/**
 * Hook for AI-powered item enrichment with rate limiting.
 *
 * Manages the enrichment workflow including:
 * - Multi-phase loading states for better UX
 * - Rate limit tracking
 * - Error handling with user-friendly messages
 *
 * @example
 * const { enrichItem, status, remainingRequests } = useEnrichment()
 *
 * const item = await enrichItem(topicId, topicSlug, 'The Matrix')
 * if (item) {
 *   // Handle successful enrichment
 * }
 */
export function useEnrichment(): UseEnrichmentReturn {
  const [status, setStatus] = useState<EnrichmentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null)
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)

  // Track timeout for cleanup
  const phaseTimeoutRef = useRef<number | null>(null)

  const checkRateLimit = useCallback(async () => {
    try {
      const rateLimit = await enrichmentService.checkRateLimit()
      setDailyLimit(rateLimit.daily_limit)
      setRemainingRequests(rateLimit.daily_limit - rateLimit.requests_today)
    } catch (err) {
      console.error('Failed to check rate limit:', err)
    }
  }, [])

  const enrichItem = useCallback(async (
    topicId: string,
    topicSlug: string,
    searchQuery: string
  ): Promise<Item | null> => {
    // Clear any existing timeout
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current)
      phaseTimeoutRef.current = null
    }

    setStatus('searching')
    setError(null)

    try {
      // Schedule transition to extracting phase
      phaseTimeoutRef.current = setTimeout(() => {
        setStatus('extracting')
      }, EXTRACTING_PHASE_DELAY)

      const result = await enrichmentService.enrichItem({
        topic_id: topicId,
        topic_slug: topicSlug,
        search_query: searchQuery
      })

      // Clear timeout since API call completed
      if (phaseTimeoutRef.current) {
        clearTimeout(phaseTimeoutRef.current)
        phaseTimeoutRef.current = null
      }

      setStatus('saving')

      // Brief delay to show saving state
      await new Promise(resolve => setTimeout(resolve, SAVING_PHASE_DELAY))

      setStatus('success')

      // Update rate limit after successful enrichment
      await checkRateLimit()

      return result.item as Item
    } catch (err) {
      // Clear timeout on error
      if (phaseTimeoutRef.current) {
        clearTimeout(phaseTimeoutRef.current)
        phaseTimeoutRef.current = null
      }

      // Check for out of gas error
      if (err instanceof OutOfGasError) {
        setStatus('out_of_gas')
        setError(null)
        return null
      }

      setStatus('error')
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    }
  }, [checkRateLimit])

  const reset = useCallback(() => {
    // Clear any pending timeout
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current)
      phaseTimeoutRef.current = null
    }

    setStatus('idle')
    setError(null)
  }, [])

  return {
    status,
    error,
    remainingRequests,
    dailyLimit,
    enrichItem,
    checkRateLimit,
    reset
  }
}
