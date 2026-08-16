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

const CHIP_BASE =
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
          <span id={`${inputId}-enter-hint`} className="sr-only">
            Press Enter to search
          </span>
        )}
        {showEnterHint && !isSearching && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground"
          >
            <CornerDownLeft className="h-3 w-3" />
            Enter
          </span>
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
          <button
            type="button"
            onClick={() => onTopicChange?.(null)}
            aria-pressed={activeTopicId === null}
            aria-label="Search all topics"
            className={`${CHIP_BASE} ${
              activeTopicId === null
                ? 'bg-foreground text-background border-foreground'
                : 'hover:bg-muted'
            }`}
          >
            All
          </button>
          {topics?.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onTopicChange?.(topic.id)}
              aria-pressed={activeTopicId === topic.id}
              aria-label={`Search ${topic.name} only`}
              className={`${CHIP_BASE} ${
                activeTopicId === topic.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {topic.icon && <span aria-hidden="true">{topic.icon}</span>}
              {topic.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
