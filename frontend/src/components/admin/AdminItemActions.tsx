import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2 } from 'lucide-react'
import { DeleteItemDialog } from './DeleteItemDialog'
import { RescanDiff } from './RescanDiff'
import type { Item } from '@/types'

interface AdminItemActionsProps {
  item: Item
  /** Called after a successful re-scan apply or delete. */
  onChanged: () => void
}

/**
 * Admin re-scan and delete buttons. Mounted both in the flag queue and
 * inline in ItemDetailModal.
 */
export function AdminItemActions({ item, onChanged }: AdminItemActionsProps) {
  const [rescanOpen, setRescanOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setRescanOpen(true)}>
          <RefreshCw className="h-4 w-4" />
          Re-scan
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <RescanDiff
        itemId={rescanOpen ? item.id : null}
        open={rescanOpen}
        onOpenChange={setRescanOpen}
        onApplied={onChanged}
      />
      <DeleteItemDialog
        item={deleteOpen ? item : null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onChanged}
      />
    </>
  )
}
