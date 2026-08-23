import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { adminService } from '@/services/adminService'
import type { RescanPreview } from '@/types'

interface RescanDiffProps {
  itemId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}

function valueAt(source: Record<string, unknown> | null | undefined, field: string): string {
  if (!source) return '—'
  const raw = field.startsWith('metadata.')
    ? (source.metadata as Record<string, unknown> | null)?.[field.slice('metadata.'.length)]
    : source[field]

  if (raw === null || raw === undefined || raw === '') return '—'
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

/**
 * Re-scan review. The preview never writes; the admin picks which of the
 * proposed fields to apply. The AI being right about one field is not
 * evidence it is right about the rest.
 *
 * Apply writes from the stored proposal (`proposal_id`), not from the item
 * id — the server re-derives nothing at apply time, it only replays what
 * was already reviewed. If the proposal has expired server-side, apply
 * returns an error whose message we surface as-is (it tells the admin to
 * re-scan).
 */
export function RescanDiff({ itemId, open, onOpenChange, onApplied }: RescanDiffProps) {
  const [preview, setPreview] = useState<RescanPreview | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !itemId) return

    setPreview(null)
    setSelected([])
    setError(null)
    setLoading(true)

    adminService.previewRescan(itemId).then(({ data, error: scanError }) => {
      setLoading(false)
      if (scanError) {
        setError(scanError.message)
        return
      }
      setPreview(data)
      setSelected(data?.changed_fields ?? [])
    })
  }, [open, itemId])

  if (!itemId) return null

  const toggle = (field: string) => {
    setSelected((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    )
  }

  const handleApply = async () => {
    if (!preview || !preview.proposal_id) return

    setApplying(true)
    setError(null)

    const { error: applyError } = await adminService.applyRescan(preview.proposal_id, selected)
    setApplying(false)

    if (applyError) {
      setError(applyError.message)
      return
    }

    onApplied()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-scan results</DialogTitle>
          <DialogDescription>
            Pick what to keep. Nothing is written until you apply.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground">
            Checking the web again. This takes a moment.
          </p>
        )}

        {preview && preview.changed_fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing looks different. The data we have matches what's out there.
          </p>
        )}

        {preview && preview.changed_fields.length > 0 && (
          <div className="space-y-3">
            {preview.changed_fields.map((field) => (
              <label
                key={field}
                htmlFor={`field-${field}`}
                className="flex gap-3 rounded-md border p-3 text-sm cursor-pointer"
              >
                <input
                  id={`field-${field}`}
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(field)}
                  onChange={() => toggle(field)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium mb-1">{field}</p>
                  <p className="text-muted-foreground line-through break-words">
                    {valueAt(preview.current as unknown as Record<string, unknown>, field)}
                  </p>
                  <p className="break-words">
                    {valueAt(preview.proposed as unknown as Record<string, unknown>, field)}
                  </p>
                </div>
              </label>
            ))}

            <p className="text-xs text-muted-foreground">
              Confidence {(preview.confidence * 100).toFixed(0)}%
              {preview.sources.length > 0 && ` · ${preview.sources.length} source(s)`}
            </p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={handleApply}
            disabled={selected.length === 0 || applying || loading}
          >
            {applying ? 'Applying…' : 'Apply selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
