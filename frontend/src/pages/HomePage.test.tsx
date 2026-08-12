import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '../test/utils'
import { HomePage } from './HomePage'
import { statsService } from '../services/statsService'
import { ratingService } from '../services/ratingService'

let capturedOnSelectItem: ((item: { id: string; name: string }) => void) | null = null

vi.mock('../components/ItemSearch', () => ({
  ItemSearch: (props: { onSelectItem: (item: { id: string; name: string }) => void }) => {
    capturedOnSelectItem = props.onSelectItem
    return <div data-testid="item-search" />
  }
}))

vi.mock('../components/FaqSection', () => ({
  FaqSection: () => <div data-testid="faq-section" id="faq" />,
  FAQ_ANCHOR_ID: 'faq'
}))

let mockUser: { id: string } | null = null

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser })
}))

vi.mock('../services/statsService', () => ({
  statsService: {
    getItemStats: vi.fn()
  }
}))

vi.mock('../services/ratingService', () => ({
  ratingService: {
    upsertRating: vi.fn(),
    getUserRating: vi.fn()
  }
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(statsService.getItemStats).mockReset()
    vi.mocked(ratingService.upsertRating).mockReset()
    vi.mocked(ratingService.getUserRating).mockReset()
    capturedOnSelectItem = null
    mockUser = null
    vi.mocked(statsService.getItemStats).mockResolvedValue({
      data: { avgRating: 0, ratingCount: 0 },
      error: null
    })
    vi.mocked(ratingService.upsertRating).mockResolvedValue({ data: null, error: null })
    vi.mocked(ratingService.getUserRating).mockResolvedValue({ data: null, error: null })
  })

  it('shows the two-line tagline', () => {
    render(<HomePage />)

    expect(
      screen.getByText('Search anything. Movies, books, games, ramen shops.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/If it's not here yet, AI finds it and adds it/)
    ).toBeInTheDocument()
  })

  it('renders the search box and the FAQ', () => {
    render(<HomePage />)

    expect(screen.getByTestId('item-search')).toBeInTheDocument()
    expect(screen.getByTestId('faq-section')).toBeInTheDocument()
  })

  it('renders a button that scrolls to the FAQ', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<HomePage />)
    screen.getByRole('button', { name: /What the heck is this/i }).click()

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('no longer renders the popular items carousel', () => {
    render(<HomePage />)

    expect(screen.queryByText('What people are rating')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Popular items' })).not.toBeInTheDocument()
  })

  it('resolves to the second item stats when selecting A then B out of order', async () => {
    let resolveA: (value: { data: { avgRating: number; ratingCount: number }; error: null }) => void = () => {}
    let resolveB: (value: { data: { avgRating: number; ratingCount: number }; error: null }) => void = () => {}

    const itemA = { id: 'item-a', name: 'Item A' }
    const itemB = { id: 'item-b', name: 'Item B' }

    vi.mocked(statsService.getItemStats).mockImplementation((itemId: string) => {
      if (itemId === itemA.id) {
        return new Promise((resolve) => {
          resolveA = resolve
        })
      }
      return new Promise((resolve) => {
        resolveB = resolve
      })
    })

    render(<HomePage />)

    await act(async () => {
      capturedOnSelectItem?.(itemA)
    })
    await act(async () => {
      capturedOnSelectItem?.(itemB)
    })

    // Resolve out of order: A resolves after B.
    await act(async () => {
      resolveB({ data: { avgRating: 4, ratingCount: 10 }, error: null })
    })
    await act(async () => {
      resolveA({ data: { avgRating: 1, ratingCount: 1 }, error: null })
    })

    await waitFor(() => {
      expect(screen.getByText(/4\.0 \(10 ratings\)/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/1\.0 \(1 rating\)/)).not.toBeInTheDocument()
  })

  it('restores the previous rating (not null) when the upsert fails', async () => {
    mockUser = { id: 'user-1' }
    const item = { id: 'item-1', name: 'Item 1' }

    vi.mocked(ratingService.getUserRating).mockResolvedValue({
      data: { id: 'r1', user_id: 'user-1', item_id: 'item-1', rating: 3, notes: null, created_at: '', updated_at: '' },
      error: null
    })
    vi.mocked(ratingService.upsertRating).mockResolvedValue({
      data: null,
      error: new Error('write failed')
    })

    render(<HomePage />)

    await act(async () => {
      capturedOnSelectItem?.(item)
    })

    await waitFor(() => {
      expect(vi.mocked(ratingService.getUserRating)).toHaveBeenCalledWith('item-1')
    })

    const stars = screen.getAllByRole('button', { name: /star/i })
    await act(async () => {
      stars[4].click()
    })

    await waitFor(() => {
      expect(vi.mocked(ratingService.upsertRating)).toHaveBeenCalled()
    })

    // Rolled back to the prior rating of 3, not cleared to null/unrated.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /3 star/i })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('seeds an existing rating for a signed-in user and skips the lookup when logged out', async () => {
    const item = { id: 'item-2', name: 'Item 2' }

    // Logged-out: getUserRating must not be called.
    render(<HomePage />)
    await act(async () => {
      capturedOnSelectItem?.(item)
    })
    await waitFor(() => {
      expect(vi.mocked(statsService.getItemStats)).toHaveBeenCalledWith('item-2')
    })
    expect(vi.mocked(ratingService.getUserRating)).not.toHaveBeenCalled()
  })

  it('fetches the existing rating for a signed-in user', async () => {
    mockUser = { id: 'user-1' }
    const item = { id: 'item-3', name: 'Item 3' }

    vi.mocked(ratingService.getUserRating).mockResolvedValue({
      data: { id: 'r2', user_id: 'user-1', item_id: 'item-3', rating: 5, notes: null, created_at: '', updated_at: '' },
      error: null
    })

    render(<HomePage />)
    await act(async () => {
      capturedOnSelectItem?.(item)
    })

    await waitFor(() => {
      expect(vi.mocked(ratingService.getUserRating)).toHaveBeenCalledWith('item-3')
    })
  })
})
