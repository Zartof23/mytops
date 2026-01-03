import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StarRating } from './StarRating'
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
const topicMetadataConfig: Record<string, { label: string; key: string }[]> = {
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

export function ItemDetailModal({
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
}: ItemDetailModalProps) {
  if (!item) return null

  const topicSlug = item.topic?.slug || ''
  const metadataFields = topicMetadataConfig[topicSlug] || []
  const imageUrl = item.image_url ||
    (item.metadata?.poster_url as string) ||
    (item.metadata?.image as string) ||
    null

  const handleTodoClick = () => {
    if (isInTodo) {
      onRemoveFromTodo?.()
    } else {
      onAddToTodo?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {item.topic?.icon && <span className="text-xl">{item.topic.icon}</span>}
            <span className="line-clamp-2">{item.name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Image */}
        {imageUrl && (
          <div className="relative -mx-6 -mt-2">
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
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
