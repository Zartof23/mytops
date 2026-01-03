import { useState, useEffect, useRef } from 'react'
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

const sourceBadges = {
  seed: { label: 'Curated', variant: 'secondary' as const },
  ai_generated: { label: 'AI', variant: 'outline' as const },
  user_submitted: { label: 'User', variant: 'default' as const }
} as const

/**
 * Check if item is a "new" release (within last 30 days or current year)
 */
function isNewRelease(item: Item): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const currentYear = new Date().getFullYear()

  // Check metadata for release_date
  if (item.metadata?.release_date) {
    const releaseDate = new Date(item.metadata.release_date as string)
    return releaseDate.getTime() > thirtyDaysAgo
  }

  // Check metadata for year (consider current year as "new")
  if (item.metadata?.year) {
    const year = item.metadata.year as number
    return year >= currentYear
  }

  return false
}

/**
 * Get image URL with fallback chain: image_url -> metadata.poster_url -> metadata.image
 */
function getImageUrl(item: Item): string | null {
  return (
    item.image_url ||
    (item.metadata?.poster_url as string) ||
    (item.metadata?.image as string) ||
    null
  )
}

export function ItemCard({
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
}: ItemCardProps) {
  const { user } = useAuthStore()
  // Use initialUserRating if provided, otherwise null
  const [userRating, setUserRating] = useState<number | null>(
    initialUserRating !== undefined ? initialUserRating : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Track last fetched item to prevent duplicate API calls
  const lastFetchedItemId = useRef<string | null>(null)

  const badge = item.source ? sourceBadges[item.source] : null
  const showCommunityStats = avgRating !== undefined && ratingCount !== undefined && ratingCount > 0
  const shouldAnimate = !prefersReducedMotion && !disableHoverAnimation
  const imageUrl = getImageUrl(item)
  const isNew = isNewRelease(item)

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

  const handleRatingChange = async (rating: number) => {
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
  }

  // Handle card click
  const handleCardClick = () => {
    onClick?.()
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  // Handle TODO list actions
  const handleTodoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInTodo) {
      onRemoveFromTodo?.()
    } else {
      onAddToTodo?.()
    }
  }

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
