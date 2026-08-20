import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { flagService, MIN_REASON_LENGTH, MAX_REASON_LENGTH } from '@/services/flagService'
import type { Item, Topic } from '@/types'

interface FlagItemModalProps {
  item: (Item & { topic?: Topic }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFlagged?: () => void
}

const PLACEHOLDERS: Record<string, string> = {
  movies: 'e.g. Director name is wrong',
  series: 'e.g. Number of seasons is wrong',
  books: 'e.g. Publish year is wrong',
  anime: 'e.g. Episode count is wrong',
  games: 'e.g. Developer is wrong',
  restaurants: 'e.g. Location is wrong'
}

const FALLBACK_PLACEHOLDER = 'e.g. The release year is wrong'

/**
 * The example text is a placeholder, never a prefilled value —
 * prefilled examples get submitted verbatim.
 */
export function flagPlaceholderForTopic(topicSlug: string): string {
  return PLACEHOLDERS[topicSlug] ?? FALLBACK_PLACEHOLDER
}

/**
 * Dialog for reporting incorrect information on an item.
 */
export function FlagItemModal({ item, open, onOpenChange, onFlagged }: FlagItemModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!item) return null

  const trimmedLength = reason.trim().length
  const canSubmit = trimmedLength >= MIN_REASON_LENGTH && !submitting

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const { error: submitError } = await flagService.createFlag(item.id, reason)
    setSubmitting(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    setReason('')
    onFlagged?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Something wrong with {item.name}?</DialogTitle>
          <DialogDescription>
            Tell us what's off and we'll take another look. Probably.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="flag-reason">What's wrong?</Label>
          <textarea
            id="flag-reason"
            className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={flagPlaceholderForTopic(item.topic?.slug ?? '')}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {trimmedLength < MIN_REASON_LENGTH
              ? `At least ${MIN_REASON_LENGTH} characters.`
              : `${trimmedLength}/${MAX_REASON_LENGTH}`}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
