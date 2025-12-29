import { useState, useEffect } from 'react'
import type { Item } from '../types'
import { StarRating } from './StarRating'
import { useAuthStore } from '../store/authStore'
import { ratingService } from '../services/ratingService'

interface ItemCardProps {
  item: Item
  onClick?: () => void
  /** Show rating component (default: true) */
  showRating?: boolean
}

const sourceBadges = {
  seed: {
    label: 'Curated',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  ai_generated: {
    label: 'AI',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  },
  user_submitted: {
    label: 'User',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
} as const

export function ItemCard({ item, onClick, showRating = true }: ItemCardProps) {
  const { user } = useAuthStore()
  const [userRating, setUserRating] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const badge = item.source ? sourceBadges[item.source] : null

  // Fetch user's existing rating on mount
  useEffect(() => {
    if (!user || !showRating) return

    async function fetchRating() {
      const { data } = await ratingService.getUserRating(item.id)
      if (data) {
        setUserRating(data.rating)
      }
    }

    fetchRating()
  }, [user, item.id, showRating])

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
      console.error('Failed to save rating:', error)
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

  return (
    <div
      onClick={handleCardClick}
      className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleCardKeyDown : undefined}
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-32 object-cover rounded-md mb-3"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold line-clamp-1">{item.name}</h3>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      {item.description && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {item.description}
        </p>
      )}

      {showRating && (
        <div
          className="mt-3 pt-3 border-t"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <StarRating
            value={userRating}
            onChange={user ? handleRatingChange : undefined}
            disabled={isLoading}
            size="sm"
            readOnly={!user}
          />
          {!user && (
            <p className="text-xs text-muted-foreground mt-1">
              Sign in to rate
            </p>
          )}
        </div>
      )}
    </div>
  )
}
