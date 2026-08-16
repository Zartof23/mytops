import { BUY_ME_A_COFFEE_URL } from '@/lib/links'

interface BuyMeACoffeeButtonProps {
  /** `sm` collapses to the emoji only on narrow screens (navbar use). */
  size?: 'sm' | 'default'
}

/**
 * Buy Me a Coffee link, styled to match the official widget.
 *
 * Reimplemented rather than loading the vendor script: that script injects at
 * its own tag position (unreliable in an SPA), needs an external-origin CSP
 * allowance, and cannot be unit tested.
 */
export function BuyMeACoffeeButton({ size = 'default' }: BuyMeACoffeeButtonProps) {
  const isCompact = size === 'sm'

  return (
    <a
      href={BUY_ME_A_COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        backgroundColor: '#FFDD00',
        color: '#000000',
        borderColor: '#000000',
        fontFamily: "Cookie, 'Brush Script MT', cursive"
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary ${
        isCompact ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-lg'
      }`}
      aria-label="Buy me a coffee on buymeacoffee.com"
    >
      <span aria-hidden="true">☕</span>
      <span className={isCompact ? 'hidden sm:inline' : ''}>Buy me a coffee</span>
    </a>
  )
}
