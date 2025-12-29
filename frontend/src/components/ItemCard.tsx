import type { Item } from '../types'

interface ItemCardProps {
  item: Item
  onClick?: () => void
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

export function ItemCard({ item, onClick }: ItemCardProps) {
  const badge = item.source ? sourceBadges[item.source] : null

  return (
    <div
      onClick={onClick}
      className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
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
    </div>
  )
}
