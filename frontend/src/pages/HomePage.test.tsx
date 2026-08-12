import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../test/utils'
import { HomePage } from './HomePage'

vi.mock('../components/ItemSearch', () => ({
  ItemSearch: () => <div data-testid="item-search" />
}))

vi.mock('../components/FaqSection', () => ({
  FaqSection: () => <div data-testid="faq-section" id="faq" />,
  FAQ_ANCHOR_ID: 'faq'
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: null })
}))

vi.mock('../services/statsService', () => ({
  statsService: {
    getItemStats: vi.fn().mockResolvedValue({ data: { avgRating: 0, ratingCount: 0 }, error: null })
  }
}))

vi.mock('../services/ratingService', () => ({
  ratingService: {
    upsertRating: vi.fn().mockResolvedValue({ data: null, error: null })
  }
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
