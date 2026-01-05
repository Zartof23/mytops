import { memo, useCallback, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StarRating } from './StarRating'
import { LazyImage } from './LazyImage'
import { Plus, Check } from 'lucide-react'
import type { Item, Topic } from '../types'

interface ItemDetailModalProps {
  item: (Item & { topic?: Topic }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  avgRating?: number
  ratingCount?: number
  userRating?: number | null
  onRatingChange?: (rating: number) => void
  isInTodo?: boolean
  onAddToTodo?: () => void
  onRemoveFromTodo?: () => void
  isAuthenticated?: boolean
}

// Topic-specific metadata field configurations
const topicMetadataConfig: Record<string, Array<{ label: string; key: string }>> = {
  movies: [
    { label: 'Year', key: 'year' },
    { label: 'Director', key: 'director' },
    { label: 'Genre', key: 'genre' },
    { label: 'Runtime', key: 'runtime' },
    { label: 'Cast', key: 'cast' },
  ],
  series: [
    { label: 'Year', key: 'year' },
    { label: 'Seasons', key: 'seasons' },
    { label: 'Network', key: 'network' },
    { label: 'Creator', key: 'creator' },
    { label: 'Genre', key: 'genre' },
  ],
  books: [
    { label: 'Author', key: 'author' },
    { label: 'Year', key: 'year' },
    { label: 'Pages', key: 'pages' },
    { label: 'Publisher', key: 'publisher' },
    { label: 'Genre', key: 'genre' },
  ],
  anime: [
    { label: 'Year', key: 'year' },
    { label: 'Episodes', key: 'episodes' },
    { label: 'Studio', key: 'studio' },
    { label: 'Genre', key: 'genre' },
    { label: 'Status', key: 'status' },
  ],
  games: [
    { label: 'Year', key: 'year' },
    { label: 'Platform', key: 'platform' },
    { label: 'Developer', key: 'developer' },
    { label: 'Publisher', key: 'publisher' },
    { label: 'Genre', key: 'genre' },
  ],
  restaurants: [
    { label: 'Location', key: 'location' },
    { label: 'Cuisine', key: 'cuisine' },
    { label: 'Price Range', key: 'price_range' },
    { label: 'Address', key: 'address' },
  ],
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  return String(value || '')
}

/**
 * Get image URL with fallback chain.
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
 * Item detail modal displaying full item information.
 *
 * Features:
 * - Displays item details with topic-specific metadata
 * - Interactive rating system
 * - TODO list integration
 * - Responsive design
 * - Memoized for performance
 *
 * @example
 * <ItemDetailModal
 *   item={item}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   userRating={4}
 *   onRatingChange={handleRating}
 * />
 */
const ItemDetailModalComponent = ({
  item,
  open,
  onOpenChange,
  avgRating,
  ratingCount,
  userRating,
  onRatingChange,
  isInTodo = false,
  onAddToTodo,
  onRemoveFromTodo,
  isAuthenticated = false
}: ItemDetailModalProps) => {
  if (!item) return null

  const topicSlug = item.topic?.slug || ''
  const metadataFields = useMemo(
    () => topicMetadataConfig[topicSlug] || [],
    [topicSlug]
  )
  const imageUrl = useMemo(() => getImageUrl(item), [item])

  const handleTodoClick = useCallback(() => {
    if (isInTodo) {
      onRemoveFromTodo?.()
    } else {
      onAddToTodo?.()
    }
  }, [isInTodo, onRemoveFromTodo, onAddToTodo])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {item.topic?.icon && <span className="text-xl">{item.topic.icon}</span>}
            <span className="line-clamp-2">{item.name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Hero Image */}
        {imageUrl && (
          <div className="relative -mx-6 -mt-2 h-56 md:h-72 overflow-hidden">
            <LazyImage
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              aspectRatio="auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className="text-sm text-muted-foreground">
            {item.description}
          </p>
        )}

        {/* Metadata fields */}
        {metadataFields.length > 0 && item.metadata && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {metadataFields.map(({ label, key }) => {
                const value = item.metadata?.[key]
                if (!value) return null

                return (
                  <div key={key}>
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <p className="font-medium">{formatMetadataValue(value)}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Source badge */}
        {item.source && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                item.source === 'seed' ? 'secondary' :
                item.source === 'ai_generated' ? 'outline' :
                'default'
              }
              className="text-xs"
            >
              {item.source === 'seed' ? 'Curated' :
               item.source === 'ai_generated' ? 'AI Generated' :
               'User Submitted'}
            </Badge>
            {item.ai_confidence && (
              <span className="text-xs text-muted-foreground">
                {Math.round(item.ai_confidence * 100)}% confidence
              </span>
            )}
          </div>
        )}

        <Separator />

        {/* Rating section */}
        <div className="space-y-4">
          {/* User rating */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Your Rating</p>
              {isAuthenticated ? (
                <StarRating
                  value={userRating ?? null}
                  onChange={onRatingChange}
                  size="md"
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Sign in to rate
                </p>
              )}
            </div>

            {/* TODO button */}
            {isAuthenticated && !userRating && onAddToTodo && (
              <Button
                variant={isInTodo ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleTodoClick}
                className="gap-1"
              >
                {isInTodo ? (
                  <>
                    <Check className="h-4 w-4" />
                    In List
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Watch Later
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Community rating */}
          {avgRating !== undefined && ratingCount !== undefined && ratingCount > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Community Rating</p>
              <div className="flex items-center gap-2">
                <StarRating value={avgRating} readOnly size="sm" />
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Memoized ItemDetailModal - only re-renders when props change.
 */
export const ItemDetailModal = memo(ItemDetailModalComponent, (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.open === nextProps.open &&
    prevProps.avgRating === nextProps.avgRating &&
    prevProps.ratingCount === nextProps.ratingCount &&
    prevProps.userRating === nextProps.userRating &&
    prevProps.isInTodo === nextProps.isInTodo &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.onOpenChange === nextProps.onOpenChange &&
    prevProps.onRatingChange === nextProps.onRatingChange &&
    prevProps.onAddToTodo === nextProps.onAddToTodo &&
    prevProps.onRemoveFromTodo === nextProps.onRemoveFromTodo
  )
})
