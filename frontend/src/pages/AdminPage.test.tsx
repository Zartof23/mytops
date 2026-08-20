import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import AdminPage from './AdminPage'
import { flagService } from '@/services/flagService'

vi.mock('@/services/flagService', () => ({
  flagService: { listFlags: vi.fn(), resolveFlag: vi.fn() }
}))
vi.mock('@/components/admin/AdminItemActions', () => ({
  AdminItemActions: () => <div>admin actions</div>
}))

const flag = {
  id: 'f1', item_id: 'item-1', user_id: 'u1',
  reason: 'The director is the wrong person',
  status: 'open', resolution_note: null, resolved_by: null, resolved_at: null,
  created_at: '2026-08-16T00:00:00Z',
  item: { id: 'item-1', name: 'Blade Runner', topic: { name: 'Movies', slug: 'movies' } },
  reporter: { id: 'u1', username: 'ada', display_name: 'Ada' }
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(flagService.listFlags).mockResolvedValue({ data: [flag] as never, count: 1, error: null })
  })

  it('loads the open queue first', async () => {
    render(<AdminPage />)

    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledWith('open', 0))
    expect(await screen.findByText('Blade Runner')).toBeInTheDocument()
    expect(screen.getByText(/the director is the wrong person/i)).toBeInTheDocument()
  })

  it('switches queues when a tab is selected', async () => {
    const user = userEvent.setup()
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('tab', { name: /resolved/i }))

    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledWith('resolved', 0))
  })

  it('resolves a flag and refreshes the queue', async () => {
    const user = userEvent.setup()
    vi.mocked(flagService.resolveFlag).mockResolvedValue({ error: null })
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('button', { name: /^resolve$/i }))

    await waitFor(() => expect(flagService.resolveFlag).toHaveBeenCalledWith('f1', 'resolved', ''))
    await waitFor(() => expect(flagService.listFlags).toHaveBeenCalledTimes(2))
  })

  it('rejects a flag with the reject status', async () => {
    const user = userEvent.setup()
    vi.mocked(flagService.resolveFlag).mockResolvedValue({ error: null })
    render(<AdminPage />)

    await screen.findByText('Blade Runner')
    await user.click(screen.getByRole('button', { name: /reject/i }))

    await waitFor(() => expect(flagService.resolveFlag).toHaveBeenCalledWith('f1', 'rejected', ''))
  })

  it('shows an empty state when the queue is clear', async () => {
    vi.mocked(flagService.listFlags).mockResolvedValue({ data: [], count: 0, error: null })

    render(<AdminPage />)

    expect(await screen.findByText(/nothing in the queue/i)).toBeInTheDocument()
  })
})
