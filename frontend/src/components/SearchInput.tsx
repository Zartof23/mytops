import { useCallback, useId } from 'react'
import { Search, Loader2, CornerDownLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/types'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Accessible name for the input. */
  ariaLabel: string
  /** Shows an inline spinner with a polite live region. */
  isSearching?: boolean
  /**
   * Show an Enter-key badge at the end of the field. For a parent that only
   * runs its query on Enter, this is the only thing telling the user that
   * typing alone does nothing. Yields to the spinner, which shares the slot.
   */
  showEnterHint?: boolean
  /** Scope chips. Omit entirely to hide the chip row. */
  topics?: Topic[]
  /** Currently selected scope. `null` means "all topics". */
  activeTopicId?: string | null
  onTopicChange?: (topicId: string | null) => void
  /** Extra classes for the wrapping element. */
  className?: string
  /** Larger styling for the home page hero. */
  size?: 'default' | 'hero'
  /**
   * ARIA combobox wiring for a caller that pairs this input with a listbox
   * dropdown (e.g. `ItemSearch`). All optional and inert when omitted, so
   * bare usage (e.g. `TopicDetailPage`) is unaffected.
   */
  role?: 'combobox'
  ariaExpanded?: boolean
  /** Id of the listbox this input controls. */
  ariaControls?: string
  /** Id of the currently highlighted option, if any. */
  ariaActiveDescendant?: string
}

/** Shared pill styling for topic chips, also used by `ItemSearch`. */
export const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary'

/**
 * Presentational search field with an optional topic scope chip row.
 *
 * Holds no query state and performs no fetching — the parent owns both. This is
 * what lets the home page (dropdown results) and the topic page (paginated grid)
 * share one input without sharing a results pipeline.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  isSearching = false,
  showEnterHint = false,
  topics,
  activeTopicId = null,
  onTopicChange,
  className = '',
  size = 'default',
  role,
  ariaExpanded,
  ariaControls,
  ariaActiveDescendant
}: SearchInputProps) {
  const inputId = useId()

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value)
    },
    [onChange]
  )

  const showChips = Boolean(topics && topics.length > 0 && onTopicChange)

  // "All" is just the chip whose scope is `null`, so both render from one list.
  const chips = [
    { id: null, label: 'All', icon: null, ariaLabel: 'Search all topics' },
    ...(topics ?? []).map((topic) => ({
      id: topic.id as string | null,
      label: topic.name,
      icon: topic.icon,
      ariaLabel: `Search ${topic.name} only`
    }))
  ]

  return (
    <div className={className}>
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {ariaLabel}
        </label>
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${
            size === 'hero' ? 'h-5 w-5' : 'h-4 w-4'
          }`}
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          aria-label={ariaLabel}
          role={role}
          aria-expanded={role === 'combobox' ? ariaExpanded : undefined}
          aria-controls={role === 'combobox' ? ariaControls : undefined}
          aria-activedescendant={role === 'combobox' ? ariaActiveDescendant : undefined}
          aria-autocomplete={role === 'combobox' ? 'list' : undefined}
          aria-describedby={showEnterHint ? `${inputId}-enter-hint` : undefined}
          className={`${size === 'hero' ? 'h-14 pl-11 text-base' : 'h-10 pl-9'} ${
            // Keep the text from running underneath the badge.
            showEnterHint && !isSearching ? 'pr-24' : 'pr-3'
          }`}
        />
        {showEnterHint && (
          <>
            <span id={`${inputId}-enter-hint`} className="sr-only">
              Press Enter to search
            </span>
            {/* The badge shares its slot with the spinner, so it yields to it. */}
            {!isSearching && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground"
              >
                <CornerDownLeft className="h-3 w-3" />
                Enter
              </span>
            )}
          </>
        )}
        {isSearching && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Searching...</span>
          </span>
        )}
      </div>

      {showChips && (
        <div
          role="group"
          aria-label="Search scope"
          className="mt-3 flex flex-wrap justify-center gap-2"
        >
          {chips.map((chip) => (
            <button
              key={chip.id ?? 'all'}
              type="button"
              onClick={() => onTopicChange?.(chip.id)}
              aria-pressed={activeTopicId === chip.id}
              aria-label={chip.ariaLabel}
              className={`${CHIP_BASE} ${
                activeTopicId === chip.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {chip.icon && <span aria-hidden="true">{chip.icon}</span>}
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
