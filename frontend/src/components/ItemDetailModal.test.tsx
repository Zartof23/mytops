import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { ItemDetailModal } from './ItemDetailModal'
import { useAuthStore } from '@/store/authStore'
import type { Item, Topic } from '@/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/components/admin/AdminItemActions', () => ({
  AdminItemActions: () => <div>admin actions</div>
}))

const makeItem = (id: string, name: string): Item & { topic?: Topic } => ({
  id, topic_id: 't1', name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  topic: {
    id: 't1', name: 'Movies', slug: 'movies', description: null, icon: null,
    image_url: null, schema_template: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
  }
})

describe('ItemDetailModal flag trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ isAdmin: false, initialized: true, profileLoading: false })
  })

  it('sends a signed-out user to login when no override is provided', async () => {
    const user = userEvent.setup()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('prefers an explicit onRequireLogin override over navigating', async () => {
    const user = userEvent.setup()
    const onRequireLogin = vi.fn()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated={false}
        onRequireLogin={onRequireLogin}
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate for a signed-in user', async () => {
    const user = userEvent.setup()
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
      />
    )

    await user.click(screen.getByRole('button', { name: /report incorrect information/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clears the reported badge when a different item is shown', () => {
    const { rerender } = render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        alreadyFlagged
      />
    )

    expect(screen.getByRole('button', { name: /already reported/i })).toBeInTheDocument()

    rerender(
      <ItemDetailModal
        item={makeItem('i2', 'Arrival')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        alreadyFlagged={false}
      />
    )

    expect(screen.getByRole('button', { name: /report incorrect information/i })).toBeInTheDocument()
  })
})

describe('ItemDetailModal admin gating', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows admin controls when isAdmin is true', () => {
    useAuthStore.setState({ isAdmin: true, initialized: true, profileLoading: false })
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
      />
    )

    expect(screen.getByText('admin actions')).toBeInTheDocument()
  })

  it('hides admin controls when isAdmin is false', () => {
    useAuthStore.setState({ isAdmin: false, initialized: true, profileLoading: false })
    render(
      <ItemDetailModal
        item={makeItem('i1', 'Blade Runner')}
        open
        onOpenChange={vi.fn()}
        isAuthenticated
      />
    )

    expect(screen.queryByText('admin actions')).not.toBeInTheDocument()
  })
})
