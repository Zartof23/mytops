import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { getItemImageUrl } from '@/lib/itemImage'
import { LazyImage } from '../LazyImage'
import { StarRating } from '../StarRating'
import type { Item, Topic } from '../../types'

interface RatingRowProps {
  item: Item
  topic?: Topic | null
  rating: number
  notes?: string | null
}

/**
 * One rated item as a compact row: thumbnail, name, optional note, stars.
 *
 * Deliberately not an ItemPosterCard — a user with hundreds of ratings needs a
 * scannable list, not a wall of posters.
 */
export function RatingRow({ item, topic, rating, notes }: RatingRowProps) {
  const imageUrl = useMemo(() => getItemImageUrl(item), [item])

  return (
    <Card className="flex flex-row items-center gap-3 p-2">
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted/40">
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={item.name}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div
            data-testid="rating-row-fallback"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-lg opacity-30" aria-hidden="true">
              {topic?.icon || '📦'}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notes}</p>
        )}
      </div>

      <StarRating value={rating} readOnly size="sm" />
    </Card>
  )
}
