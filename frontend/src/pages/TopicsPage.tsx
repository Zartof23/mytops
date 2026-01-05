import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SEO } from '@/components/SEO'
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/PageTransition'
import { LazyImage } from '@/components/LazyImage'
import type { Topic } from '../types'

const SKELETON_CARDS_COUNT = 6

/**
 * Skeleton loading state for topic cards.
 */
function TopicsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: SKELETON_CARDS_COUNT }, (_, i) => (
        <Card key={i} className="p-0 overflow-hidden">
          <Skeleton className="h-20 w-full" />
          <div className="p-5">
            <Skeleton className="h-10 w-10 rounded mb-3" />
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        </Card>
      ))}
    </div>
  )
}

/**
 * Topics page displaying all available topic categories.
 *
 * Features:
 * - Fetches and displays topic categories from database
 * - Skeleton loading states
 * - Responsive grid layout
 * - Accessible navigation and ARIA labels
 * - Reduced motion support
 */
export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  // Memoize empty state check
  const hasTopics = useMemo(() => topics.length > 0, [topics.length])

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchTopics(signal: AbortSignal): Promise<void> {
      try {
        const { data, error: fetchError } = await supabase
          .from('topics')
          .select('*')
          .order('name')

        if (signal.aborted) return

        if (fetchError) {
          setError(fetchError.message)
        } else {
          setTopics(data || [])
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error('Error fetching topics:', err)
          setError('Failed to load topics')
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchTopics(abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto" role="status" aria-live="polite">
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <TopicsSkeleton />
        <span className="sr-only">Loading topics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-2 font-medium" role="alert">
              Something went wrong
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground italic mt-4">
              Honestly, I'm surprised it worked this long.
            </p>
          </Card>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <SEO
        title="Browse Topics"
        description="Explore movies, books, anime, games, TV series, and restaurants. Find and rate your favorites across all categories."
        url="/topics"
      />

      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl font-bold mb-1">Topics</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Pick a category and start tracking your favorites.
          </p>
        </motion.div>

        {!hasTopics ? (
          <Card className="p-8 text-center" role="status">
            <p className="text-muted-foreground mb-2">No topics yet.</p>
            <p className="text-xs text-muted-foreground italic">
              The database is as empty as my design skills.
            </p>
          </Card>
        ) : (
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {topics.map((topic) => (
              <StaggerItem key={topic.id}>
                <Link to={`/topics/${topic.slug}`} className="block h-full">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : {
                      y: -4,
                      scale: 1.02,
                      transition: { duration: 0.2, ease: 'easeOut' }
                    }}
                    className="h-full"
                  >
                    <Card className="p-0 h-full overflow-hidden transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5">
                      {/* Topic image header */}
                      <div className="relative h-24 overflow-hidden">
                        {topic.image_url ? (
                          <>
                            <div className="absolute inset-0">
                              <LazyImage
                                src={topic.image_url}
                                alt={topic.name}
                                aspectRatio="auto"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                            <span className="absolute bottom-2 left-4 text-2xl drop-shadow-lg z-10">
                              {topic.icon}
                            </span>
                          </>
                        ) : (
                          <div className="h-full bg-muted/30 flex items-center justify-center">
                            <span className="text-4xl opacity-50">{topic.icon}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h2 className="font-medium text-sm">{topic.name}</h2>
                        {topic.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </PageTransition>
  )
}
