import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/utils'
import { FaqSection, FAQ_ANCHOR_ID } from './FaqSection'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

describe('FaqSection', () => {
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

    expect(screen.getByText(/One search box for everything you like/)).toBeInTheDocument()
    expect(screen.getByText(/I pay for the AI tokens/)).toBeInTheDocument()
  })
})
