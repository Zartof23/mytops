import { useState, useCallback } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../lib/utils'

export interface StarRatingProps {
  /** Current rating value (1-5) or null if not rated */
  value: number | null
  /** Callback when rating changes */
  onChange?: (rating: number) => void
  /** Disable interaction */
  disabled?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Read-only mode (no hover effects, no click) */
  readOnly?: boolean
  /** Additional CSS classes */
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
}

const gapClasses = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5'
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

  const isInteractive = !disabled && !readOnly && !!onChange
  const displayValue = hoverValue ?? value ?? 0

  const handleClick = useCallback((e: React.MouseEvent, star: number) => {
    e.stopPropagation()
    if (isInteractive && onChange) {
      onChange(star)
    }
  }, [isInteractive, onChange])

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
      onChange(star)
    }
  }, [isInteractive, onChange])

  return (
    <div
      className={cn('inline-flex items-center', gapClasses[size], className)}
      role="group"
      aria-label={`Rating: ${value ?? 0} out of 5 stars`}
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayValue

        return (
          <button
            key={star}
            type="button"
            onClick={(e) => handleClick(e, star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onKeyDown={(e) => handleKeyDown(e, star)}
            disabled={!isInteractive}
            className={cn(
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
              isInteractive && 'cursor-pointer hover:scale-110 transition-transform',
              !isInteractive && 'cursor-default'
            )}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={value === star}
          >
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors',
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-transparent text-muted-foreground'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
