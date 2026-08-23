import { useState, useMemo } from 'react'
import { Bookmark, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ItemPosterCard } from '../ItemPosterCard'
import type { Topic, UserTodoItem } from '../../types'

export interface TodoGroup {
  topic: Topic
  items: UserTodoItem[]
}

interface TodoSectionProps {
  groups: TodoGroup[]
  onRemove: (itemId: string) => void
}

const ALL = 'all'

/**
 * Watch Later: topic filter pills over a grid of poster cards.
 *
 * Takes the topic-grouped shape `todoService.getAllTodos()` already returns,
 * so filtering is a lookup rather than a re-scan of a flattened list.
 */
export function TodoSection({ groups, onRemove }: TodoSectionProps) {
  const [selected, setSelected] = useState<string>(ALL)

  const total = useMemo(
    () => groups.reduce((acc, { items }) => acc + items.length, 0),
    [groups]
  )

  // A topic can disappear once its last item is removed; fall back to All.
  const activeGroup = groups.find(({ topic }) => topic.id === selected)
  const visible = activeGroup ? activeGroup.items : groups.flatMap(({ items }) => items)

  if (groups.length === 0) return null

  return (
    <section className="mb-8" aria-labelledby="watch-later-heading">
      <div className="flex items-center justify-between mb-3">
        <h2
          id="watch-later-heading"
          className="text-sm font-medium flex items-center gap-2"
        >
          <Bookmark className="h-4 w-4" />
          Watch Later
          <Badge variant="secondary" className="text-xs">
            {total}
          </Badge>
        </h2>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <FilterPill
          active={!activeGroup}
          count={total}
          label="All"
          onClick={() => setSelected(ALL)}
        />
        {groups.map(({ topic, items }) => (
          <FilterPill
            key={topic.id}
            active={activeGroup?.topic.id === topic.id}
            count={items.length}
            label={topic.name}
            icon={topic.icon}
            onClick={() => setSelected(topic.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {visible.map((todo) =>
          todo.item ? (
            <ItemPosterCard
              key={todo.id}
              item={todo.item}
              topic={todo.topic}
              action={
                <button
                  type="button"
                  onClick={() => onRemove(todo.item_id)}
                  className="p-1 rounded-full bg-background/80 backdrop-blur hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`Remove ${todo.item.name} from watch later`}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              }
            />
          ) : null
        )}
      </div>
    </section>
  )
}

interface FilterPillProps {
  active: boolean
  label: string
  count: number
  icon?: string | null
  onClick: () => void
}

function FilterPill({ active, label, count, icon, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${count} items`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        active
          ? 'bg-accent border-foreground/20 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent/50'
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
      <span className="text-muted-foreground">{count}</span>
    </button>
  )
}
