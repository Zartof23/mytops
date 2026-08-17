import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { AdminItemActions } from '@/components/admin/AdminItemActions'
import { flagService } from '@/services/flagService'
import type { ItemFlag, FlagStatus } from '@/types'

const PAGE_SIZE = 20

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * Admin flag queue. Access is gated by AdminRoute for UX and by RLS for real.
 */
export default function AdminPage() {
  const [status, setStatus] = useState<FlagStatus>('open')
  const [flags, setFlags] = useState<ItemFlag[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, count, error: listError } = await flagService.listFlags(status, page)
    setLoading(false)

    if (listError) {
      setError(listError.message)
      return
    }
    setFlags(data ?? [])
    setTotal(count)
  }, [status, page])

  useEffect(() => { void load() }, [load])

  const handleResolve = async (flagId: string, next: 'resolved' | 'rejected') => {
    const { error: resolveError } = await flagService.resolveFlag(flagId, next, notes[flagId] ?? '')
    if (resolveError) {
      setError(resolveError.message)
      return
    }
    await load()
  }

  const changeStatus = (next: FlagStatus) => {
    setPage(0)
    setStatus(next)
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flag queue</h1>
        <p className="text-sm text-muted-foreground">
          Things people say we got wrong. They're usually right.
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => changeStatus(v as FlagStatus)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && flags.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing in the queue. Enjoy it while it lasts.
        </p>
      )}

      <div className="space-y-4">
        {flags.map((flag) => (
          <Card key={flag.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{flag.item?.name ?? 'Deleted item'}</p>
                <p className="text-xs text-muted-foreground">
                  {flag.item?.topic?.name} · reported by{' '}
                  {flag.reporter?.display_name ?? flag.reporter?.username ?? 'someone'} ·{' '}
                  {timeAgo(flag.created_at)}
                </p>
              </div>
              {flag.item && <AdminItemActions item={flag.item} onChanged={load} />}
            </div>

            <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{flag.reason}</p>

            {flag.status === 'open' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Resolution note (optional)"
                  value={notes[flag.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleResolve(flag.id, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleResolve(flag.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {flag.status !== 'open' && flag.resolution_note && (
              <p className="text-xs text-muted-foreground">Note: {flag.resolution_note}</p>
            )}
          </Card>
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
