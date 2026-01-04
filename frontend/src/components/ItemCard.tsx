import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Item, Topic } from '../types'
import { StarRating } from './StarRating'
import { useAuthStore } from '../store/authStore'
import { ratingService } from '../services/ratingService'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Check } from 'lucide-react'

const NEW_RELEASE_DAYS = 30

interface ItemCardProps {
  item: Item & { topic?: Topic }
  onClick?: () => void
  /** Show rating component (default: true) */
  showRating?: boolean
  /** Community average rating (1-5) */
  avgRating?: number
  /** Number of community ratings */
  ratingCount?: number
  /** Pre-fetched user rating (skip API call if provided) */
  initialUserRating?: number | null
  /** Disable hover animations (for performance in large lists) */
  disableHoverAnimation?: boolean
  /** Whether item is in user's TODO list */
  isInTodo?: boolean
  /** Callback when adding to TODO list */
  onAddToTodo?: () => void
  /** Callback when removing from TODO list */
  onRemoveFromTodo?: () => void
}

const SOURCE_BADGES = {
  seed: { label: 'Curated', variant: 'secondary' as const },
  ai_generated: { label: 'AI', variant: 'outline' as const },
  user_submitted: { label: 'User', variant: 'default' as const }
} as const

/**
 * Check if item is a "new" release (within last 30 days or current year).
 */
function isNewRelease(item: Item): boolean {
  const thirtyDaysAgo = Date.now() - NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000
  const currentYear = new Date().getFullYear()

  // Check metadata for release_date
  if (item.metadata?.release_date) {
    const releaseDateValue = item.metadata.release_date
    if (typeof releaseDateValue === 'string') {
      const releaseDate = new Date(releaseDateValue)
      return releaseDate.getTime() > thirtyDaysAgo
    }
  }

  // Check metadata for year (consider current year as "new")
  if (item.metadata?.year) {
    const yearValue = item.metadata.year
    if (typeof yearValue === 'number') {
      return yearValue >= currentYear
    }
  }

  return false
}

/**
 * Get image URL with fallback chain: image_url -> metadata.poster_url -> metadata.image.
 */
function getImageUrl(item: Item): string | null {
  if (item.image_url) return item.image_url

  if (item.metadata?.poster_url && typeof item.metadata.poster_url === 'string') {
    return item.metadata.poster_url
  }

  if (item.metadata?.image && typeof item.metadata.image === 'string') {
    return item.metadata.image
  }

  return null
}

/**
 * Item card component displaying item details with rating capability.
 *
 * Features:
 * - Displays item image, name, description, and metadata badges
 * - Interactive star rating with optimistic updates
 * - TODO list integration for watch-later functionality
 * - Community rating statistics
 * - Accessible keyboard navigation
 * - Reduced motion support
 * - Memoized for performance in large lists
 *
 * @example
 * <ItemCard
 *   item={item}
 *   onClick={handleItemClick}
 *   avgRating={4.5}
 *   ratingCount={120}
 *   initialUserRating={5}
 *   isInTodo={false}
 *   onAddToTodo={handleAddToTodo}
 * />
 */
