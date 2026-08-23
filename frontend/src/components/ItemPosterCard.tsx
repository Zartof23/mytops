import { useMemo, useCallback, memo, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getItemImageUrl } from '@/lib/itemImage'
import { LazyImage } from './LazyImage'
import type { Item, Topic } from '../types'

interface ItemPosterCardProps {
  item: Item & { topic?: Topic }
  /** Topic used for the emoji fallback when the item has no image */
  topic?: Topic | null
  onClick?: () => void
  /** Rendered under the title (stars, notes, anything small) */
  footer?: ReactNode
  /** Overlay control pinned to the top-right corner (e.g. a remove button) */
  action?: ReactNode
  className?: string
}

/**
 * Poster-style item card: image on top, name underneath, optional footer.
 *
 * Shared by the profile's Top Rated row and Watch Later grid so both surfaces
 * look identical. Falls back to the topic emoji when enrichment never found an
 * image, which is the common case for freshly added items.
 */
const ItemPosterCardComponent = ({
  item,
  topic,
  onClick,
  footer,
  action,
  className
}: ItemPosterCardProps) => {
  const imageUrl = useMemo(() => getItemImageUrl(item), [item])
  const icon = topic?.icon || item.topic?.icon || '📦'

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick?.()
      }
    },
    [onClick]
  )

  return (
    <Card
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'group relative p-0 overflow-hidden transition-colors',
        onClick && 'cursor-pointer hover:border-foreground/20',
        className
      )}
    >
      <div className="relative aspect-[2/3] bg-muted/40">
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div
            data-testid="poster-fallback"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-4xl opacity-30" aria-hidden="true">
              {icon}
            </span>
          </div>
        )}
      </div>

      {action && <div className="absolute top-1.5 right-1.5 z-10">{action}</div>}

      <div className="p-2 space-y-1">
        <p className="text-xs font-medium leading-tight line-clamp-2">
          {item.name}
        </p>
        {footer}
      </div>
    </Card>
  )
}

export const ItemPosterCard = memo(ItemPosterCardComponent)
