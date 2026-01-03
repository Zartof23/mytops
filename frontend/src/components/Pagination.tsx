import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className
}: PaginationProps) {
  const goToPrevious = useCallback(() => {
    onPageChange(currentPage - 1)
  }, [onPageChange, currentPage])

  const goToNext = useCallback(() => {
    onPageChange(currentPage + 1)
  }, [onPageChange, currentPage])

  if (totalPages <= 1) return null

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-2', className)}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={goToPrevious}
        disabled={disabled || currentPage <= 1}
        aria-label="Go to previous page"
        className="h-8"
      >
        <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
        Previous
      </Button>

      <span
        className="text-sm text-muted-foreground px-4 tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        Page {currentPage} of {totalPages}
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={goToNext}
        disabled={disabled || currentPage >= totalPages}
        aria-label="Go to next page"
        className="h-8"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
      </Button>
    </nav>
  )
}
