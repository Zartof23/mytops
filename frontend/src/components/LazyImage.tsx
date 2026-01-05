import { useState, useEffect, useRef, memo } from 'react'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  /** Placeholder background while loading (default: bg-muted) */
  placeholderClassName?: string
  /** Aspect ratio for placeholder (default: auto) */
  aspectRatio?: 'square' | '16/9' | '4/3' | '3/2' | 'auto'
  /** Loading strategy: lazy (default) or eager */
  loading?: 'lazy' | 'eager'
  /** Image width in pixels (for CLS optimization) */
  width?: number
  /** Image height in pixels (for CLS optimization) */
  height?: number
  /** Fetch priority hint for LCP optimization (default: auto) */
  fetchPriority?: 'high' | 'low' | 'auto'
  /** Sizes attribute for responsive images */
  sizes?: string
  /** Function to call when image loads */
  onLoad?: () => void
  /** Function to call if image fails to load */
  onError?: () => void
}

const ASPECT_RATIOS = {
  square: 'aspect-square',
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  auto: '',
} as const

/**
 * Optimized lazy-loading image component.
 *
 * Features:
 * - Native lazy loading with fallback for older browsers
 * - Intersection Observer for precise loading control
 * - Smooth fade-in transition when loaded
 * - Placeholder with aspect ratio support
 * - Error state handling
 * - Memoized for performance
 * - CLS optimization with width/height attributes
 * - Fetch priority support for LCP optimization
 *
 * @example
 * <LazyImage
 *   src="/image.jpg"
 *   alt="Description"
 *   aspectRatio="16/9"
 *   width={800}
 *   height={450}
 *   fetchPriority="high"
 *   className="rounded-md"
 * />
 */
const LazyImageComponent = ({
  src,
  alt,
  className,
  placeholderClassName = 'bg-muted',
  aspectRatio = 'auto',
  loading = 'lazy',
  width,
  height,
  fetchPriority = 'auto',
  sizes,
  onLoad,
  onError,
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If eager loading or already decided to load, skip observer
    if (loading === 'eager' || shouldLoad) return

    const container = containerRef.current
    if (!container) return

    // Use IntersectionObserver for precise control over when to start loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      }
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [loading, shouldLoad])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  const aspectRatioClass = aspectRatio !== 'auto' ? ASPECT_RATIOS[aspectRatio] : ''

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', aspectRatioClass, className)}>
      {/* Placeholder */}
      {!isLoaded && !hasError && (
        <div
          className={cn(
            'absolute inset-0 animate-pulse',
            placeholderClassName
          )}
          aria-hidden="true"
        />
      )}

      {/* Actual Image */}
      {shouldLoad && !hasError && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          width={width}
          height={height}
          fetchPriority={fetchPriority}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}

      {/* Error State */}
      {hasError && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-xs text-muted-foreground',
            placeholderClassName
          )}
        >
          <span>Failed to load image</span>
        </div>
      )}
    </div>
  )
}

/**
 * Memoized LazyImage component - only re-renders when props change.
 */
export const LazyImage = memo(LazyImageComponent, (prevProps, nextProps) => {
  return (
    prevProps.src === nextProps.src &&
    prevProps.alt === nextProps.alt &&
    prevProps.className === nextProps.className &&
    prevProps.aspectRatio === nextProps.aspectRatio &&
    prevProps.loading === nextProps.loading &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.fetchPriority === nextProps.fetchPriority &&
    prevProps.sizes === nextProps.sizes
  )
})
