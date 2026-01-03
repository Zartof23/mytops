import { useReducedMotion } from 'framer-motion'
import type { Variants, Transition } from 'framer-motion'

/**
 * Hook to check if user prefers reduced motion
 * Returns animation config that respects user preference
 */
export function useAnimationConfig() {
  const prefersReducedMotion = useReducedMotion()

  return {
    prefersReducedMotion,
    // Use instant transitions if user prefers reduced motion
    transition: prefersReducedMotion
      ? { duration: 0 }
      : { duration: 0.2, ease: 'easeOut' },
  }
}

// ============================================
// Page Transition Variants
// ============================================

export const pageTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
}

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
  },
}

// Fade only (for modals, overlays)
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

// ============================================
// Stagger Children Animations
// ============================================

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
}

// For horizontal lists (carousels)
export const staggerItemHorizontal: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
}

// ============================================
// Star Rating Animation
// ============================================

export const starPulseVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
}

export const starGlowTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
}

// ============================================
// Card Hover Effects
// ============================================

export const cardHoverVariants: Variants = {
  initial: {
    y: 0,
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  },
  hover: {
    y: -2,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
}

// ============================================
// Count Up Animation (for stats)
// ============================================

export const countUpConfig = {
  duration: 1,
  delay: 0.2,
}

// ============================================
// Accordion Animation
// ============================================

export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: 'easeOut' },
      opacity: { duration: 0.15 },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.2, ease: 'easeOut' },
      opacity: { duration: 0.15, delay: 0.05 },
    },
  },
}

// ============================================
// Tab Content Animation
// ============================================

export const tabContentVariants: Variants = {
  initial: {
    opacity: 0,
    x: 10,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: {
      duration: 0.15,
    },
  },
}

// ============================================
// Carousel/Preview Animation
// ============================================

export const carouselItemVariants: Variants = {
  enter: {
    opacity: 0,
  },
  center: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
}

// ============================================
// Button Interactions
// ============================================

export const buttonTapVariants = {
  tap: { scale: 0.98 },
}

export const buttonHoverVariants = {
  hover: { scale: 1.02 },
}

// ============================================
// Skeleton Shimmer (CSS class helper)
// ============================================

// Use this with Tailwind: animate-shimmer
// Add to tailwind.config.js:
// animation: { shimmer: 'shimmer 2s infinite' }
// keyframes: { shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } } }
