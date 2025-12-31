import { useState, useEffect } from 'react'
import type { Item } from '../types'
import { StarRating } from './StarRating'
import { useAuthStore } from '../store/authStore'
import { ratingService } from '../services/ratingService'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface ItemCardProps {
  item: Item
  onClick?: () => void
  /** Show rating component (default: true) */
  showRating?: boolean
}

const sourceBadges = {
  seed: { label: 'Curated', variant: 'secondary' as const },
  ai_generated: { label: 'AI', variant: 'outline' as const },
  user_submitted: { label: 'User', variant: 'default' as const }
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

  return (
    <Card
      onClick={handleCardClick}
      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
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
        <h3 className="font-semibold line-clamp-1 text-sm">{item.name}</h3>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
            {badge.label}
          </Badge>
        )}
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
          >
            <StarRating
              value={userRating}
              onChange={user ? handleRatingChange : undefined}
              disabled={isLoading}
              size="sm"
              readOnly={!user}
            />
            {!user && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Sign in to rate
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