const ItemCardComponent = ({
  item,
  onClick,
  showRating = true,
  avgRating,
  ratingCount,
  initialUserRating,
  disableHoverAnimation = false,
  isInTodo = false,
  onAddToTodo,
  onRemoveFromTodo
}: ItemCardProps) => {
  const { user } = useAuthStore()
  const [userRating, setUserRating] = useState<number | null>(
    initialUserRating !== undefined ? initialUserRating : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const lastFetchedItemId = useRef<string | null>(null)

  // Memoize computed values
  const badge = useMemo(
    () => (item.source ? SOURCE_BADGES[item.source] : null),
    [item.source]
  )
  const showCommunityStats = useMemo(
    () => avgRating !== undefined && ratingCount !== undefined && ratingCount > 0,
    [avgRating, ratingCount]
  )
  const shouldAnimate = useMemo(
    () => !prefersReducedMotion && !disableHoverAnimation,
    [prefersReducedMotion, disableHoverAnimation]
  )
  const imageUrl = useMemo(() => getImageUrl(item), [item])
  const isNew = useMemo(() => isNewRelease(item), [item])

  // Sync state with prop when initialUserRating changes (e.g., async batch load)
  useEffect(() => {
    if (initialUserRating !== undefined) {
      setUserRating(initialUserRating)
    }
  }, [initialUserRating])

  // Fetch user's existing rating on mount (skip if initialUserRating was provided)
  useEffect(() => {
    // Skip if initialUserRating was explicitly provided (even if null)
    if (initialUserRating !== undefined) return
    if (!user || !showRating) return

    // Prevent duplicate fetches for the same item
    if (lastFetchedItemId.current === item.id) return
    lastFetchedItemId.current = item.id

    async function fetchRating() {
      const { data } = await ratingService.getUserRating(item.id)
      if (data) {
        setUserRating(data.rating)
      }
    }

    fetchRating()
  }, [user, item.id, showRating, initialUserRating])

  const handleRatingChange = useCallback(async (rating: number) => {
    if (!user) return

    setIsLoading(true)
    const previousRating = userRating

    // Optimistic update
    setUserRating(rating)

    const { error } = await ratingService.upsertRating({
      item_id: item.id,
      rating
    })

    if (error) {
      // Rollback on error
      setUserRating(previousRating)
      toast.error("Couldn't save that. Try again?")
    } else {
      toast.success("Noted. Your taste is... interesting.")
    }

    setIsLoading(false)
  }, [user, userRating, item.id])

  const handleCardClick = useCallback(() => {
    onClick?.()
  }, [onClick])

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }, [onClick])

  const handleTodoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInTodo) {
      onRemoveFromTodo?.()
    } else {
      onAddToTodo?.()
    }
  }, [isInTodo, onRemoveFromTodo, onAddToTodo])

  const cardContent = (
    <div className="relative">
      {/* "New" badge - positioned on image or top corner */}
      {isNew && (
        <Badge
          variant="default"
          className="absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground"
        >
          New
        </Badge>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.name}
          className="w-full h-32 object-cover rounded-md mb-3"
          loading="lazy"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold line-clamp-1 text-sm">{item.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {badge && (
            <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
              {badge.label}
            </Badge>
          )}
        </div>
      </div>

      {item.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {item.description}
        </p>
      )}

      {showRating && (
        <>
          <Separator className="my-3" />
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <StarRating
                value={userRating}
                onChange={user ? handleRatingChange : undefined}
                disabled={isLoading}
                size="sm"
                readOnly={!user}
              />
              {/* TODO list button - show if user is logged in and hasn't rated */}
              {user && !userRating && onAddToTodo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isInTodo ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleTodoClick}
                    >
                      {isInTodo ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {isInTodo ? 'Remove from list' : 'Add to watch later'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              {!user && (
                <p className="text-[10px] text-muted-foreground">
                  Sign in to rate
                </p>
              )}
            </div>

            {/* Community stats - now using StarRating instead of Progress */}
            {showCommunityStats && (
              <div className="flex items-center gap-2">
                <StarRating
                  value={avgRating!}
                  readOnly
                  size="xs"
                  className="opacity-60"
                />
                <p className="text-[10px] text-muted-foreground">
                  {avgRating!.toFixed(1)} ({ratingCount})
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  // Animated card wrapper
  if (shouldAnimate) {
    return (
      <motion.div
        whileHover={{
          y: -4,
          scale: 1.02,
          transition: { duration: 0.2, ease: 'easeOut' }
        }}
        className="h-full"
      >
        <Card
          onClick={handleCardClick}
          className={cn(
            'p-4 h-full transition-shadow duration-200 overflow-hidden',
            onClick && 'cursor-pointer',
            'hover:shadow-lg hover:shadow-primary/5'
          )}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={onClick ? handleCardKeyDown : undefined}
        >
          {cardContent}
        </Card>
      </motion.div>
    )
  }

  // Static card (reduced motion or performance mode)
  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        'p-4 h-full hover:bg-accent/50 transition-colors',
        onClick && 'cursor-pointer'
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleCardKeyDown : undefined}
    >
      {cardContent}
    </Card>
  )
}

/**
 * Memoized ItemCard for optimal performance in lists.
 * Only re-renders when props actually change.
 */
export const ItemCard = memo(ItemCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.avgRating === nextProps.avgRating &&
    prevProps.ratingCount === nextProps.ratingCount &&
    prevProps.initialUserRating === nextProps.initialUserRating &&
    prevProps.isInTodo === nextProps.isInTodo &&
    prevProps.showRating === nextProps.showRating &&
    prevProps.disableHoverAnimation === nextProps.disableHoverAnimation &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onAddToTodo === nextProps.onAddToTodo &&
    prevProps.onRemoveFromTodo === nextProps.onRemoveFromTodo
  )
})
