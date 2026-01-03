import { useState, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Star } from 'lucide-react'
import { cn } from '../lib/utils'

export interface StarRatingProps {
  /** Current rating value (1-5, supports decimals for display) or null if not rated */
  value: number | null
  /** Callback when rating changes (always returns integer 1-5) */
  onChange?: (rating: number) => void
  /** Disable interaction */
  disabled?: boolean
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Read-only mode (no hover effects, no click) */
  readOnly?: boolean
  /** Additional CSS classes */
  className?: string
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
}

const gapClasses = {
  xs: 'gap-0',
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5'
}

/**
 * Calculate fill percentage for a star
 * @param starIndex - 1-based star index
 * @param value - rating value (can be fractional)
 * @returns percentage 0-100
 */
function getStarFillPercent(starIndex: number, value: number): number {
  if (value >= starIndex) {
    return 100
  }
  if (value <= starIndex - 1) {
    return 0
  }
  // Fractional fill
  return (value - (starIndex - 1)) * 100
}

export function StarRating({
  value,
  onChange,
  disabled = false,
  size = 'md',
  readOnly = false,
  className
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [animatingStars, setAnimatingStars] = useState<Set<number>>(new Set())
  const prefersReducedMotion = useReducedMotion()
  const previousValue = useRef<number | null>(value)

  const isInteractive = !disabled && !readOnly && !!onChange
  // For display: use hover value (integer) or actual value (can be fractional)
  const displayValue = hoverValue ?? value ?? 0

  const handleClick = useCallback((e: React.MouseEvent, star: number) => {
    e.stopPropagation()
    if (isInteractive && onChange) {
      // Trigger animation for stars being filled
      if (!prefersReducedMotion) {
        const newAnimating = new Set<number>()
        const prevVal = Math.floor(previousValue.current ?? 0)
        // Animate stars from previous value to new value
        for (let i = Math.min(prevVal, star) + 1; i <= Math.max(prevVal, star); i++) {
          if (i <= star) {
            newAnimating.add(i)
          }
        }
        // Always animate the clicked star
        newAnimating.add(star)
        setAnimatingStars(newAnimating)

        // Clear animation state after animation completes
        setTimeout(() => {
          setAnimatingStars(new Set())
        }, 200)
      }

      previousValue.current = star
      onChange(star)
    }
  }, [isInteractive, onChange, prefersReducedMotion])

  const handleMouseEnter = useCallback((star: number) => {
    if (isInteractive) {
      setHoverValue(star)
    }
  }, [isInteractive])

  const handleMouseLeave = useCallback(() => {
    if (isInteractive) {
      setHoverValue(null)
    }
  }, [isInteractive])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, star: number) => {
    e.stopPropagation()
    if ((e.key === 'Enter' || e.key === ' ') && isInteractive && onChange) {
      e.preventDefault()
      previousValue.current = star
      onChange(star)
    }
  }, [isInteractive, onChange])

  return (
    <div
      className={cn('inline-flex items-center', gapClasses[size], className)}
      role="group"
      aria-label={`Rating: ${value?.toFixed(1) ?? 0} out of 5 stars`}
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = getStarFillPercent(star, displayValue)
        const isFilled = fillPercent === 100
        const isPartiallyFilled = fillPercent > 0 && fillPercent < 100
        const isAnimating = animatingStars.has(star)
        const isHovered = hoverValue !== null && star <= hoverValue

        return (
          <motion.button
            key={star}
            type="button"
            onClick={(e) => handleClick(e, star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onKeyDown={(e) => handleKeyDown(e, star)}
            disabled={!isInteractive}
            // Pulse animation on click
            animate={isAnimating ? {
              scale: [1, 1.15, 1],
              transition: { duration: 0.15, ease: 'easeOut' }
            } : { scale: 1 }}
            // Hover scale
            whileHover={isInteractive && !prefersReducedMotion ? { scale: 1.1 } : undefined}
            whileTap={isInteractive && !prefersReducedMotion ? { scale: 0.95 } : undefined}
            className={cn(
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm relative',
              isInteractive && 'cursor-pointer',
              !isInteractive && 'cursor-default'
            )}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={value !== null && Math.round(value) === star}
          >
            {/* Glow effect behind the star */}
            {(isFilled || isPartiallyFilled) && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 rounded-full bg-foreground/10 blur-sm"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: isAnimating ? 0.6 : (isHovered ? 0.3 : 0.15),
                  scale: isAnimating ? 1.3 : 1
                }}
                transition={{ duration: 0.2 }}
              />
            )}

            {/* Background star (empty) */}
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors duration-150 relative z-10',
                isHovered && !isFilled && !isPartiallyFilled
                  ? 'fill-foreground/30 text-foreground/50'
                  : 'fill-transparent text-muted-foreground/50'
              )}
            />

            {/* Filled star overlay with clip for partial fill */}
            {fillPercent > 0 && (
              <div
                className="absolute inset-0 z-20 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    'fill-foreground text-foreground'
                  )}
                />
              </div>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
