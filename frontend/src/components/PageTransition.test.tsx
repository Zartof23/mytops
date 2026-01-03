import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from './PageTransition'

// Mock the animations module
vi.mock('../lib/animations', () => ({
  pageVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  pageTransition: {
    duration: 0.3
  },
  useAnimationConfig: vi.fn()
}))

// Import the mocked module
import { useAnimationConfig } from '../lib/animations'

// Helper to create mock return value
const mockAnimationConfig = (prefersReducedMotion: boolean) => ({
  prefersReducedMotion,
  transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }
})

describe('PageTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PageTransition component', () => {
    it('should render children', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      render(
        <PageTransition>
          <div data-testid="child">Content</div>
        </PageTransition>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should render static div when reduced motion is preferred', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(true))

      const { container } = render(
        <PageTransition className="test-class">
          <span>Content</span>
        </PageTransition>
      )

      // Should be a regular div, not motion.div
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className).toBe('test-class')
    })

    it('should apply className to wrapper', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      const { container } = render(
        <PageTransition className="custom-class">
          <span>Content</span>
        </PageTransition>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('StaggerContainer component', () => {
    it('should render children', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      render(
        <StaggerContainer>
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
        </StaggerContainer>
      )

      expect(screen.getByTestId('item-1')).toBeInTheDocument()
      expect(screen.getByTestId('item-2')).toBeInTheDocument()
    })

    it('should render static div when reduced motion is preferred', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(true))

      const { container } = render(
        <StaggerContainer className="stagger-class">
          <span>Item</span>
        </StaggerContainer>
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className).toBe('stagger-class')
    })

    it('should apply className', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      const { container } = render(
        <StaggerContainer className="grid gap-4">
          <span>Item</span>
        </StaggerContainer>
      )

      expect(container.firstChild).toHaveClass('grid')
      expect(container.firstChild).toHaveClass('gap-4')
    })
  })

  describe('StaggerItem component', () => {
    it('should render children', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      render(
        <StaggerItem>
          <div data-testid="content">Content</div>
        </StaggerItem>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('should render static div when reduced motion is preferred', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(true))

      const { container } = render(
        <StaggerItem className="item-class">
          <span>Item</span>
        </StaggerItem>
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className).toBe('item-class')
    })
  })

  describe('FadeIn component', () => {
    it('should render children', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      render(
        <FadeIn>
          <div data-testid="faded-content">Faded Content</div>
        </FadeIn>
      )

      expect(screen.getByTestId('faded-content')).toBeInTheDocument()
    })

    it('should render static div when reduced motion is preferred', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(true))

      const { container } = render(
        <FadeIn className="fade-class" delay={0.5}>
          <span>Content</span>
        </FadeIn>
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className).toBe('fade-class')
    })

    it('should apply className', () => {
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      const { container } = render(
        <FadeIn className="mt-4 opacity-animation">
          <span>Content</span>
        </FadeIn>
      )

      expect(container.firstChild).toHaveClass('mt-4')
      expect(container.firstChild).toHaveClass('opacity-animation')
    })
  })

  describe('Accessibility', () => {
    it('should respect reduced motion preference for PageTransition', () => {
      // With reduced motion
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(true))

      const { container, rerender } = render(
        <PageTransition>
          <span>Content</span>
        </PageTransition>
      )

      // Should be a regular div
      expect(container.querySelector('div')).toBeInTheDocument()

      // Without reduced motion
      vi.mocked(useAnimationConfig).mockReturnValue(mockAnimationConfig(false))

      rerender(
        <PageTransition>
          <span>Content</span>
        </PageTransition>
      )

      // Should still render content
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })
})
