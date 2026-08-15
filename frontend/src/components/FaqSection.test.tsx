import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '../test/utils'
import { FaqSection, FAQ_ANCHOR_ID } from './FaqSection'

const framerMotionMock = { prefersReduced: true }
const motionDivPropsRecorder: Array<{
  bandId: string
  whileInView?: any
  viewport?: any
  transition?: any
}> = []

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    useReducedMotion: () => framerMotionMock.prefersReduced,
    motion: {
      ...actual.motion,
      div: vi.fn(
        ({
          children,
          whileInView,
          viewport,
          transition,
          'data-faq-band': bandId,
          ...props
        }: any) => {
          // Record the animation props passed to motion.div
          motionDivPropsRecorder.push({
            bandId,
            whileInView,
            viewport,
            transition
          })
          // Render as a regular div to pass through to DOM
          return React.createElement(
            'div',
            { ...props, 'data-faq-band': bandId },
            children
          )
        }
      )
    }
  }
})

describe('FaqSection (reduced motion enabled)', () => {
  beforeEach(() => {
    framerMotionMock.prefersReduced = true
    motionDivPropsRecorder.length = 0
  })
  it('exposes the anchor id used by the scroll button', () => {
    const { container } = render(<FaqSection />)

    expect(FAQ_ANCHOR_ID).toBe('faq')
    expect(container.querySelector(`#${FAQ_ANCHOR_ID}`)).toBeInTheDocument()
  })

  it('renders the five questions in the specified order', () => {
    render(<FaqSection />)

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(headings).toEqual([
      'What is this?',
      'What can I track?',
      'Why does this exist?',
      'Is my data private?',
      'Is it free?'
    ])
  })

  it('alternates band alignment left, right, left, right, left', () => {
    const { container } = render(<FaqSection />)

    const bands = [...container.querySelectorAll('[data-faq-band]')]
    expect(bands.map((band) => band.getAttribute('data-align'))).toEqual([
      'left',
      'right',
      'left',
      'right',
      'left'
    ])
  })

  it('renders the GitHub and coffee links inside the last band', () => {
    const { container } = render(<FaqSection />)

    const lastBand = container.querySelector('[data-faq-band="free"]')

    expect(lastBand?.querySelector('a[href="https://buymeacoffee.com/robertocalo"]'))
      .toBeInTheDocument()
    expect(lastBand?.querySelector('a[href="https://github.com/Zartof23/mytops"]'))
      .toBeInTheDocument()
  })

  it('renders answer copy when reduced motion is preferred', () => {
    render(<FaqSection />)

    expect(
      screen.getByText(/An AI-powered single place to keep your tops organized/)
    ).toBeInTheDocument()
    expect(screen.getByText(/I pay for the AI tokens/)).toBeInTheDocument()
  })

  it('does not apply left-border classes to right-aligned bands', () => {
    const { container } = render(<FaqSection />)

    const rightBands = [...container.querySelectorAll('[data-align="right"]')].map((band) =>
      band.querySelector('div[class*="border"]')
    )

    rightBands.forEach((band) => {
      const className = band?.className || ''
      expect(className).not.toContain('border-l')
      expect(className).not.toContain('pl-6')
      expect(className).toContain('border-r')
      expect(className).toContain('pr-6')
    })
  })

  it('does not apply right-border classes to left-aligned bands', () => {
    const { container } = render(<FaqSection />)

    const leftBands = [...container.querySelectorAll('[data-align="left"]')].map((band) =>
      band.querySelector('div[class*="border"]')
    )

    leftBands.forEach((band) => {
      const className = band?.className || ''
      expect(className).not.toContain('border-r')
      expect(className).not.toContain('pr-6')
      expect(className).not.toContain('text-right')
      expect(className).toContain('border-l')
      expect(className).toContain('pl-6')
    })
  })

  it('omits animation props when reduced motion is preferred', () => {
    render(<FaqSection />)

    expect(motionDivPropsRecorder.length).toBe(5)
    motionDivPropsRecorder.forEach((props) => {
      expect(props.whileInView).toBeUndefined()
      expect(props.viewport).toBeUndefined()
      expect(props.transition).toBeUndefined()
    })
  })
})

describe('FaqSection (reduced motion disabled)', () => {
  beforeEach(() => {
    framerMotionMock.prefersReduced = false
    motionDivPropsRecorder.length = 0
  })

  it('includes animation props when reduced motion is not preferred', () => {
    render(<FaqSection />)

    expect(motionDivPropsRecorder.length).toBe(5)

    motionDivPropsRecorder.forEach((props) => {
      // All animation props should be present
      expect(props.whileInView).toBeDefined()
      expect(props.viewport).toBeDefined()
      expect(props.transition).toBeDefined()

      // Verify the animation targets
      expect(props.whileInView).toEqual({ opacity: 1, x: 0 })
      expect(props.viewport).toEqual({ once: true, amount: 0.4 })
      expect(props.transition).toEqual({ duration: 0.5 })
    })
  })
})
