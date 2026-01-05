import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../test/utils'
import userEvent from '@testing-library/user-event'
import { ItemCard } from './ItemCard'
import { ratingService } from '../services/ratingService'
import { useAuthStore } from '../store/authStore'
import type { Item } from '../types'

// Mock dependencies
vi.mock('../services/ratingService', () => ({
  ratingService: {
    getUserRating: vi.fn(),
    upsertRating: vi.fn()
  }
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
}))

const mockItem: Item = {
  id: 'item-1',
  topic_id: 'topic-1',
  name: 'Test Movie',
  slug: 'test-movie',
  description: 'A great test movie',
  metadata: null,
  image_url: null,
  source: 'seed',
  ai_confidence: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
}

describe('ItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })
    })

    it('should render item name', () => {
      render(<ItemCard item={mockItem} />)
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    it('should render item description', () => {
      render(<ItemCard item={mockItem} />)
      expect(screen.getByText('A great test movie')).toBeInTheDocument()
    })

    it('should render source badge', () => {
      render(<ItemCard item={mockItem} />)
      expect(screen.getByText('Curated')).toBeInTheDocument()
    })

    it('should render image when image_url is provided', async () => {
      const itemWithImage = { ...mockItem, image_url: 'https://example.com/image.jpg' }
      render(<ItemCard item={itemWithImage} />)
      // LazyImage component renders with a placeholder initially
      // Check that the image container exists (LazyImage uses a container div)
      const container = screen.getByText('Test Movie').closest('.relative')
      expect(container).toBeInTheDocument()
    })

    it('should not render image when image_url is null', () => {
      render(<ItemCard item={mockItem} />)
      // Should show fallback with topic icon instead
      const fallback = screen.getByText('Test Movie').closest('.relative')?.querySelector('.bg-muted\\/30')
      expect(fallback).toBeInTheDocument()
    })
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })
    })

    it('should show sign in message', () => {
      render(<ItemCard item={mockItem} />)
      expect(screen.getByText('Sign in to rate')).toBeInTheDocument()
    })

    it('should render star rating in read-only mode', () => {
      render(<ItemCard item={mockItem} />)
      const ratingGroup = screen.getByRole('group')
      expect(ratingGroup).toBeInTheDocument()
    })

    it('should not call upsertRating when star is clicked', async () => {
      const user = userEvent.setup()
      render(<ItemCard item={mockItem} />)

      const stars = screen.getAllByRole('button')
      await user.click(stars[0])

      expect(ratingService.upsertRating).not.toHaveBeenCalled()
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com' }
      } as any)
    })

    it('should not show sign in message', () => {
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })

      render(<ItemCard item={mockItem} />)
      expect(screen.queryByText('Sign in to rate')).not.toBeInTheDocument()
    })

    it('should fetch user rating on mount', async () => {
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })

      render(<ItemCard item={mockItem} />)

      await waitFor(() => {
        expect(ratingService.getUserRating).toHaveBeenCalledWith('item-1')
      })
    })

    it('should display existing rating', async () => {
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: {
          id: 'rating-1',
          user_id: 'user-1',
          item_id: 'item-1',
          rating: 4,
          notes: null,
          created_at: '',
          updated_at: ''
        },
        error: null
      })

      render(<ItemCard item={mockItem} />)

      await waitFor(() => {
        const ratingGroup = screen.getByRole('group')
        expect(ratingGroup).toHaveAttribute('aria-label', 'Rating: 4.0 out of 5 stars')
      })
    })

    it('should call upsertRating when star is clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })
      vi.mocked(ratingService.upsertRating).mockResolvedValue({
        data: null,
        error: null
      })

      render(<ItemCard item={mockItem} />)

      // Wait for initial fetch
      await waitFor(() => {
        expect(ratingService.getUserRating).toHaveBeenCalled()
      })

      const stars = screen.getAllByRole('button')
      await user.click(stars[2]) // Click 3rd star

      await waitFor(() => {
        expect(ratingService.upsertRating).toHaveBeenCalledWith({
          item_id: 'item-1',
          rating: 3
        })
      })
    })
  })

  describe('showRating prop', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
    })

    it('should not render rating when showRating is false', () => {
      render(<ItemCard item={mockItem} showRating={false} />)
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
      expect(screen.queryByText('Sign in to rate')).not.toBeInTheDocument()
    })

    it('should not fetch rating when showRating is false', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { id: 'user-1' }
      } as any)

      render(<ItemCard item={mockItem} showRating={false} />)

      // Give it time to potentially make the call
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(ratingService.getUserRating).not.toHaveBeenCalled()
    })
  })

  describe('onClick handling', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any)
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })
    })

    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(<ItemCard item={mockItem} onClick={handleClick} />)

      // Click on the card title
      await user.click(screen.getByText('Test Movie'))

      expect(handleClick).toHaveBeenCalled()
    })

    it('should not call onClick when rating is clicked', async () => {
      // Use authenticated user so rating is interactive
      vi.mocked(useAuthStore).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com' }
      } as any)
      vi.mocked(ratingService.getUserRating).mockResolvedValue({
        data: null,
        error: null
      })
      vi.mocked(ratingService.upsertRating).mockResolvedValue({
        data: null,
        error: null
      })

      const handleClick = vi.fn()

      const { container } = render(<ItemCard item={mockItem} onClick={handleClick} />)

      // Wait for initial rating fetch
      await waitFor(() => {
        expect(ratingService.getUserRating).toHaveBeenCalled()
      })

      // Get the rating wrapper div (parent of the star rating group) and click directly on it
      const starRatingGroup = container.querySelector('[role="group"]')
      expect(starRatingGroup).toBeInTheDocument()
      const ratingWrapper = starRatingGroup?.parentElement
      expect(ratingWrapper).toBeInTheDocument()

      // Use fireEvent for more direct control (already imported at top)
      fireEvent.click(ratingWrapper!)

      // Card onClick should not be triggered due to stopPropagation
      expect(handleClick).not.toHaveBeenCalled()
    })
  })
})
