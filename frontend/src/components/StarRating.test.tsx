import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/utils'
import userEvent from '@testing-library/user-event'
import { StarRating } from './StarRating'

describe('StarRating', () => {
  describe('rendering', () => {
    it('should render 5 star buttons', () => {
      render(<StarRating value={0} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
    })

    it('should display correct rating in aria-label', () => {
      render(<StarRating value={3} />)
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Rating: 3.0 out of 5 stars'
      )
    })

    it('should handle null value as 0', () => {
      render(<StarRating value={null} />)
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Rating: 0 out of 5 stars'
      )
    })

    it('should apply size classes correctly', () => {
      const { container } = render(<StarRating value={3} size="lg" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-6', 'h-6')
    })

    it('should apply custom className', () => {
      render(<StarRating value={3} className="my-custom-class" />)
      expect(screen.getByRole('group')).toHaveClass('my-custom-class')
    })
  })

  describe('interactivity', () => {
    it('should call onChange when star is clicked', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={0} onChange={handleChange} />)

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[2]) // Click 3rd star

      expect(handleChange).toHaveBeenCalledWith(3)
    })

    it('should call onChange with correct value for each star', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={0} onChange={handleChange} />)

      const buttons = screen.getAllByRole('button')

      await user.click(buttons[0])
      expect(handleChange).toHaveBeenLastCalledWith(1)

      await user.click(buttons[4])
      expect(handleChange).toHaveBeenLastCalledWith(5)
    })

    it('should not call onChange when disabled', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={0} onChange={handleChange} disabled />)

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[2])

      expect(handleChange).not.toHaveBeenCalled()
    })

    it('should not call onChange when readOnly', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={3} onChange={handleChange} readOnly />)

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[4])

      expect(handleChange).not.toHaveBeenCalled()
    })

    it('should not call onChange when no onChange provided', async () => {
      const user = userEvent.setup()

      // Should not throw
      render(<StarRating value={3} />)

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[4])
      // Just verify it doesn't crash
    })
  })

  describe('accessibility', () => {
    it('should have aria-label for each star button', () => {
      render(<StarRating value={0} />)

      const buttons = screen.getAllByRole('button')

      expect(buttons[0]).toHaveAttribute('aria-label', 'Rate 1 star')
      expect(buttons[1]).toHaveAttribute('aria-label', 'Rate 2 stars')
      expect(buttons[4]).toHaveAttribute('aria-label', 'Rate 5 stars')
    })

    it('should indicate pressed state for current rating', () => {
      render(<StarRating value={3} />)

      const buttons = screen.getAllByRole('button')

      expect(buttons[2]).toHaveAttribute('aria-pressed', 'true')
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
      expect(buttons[4]).toHaveAttribute('aria-pressed', 'false')
    })

    it('should be keyboard navigable with Enter', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={0} onChange={handleChange} />)

      const buttons = screen.getAllByRole('button')
      buttons[2].focus()

      await user.keyboard('{Enter}')

      expect(handleChange).toHaveBeenCalledWith(3)
    })

    it('should be keyboard navigable with Space', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<StarRating value={0} onChange={handleChange} />)

      const buttons = screen.getAllByRole('button')
      buttons[1].focus()

      await user.keyboard(' ')

      expect(handleChange).toHaveBeenCalledWith(2)
    })

    it('should have group role with rating label', () => {
      render(<StarRating value={4} />)

      const group = screen.getByRole('group')
      expect(group).toHaveAttribute('aria-label', 'Rating: 4.0 out of 5 stars')
    })
  })

  describe('visual states', () => {
    it('should disable buttons when disabled prop is true', () => {
      render(<StarRating value={3} onChange={() => {}} disabled />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('should disable buttons when readOnly prop is true', () => {
      render(<StarRating value={3} onChange={() => {}} readOnly />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('should disable buttons when no onChange is provided', () => {
      render(<StarRating value={3} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })
})
