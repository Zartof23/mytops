import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/utils'
import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'

describe('BuyMeACoffeeButton', () => {
  it('links to the correct buymeacoffee page', () => {
    render(<BuyMeACoffeeButton />)

    expect(screen.getByRole('link', { name: /Buy me a coffee/i }))
      .toHaveAttribute('href', 'https://buymeacoffee.com/robertocalo')
  })

  it('opens in a new tab safely', () => {
    render(<BuyMeACoffeeButton />)
    const link = screen.getByRole('link', { name: /Buy me a coffee/i })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows the label text', () => {
    render(<BuyMeACoffeeButton />)

    expect(screen.getByText('Buy me a coffee')).toBeInTheDocument()
  })

  it('hides the label on small screens in the compact size', () => {
    render(<BuyMeACoffeeButton size="sm" />)

    expect(screen.getByText('Buy me a coffee').className).toContain('hidden')
  })
})
