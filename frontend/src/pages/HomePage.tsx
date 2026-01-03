import { useState, useEffect, useRef, useCallback } from 'react'
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

export function HomePage() {
  const { user } = useAuthStore()
  const [popularItems, setPopularItems] = useState<PopularItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Prevent duplicate fetch on React StrictMode
  const hasFetched = useRef(false)

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  // Fetch popular items for the preview
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    async function fetchPopular() {
      const { data } = await statsService.getPopularItems(6)
      if (data && data.length > 0) {
        setPopularItems(data)
      }
      setIsLoading(false)
    }
    fetchPopular()
  }, [])

  // Auto-rotate carousel (respects pause and reduced motion)
  useEffect(() => {
    if (popularItems.length === 0 || prefersReducedMotion || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % popularItems.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [popularItems.length, prefersReducedMotion, isPaused])

  const currentItem = popularItems[currentIndex]

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
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                    aria-label={isPaused ? 'Play carousel' : 'Pause carousel'}
                  >
                    {isPaused ? (
                      <Play className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Pause className="w-3 h-3 text-muted-foreground" />
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
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
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
            <Link to="/topics">Start Curating</Link>
          </Button>
          {!user && (
            <Button variant="outline" size="lg" asChild>
              <Link to="/register">Create Account</Link>
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
                You search. You rate. We remember. If something doesn't exist in our
                database, AI creates it. No tracking, no recommendations you didn't
                ask for. Just your favorites, beautifully organized.
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
                Your ratings are private by default. You can choose to make your
                profile public if you want to share your impeccable taste with the
                world. I don't sell your data. I barely know SQL.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="why">
              <AccordionTrigger className="text-sm">
                Why does this exist?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                I wanted to track my favorite anime and couldn't find anything
                simple enough. So I built this. Yes, I'm a backend dev. Yes, this
                frontend was painful. You're welcome.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>

        {/* Footer Quote */}
        <motion.p
          className="text-center text-xs text-muted-foreground italic mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          "Built by a backend dev who doesn't usually do frontend."
        </motion.p>
      </div>
    </PageTransition>
  )
}
