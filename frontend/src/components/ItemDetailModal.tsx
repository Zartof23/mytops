import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StarRating } from './StarRating'
import { LazyImage } from './LazyImage'
import { FlagItemModal } from './FlagItemModal'
import { AdminItemActions } from './admin/AdminItemActions'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getItemImageUrl } from '@/lib/itemImage'
import { useAuthStore } from '@/store/authStore'
import { Plus, Check, X, Bug } from 'lucide-react'
import type { Item, Topic } from '@/types'

interface ItemDetailModalProps {
  item: (Item & { topic?: Topic }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  avgRating?: number
  ratingCount?: number
  userRating?: number | null
  onRatingChange?: (rating: number) => void
  onRemoveRating?: () => void
  isInTodo?: boolean
  onAddToTodo?: () => void
  onRemoveFromTodo?: () => void
  isAuthenticated?: boolean
  alreadyFlagged?: boolean
  onRequireLogin?: () => void
  onItemChanged?: () => void
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
  onRemoveRating,
  isInTodo = false,
  onAddToTodo,
  onRemoveFromTodo,
  isAuthenticated = false,
  alreadyFlagged = false,
  onRequireLogin,
  onItemChanged
}: ItemDetailModalProps) => {
  const navigate = useNavigate()
  const isAdmin = useAuthStore((state) => state.isAdmin)
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagged, setFlagged] = useState(alreadyFlagged)
  const flaggedItemId = useRef(item?.id)

  useEffect(() => {
    if (flaggedItemId.current !== item?.id) {
      flaggedItemId.current = item?.id
      setFlagged(alreadyFlagged)
    }
  }, [item?.id, alreadyFlagged])

  const topicSlug = item?.topic?.slug || ''
  const metadataFields = useMemo(
    () => topicMetadataConfig[topicSlug] || [],
    [topicSlug]
  )
  const imageUrl = useMemo(() => (item ? getItemImageUrl(item) : ''), [item])

  const handleTodoClick = useCallback(() => {
    if (isInTodo) {
      onRemoveFromTodo?.()
    } else {
      onAddToTodo?.()
    }
  }, [isInTodo, onRemoveFromTodo, onAddToTodo])

  const handleFlagClick = useCallback(() => {
    if (!isAuthenticated) {
      // Default to the login route: no parent passes onRequireLogin, and a
      // button that silently does nothing is worse than a redirect.
      if (onRequireLogin) {
        onRequireLogin()
      } else {
        navigate('/login')
      }
      return
    }
    setFlagOpen(true)
  }, [isAuthenticated, onRequireLogin, navigate])

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {item.topic?.icon && <span className="text-xl">{item.topic.icon}</span>}
            <span className="line-clamp-2">{item.name}</span>
          </DialogTitle>
          <DialogDescription>
            {item.description || `View details and ratings for ${item.name}`}
          </DialogDescription>
        </DialogHeader>

        {/* Hero Image */}
        {imageUrl && (
          <div className="relative -mx-6 -mt-2 h-56 md:h-72 overflow-hidden bg-muted">
            <LazyImage
              src={imageUrl}
              alt={item.name}
              className="w-full h-full"
              aspectRatio="auto"
              objectFit="contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          </div>
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

        <Separator />

        {/* Rating section */}
        <div className="space-y-4">
          {/* User rating */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Your Rating</p>
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <StarRating
                    value={userRating ?? null}
                    onChange={onRatingChange}
                    size="md"
                  />
                  {userRating != null && onRemoveRating && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onRemoveRating}
                      aria-label="Remove your rating"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={handleFlagClick}
                  disabled={flagged}
                  aria-label={flagged ? 'You already reported this item' : 'Report incorrect information'}
                >
                  <Bug className={`h-4 w-4 ${flagged ? 'fill-current' : ''}`} />
                  {flagged ? 'Reported' : 'Report a problem'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {flagged
                  ? "Already in the queue. We'll get to it."
                  : isAuthenticated
                    ? 'Something wrong with this info?'
                    : 'You need to log in for this. I know, I know, another login.'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {isAdmin && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Admin</p>
              <AdminItemActions
                item={item}
                onChanged={() => {
                  onItemChanged?.()
                  onOpenChange(false)
                }}
              />
            </div>
          </>
        )}
      </DialogContent>

      <FlagItemModal
        item={item}
        open={flagOpen}
        onOpenChange={setFlagOpen}
        onFlagged={() => setFlagged(true)}
      />
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
    prevProps.alreadyFlagged === nextProps.alreadyFlagged &&
    prevProps.onRequireLogin === nextProps.onRequireLogin &&
    prevProps.onOpenChange === nextProps.onOpenChange &&
    prevProps.onRatingChange === nextProps.onRatingChange &&
    prevProps.onRemoveRating === nextProps.onRemoveRating &&
    prevProps.onAddToTodo === nextProps.onAddToTodo &&
    prevProps.onRemoveFromTodo === nextProps.onRemoveFromTodo &&
    prevProps.onItemChanged === nextProps.onItemChanged
  )
})
