import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Star, Pause, Play } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { statsService, type PopularItem } from '../services/statsService'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { SEO, WebSiteSchema } from '@/components/SEO'
import { PageTransition } from '@/components/PageTransition'

const CAROUSEL_INTERVAL_MS = 4000
const POPULAR_ITEMS_LIMIT = 6

/**
 * Home page with popular items carousel and FAQ.
 *
 * Features:
 * - Auto-rotating carousel of popular items
 * - Pause/play controls
 * - Respects reduced motion preference
 * - Accessible ARIA labels
 */
export function HomePage() {
  const { user } = useAuthStore()
  const [popularItems, setPopularItems] = useState<PopularItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  const currentItem = useMemo(
    () => popularItems[currentIndex],
    [popularItems, currentIndex]
  )

  // Fetch popular items for the preview
  useEffect(() => {
    const abortController = new AbortController()

    async function fetchPopular() {
      try {
        const { data } = await statsService.getPopularItems(POPULAR_ITEMS_LIMIT)

        if (abortController.signal.aborted) return

        if (data && data.length > 0) {
          setPopularItems(data)
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching popular items:', err)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchPopular()

    return () => {
      abortController.abort()
    }
  }, [])

  // Auto-rotate carousel (respects pause and reduced motion)
  useEffect(() => {
    if (popularItems.length === 0 || prefersReducedMotion || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % popularItems.length)
    }, CAROUSEL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [popularItems.length, prefersReducedMotion, isPaused])

  return (
    <PageTransition>
      <SEO
        title="mytops - Track Your Favorite Movies, Books, Games & More"
        description="Create your personal collection of favorites. Rate movies, books, anime, games, and restaurants. Share your taste with the world. No algorithms, no tracking—just your favorites, beautifully organized."
        url="/"
      />
      <WebSiteSchema />

      <div className="max-w-xl mx-auto py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <motion.h1
            className="text-4xl font-bold tracking-tight mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            mytops
          </motion.h1>
          <motion.p
            className="text-lg text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            Your taste, organized. No algorithms deciding for you.
          </motion.p>
        </div>

        {/* Live Preview Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="mb-8 overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-4 text-center">
                What people are rating
              </p>

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-1/2 mx-auto" />
                </div>
              ) : popularItems.length > 0 ? (
                <div className="h-20 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentItem?.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-xl">
                          {currentItem?.topic?.icon || '📦'}
                        </span>
                        <span className="font-semibold">
                          {currentItem?.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(currentItem?.avgRating || 0)
                                ? 'fill-foreground text-foreground'
                                : 'fill-transparent text-muted-foreground/30'
                            }`}
                          />
                        ))}
                        <span className="text-sm text-muted-foreground ml-2">
                          {currentItem?.avgRating?.toFixed(1)}
                        </span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Be the first to rate something!
                </p>
              )}

              {/* Carousel controls */}
              {popularItems.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  {/* Pause/Play button */}
                  <button
                    type="button"
                    onClick={togglePause}
                    className="p-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label={isPaused ? 'Play carousel' : 'Pause carousel'}
                  >
                    {isPaused ? (
                      <Play className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Pause className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>

                  {/* Carousel dots */}
                  <div className="flex gap-1.5" role="tablist" aria-label="Popular items">
                    {popularItems.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        role="tab"
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                          idx === currentIndex
                            ? 'bg-foreground'
                            : 'bg-muted-foreground/30'
                        }`}
                        aria-label={`View ${item.name}`}
                        aria-selected={idx === currentIndex}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="flex gap-3 justify-center mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Button asChild size="lg">
            <Link to="/topics" aria-label="Start curating your favorites by browsing topics">
              Start Curating
            </Link>
          </Button>
          {!user && (
            <Button variant="outline" size="lg" asChild>
              <Link to="/register" aria-label="Create a free account to save your favorites">
                Create Account
              </Link>
            </Button>
          )}
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what">
              <AccordionTrigger className="text-sm">
                What is this?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                A simple way to organize your favorites across different categories—movies,
                books, games, and more. Search for something, rate it, and it's yours to
                keep. If it doesn't exist in the database yet, AI looks it up and adds it
                permanently, so it's there for you and everyone else next time.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="topics">
              <AccordionTrigger className="text-sm">
                What can I track?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Movies, TV series, books, anime, games, and restaurants. More topics
                coming based on what people actually want to track. (Yes, I'm taking
                requests.)
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="privacy">
              <AccordionTrigger className="text-sm">
                Is my data private?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Your ratings are private by default. I don't sell your data. Making
                your profile public so others can see your taste is planned but not
                implemented yet—for now, everything you rate stays yours.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="why">
              <AccordionTrigger className="text-sm">
                Why does this exist?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                I wanted a fully organized, private yet simple selection of my
                favorites across many topics. Existing solutions didn't cover
                everything I wanted, or missed unconventional and indie picks. So I
                built an AI-powered solution that scrapes the web to add a permanent,
                structured record to the database—available to the whole community.
                An AI-generated database, essentially.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="free">
              <AccordionTrigger className="text-sm">
                Is it free?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                For you, yes. I cover the cost of the AI tokens for queries myself.
                If you want to help out, even starring the project on GitHub goes a
                long way.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </div>
    </PageTransition>
  )
}
