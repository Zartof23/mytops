import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminService } from '@/services/adminService'
import type { Item, ItemLinks } from '@/types'

interface DeleteItemDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Hard-delete confirmation. Loads the link pre-check on open; when anything
 * is linked, the delete requires typing the item name. This is irreversible
 * outside the audit log.
 */
export function DeleteItemDialog({ item, open, onOpenChange, onDeleted }: DeleteItemDialogProps) {
  const [links, setLinks] = useState<ItemLinks | null>(null)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open || !item) return

    setLinks(null)
    setTyped('')
    setError(null)
    setLoading(true)

    adminService.getItemLinks(item.id).then(({ data, error: linkError }) => {
      setLoading(false)
      if (linkError) {
        setError(linkError.message)
        return
      }
      setLinks(data)
    })
  }, [open, item])

  if (!item) return null

  const hasLinks = !!links && (links.rating_count > 0 || links.todo_count > 0)
  const confirmed = !hasLinks || typed.trim() === item.name
  const canDelete = !loading && !!links && confirmed && !deleting

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    const { error: deleteError } = await adminService.deleteItem(item.id, hasLinks)
    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onDeleted()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete "{item.name}"?</DialogTitle>
          <DialogDescription>
            This is permanent. There is no undo, only the audit log.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Checking what this is linked to…</p>}

        {links && !hasLinks && (
          <p className="text-sm text-muted-foreground">
            Nothing is linked to this item. Clean removal.
          </p>
        )}

        {links && hasLinks && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <p className="font-medium mb-1">This would sever:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {links.rating_count > 0 && <li>{pluralize(links.rating_count, 'rating', 'ratings')}</li>}
                {links.todo_count > 0 && <li>{pluralize(links.todo_count, 'TODO entry', 'TODO entries')}</li>}
                {links.flag_count > 0 && <li>{pluralize(links.flag_count, 'flag', 'flags')}</li>}
              </ul>
              {links.raters.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Rated by {links.raters.join(', ')}
                  {links.rating_count > links.raters.length && ` and ${links.rating_count - links.raters.length} more`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">Type the item name to confirm</Label>
              <Input
                id="confirm-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={item.name}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
            {deleting ? 'Deleting…' : hasLinks ? 'Delete anyway' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
