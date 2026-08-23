import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { DeleteItemDialog } from './DeleteItemDialog'
import { adminService } from '@/services/adminService'
import type { Item } from '@/types'

vi.mock('@/services/adminService', () => ({
  adminService: { getItemLinks: vi.fn(), deleteItem: vi.fn() }
}))

const item = {
  id: 'item-1', topic_id: 't1', name: 'Blade Runner', slug: 'blade-runner',
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
} as Item

const links = (ratings: number, todos: number) => ({
  data: { rating_count: ratings, todo_count: todos, flag_count: 0, raters: ratings ? ['ada'] : [] },
  error: null
})

describe('DeleteItemDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers a plain confirm when nothing is linked', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(0, 0) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: null })

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    const confirm = await screen.findByRole('button', { name: /^delete$/i })
    expect(screen.queryByLabelText(/type the item name/i)).not.toBeInTheDocument()

    await user.click(confirm)

    await waitFor(() => expect(adminService.deleteItem).toHaveBeenCalledWith('item-1', false))
  })

  it('warns and lists what would break when links exist', async () => {
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(3, 1) as never)

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText(/3 ratings/i)).toBeInTheDocument()
    expect(screen.getByText(/1 TODO entry/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type the item name/i)).toBeInTheDocument()
  })

  it('requires the typed item name before the forced delete is enabled', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(3, 1) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: null })

    render(<DeleteItemDialog item={item} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />)

    const confirm = await screen.findByRole('button', { name: /delete anyway/i })
    expect(confirm).toBeDisabled()

    const field = screen.getByLabelText(/type the item name/i)
    fireEvent.change(field, { target: { value: 'Blade Runn' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(field, { target: { value: 'Blade Runner' } })
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    await waitFor(() => expect(adminService.deleteItem).toHaveBeenCalledWith('item-1', true))
  })

  it('shows the server error and does not close on failure', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    vi.mocked(adminService.getItemLinks).mockResolvedValue(links(0, 0) as never)
    vi.mocked(adminService.deleteItem).mockResolvedValue({ error: new Error('Admin privileges required') })

    render(<DeleteItemDialog item={item} open onOpenChange={onOpenChange} onDeleted={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin privileges required')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
