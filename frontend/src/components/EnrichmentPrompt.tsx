import { useEffect, useMemo } from 'react'
import { useEnrichment, type EnrichmentStatus } from '../hooks/useEnrichment'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import { Fuel } from 'lucide-react'
import type { Item } from '../types'

interface EnrichmentPromptProps {
  searchQuery: string
  topicSlug: string
  topicId: string
  topicName: string
  onEnrichmentComplete: (item: Item) => void
  onCancel: () => void
}

// Status messages for each enrichment phase
const STATUS_MESSAGES: Record<EnrichmentStatus, string> = {
  idle: '',
  searching: 'Searching the web...',
  extracting: 'Found something! Gathering details...',
  saving: 'Saving to database...',
  success: 'Done!',
  error: '', // Error message comes from hook
  out_of_gas: '' // Special state with custom UI
}

// Progress percentages for visual feedback
const PROGRESS_VALUES: Record<EnrichmentStatus, number> = {
  idle: 0,
  searching: 33,
  extracting: 66,
  saving: 90,
  success: 100,
  error: 0,
  out_of_gas: 0
}

// Loading states that show progress indicator
const LOADING_STATES = new Set<EnrichmentStatus>(['searching', 'extracting', 'saving'])

// Threshold for showing "searches left" warning
const LOW_REQUESTS_THRESHOLD = 3

/**
 * AI-powered enrichment prompt for adding new items to the database.
 *
 * Features:
 * - Multi-phase loading states with progress indicator
 * - Rate limiting with visual feedback
 * - Error handling with helpful suggestions
 * - Brand voice consistent messaging
 *
 * @example
 * <EnrichmentPrompt
 *   searchQuery="The Matrix"
 *   topicId="movies-123"
 *   topicSlug="movies"
 *   topicName="Movies"
 *   onEnrichmentComplete={(item) => addToList(item)}
 *   onCancel={() => clearSearch()}
 * />
 */
export function EnrichmentPrompt({
  searchQuery,
  topicSlug,
  topicId,
  topicName,
  onEnrichmentComplete,
  onCancel
}: EnrichmentPromptProps) {
  const { status, error, remainingRequests, enrichItem, checkRateLimit, reset } = useEnrichment()

  // Check rate limit on mount
  useEffect(() => {
    checkRateLimit()
  }, [checkRateLimit])

  const handleEnrich = async () => {
    const item = await enrichItem(topicId, topicSlug, searchQuery)
    if (item) {
      onEnrichmentComplete(item)
    }
  }

  const handleRetry = () => {
    reset()
  }

  // Computed states
  const isLoading = LOADING_STATES.has(status)
  const showLowRequestsWarning = remainingRequests !== null && remainingRequests < LOW_REQUESTS_THRESHOLD
  const isRateLimited = remainingRequests === 0

  // Memoize status message with error fallback
  const currentStatusMessage = useMemo(() => {
    if (status === 'error') {
      return error || "Something broke. Honestly, I'm surprised it worked this long."
    }
    return STATUS_MESSAGES[status]
  }, [status, error])

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="text-sm font-medium">{STATUS_MESSAGES[status]}</p>
            <Progress value={PROGRESS_VALUES[status]} className="h-2" aria-label="Enrichment progress" />
          </div>
          <p className="text-xs text-muted-foreground">
            This might take a moment...
          </p>
        </div>
      </Card>
    )
  }

  // Out of gas error state
  if (status === 'out_of_gas') {
    return (
      <Card className="p-8 text-center border-muted">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex justify-center">
            <Fuel
              className="h-12 w-12 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" role="alert" aria-live="polite">
              Out of gas
            </p>
            <p className="text-xs text-muted-foreground">
              The AI search ran out of credits. Not my fault this time, actually.
            </p>
          </div>
          <Button onClick={onCancel} variant="ghost" size="sm">
            Got it
          </Button>
        </div>
      </Card>
    )
  }

  // Generic error state
  if (status === 'error') {
    return (
      <Card className="p-8 text-center border-destructive/50">
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive" role="alert">
              {currentStatusMessage}
            </p>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-medium">Suggestions:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Check for typos in the title</li>
              <li>Try the original language title</li>
              <li>Make sure this is a {topicName.toLowerCase()} (not something else)</li>
            </ul>
          </div>

          <div className="flex gap-2 justify-center">
            <Button onClick={handleRetry} variant="outline" size="sm">
              Try Again
            </Button>
            <Button onClick={onCancel} variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Initial prompt (idle state)
  return (
    <Card className="p-8 text-center">
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Couldn't find <span className="font-medium text-foreground">"{searchQuery}"</span> locally.
          </p>
          <p className="text-sm text-muted-foreground">
            Want me to search the web?
          </p>
        </div>

        {showLowRequestsWarning && (
          <Badge variant="outline" className="text-xs" role="status" aria-live="polite">
            {remainingRequests} {remainingRequests === 1 ? 'search' : 'searches'} left today
          </Badge>
        )}

        <div className="flex gap-2 justify-center">
          <Button
            onClick={handleEnrich}
            size="sm"
            disabled={isRateLimited}
            aria-label={isRateLimited ? 'Daily limit reached' : `Search the web for ${searchQuery}`}
          >
            {isRateLimited ? 'Daily Limit Reached' : 'Search the Web'}
          </Button>
          <Button onClick={onCancel} variant="ghost" size="sm" aria-label="Cancel search">
            Cancel
          </Button>
        </div>

        {isRateLimited && (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Daily search limit reached. Resets tomorrow.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          AI will search for info and add it to the database
        </p>
      </div>
    </Card>
  )
}
