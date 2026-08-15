import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { statsService } from '../services/statsService'
import { ratingService } from '../services/ratingService'
import { ItemSearch } from '../components/ItemSearch'
import { FaqSection, FAQ_ANCHOR_ID } from '../components/FaqSection'
import { TopicBands } from '../components/TopicBands'
import { ItemDetailModal } from '@/components/ItemDetailModal'
import { SEO, WebSiteSchema } from '@/components/SEO'
import { PageTransition } from '@/components/PageTransition'
import type { SearchResultItem } from '../services/searchService'

/**
 * Home page: one search box across every topic, with the FAQ below the fold.
 *
 * Search is the whole product here — there is deliberately no carousel, banner
 * or call-to-action competing with the input.
 */
export function HomePage() {
  const { user } = useAuthStore()
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [stats, setStats] = useState({ avgRating: 0, ratingCount: 0 })
  const [userRating, setUserRating] = useState<number | null>(null)
  /** True once a search is running or has results — collapses the hero. */
  const [isSearchActive, setIsSearchActive] = useState(false)

  // Tracks the id of the most recently requested item so async responses that
  // resolve after the user has moved on to a different item can be discarded.
  const requestedItemIdRef = useRef<string | null>(null)

  const handleSelectItem = useCallback(
    async (item: SearchResultItem) => {
      requestedItemIdRef.current = item.id

      setSelectedItem(item)
      setIsModalOpen(true)
      setStats({ avgRating: 0, ratingCount: 0 })
      setUserRating(null)

      // Search results carry no stats, so fetch them for just this item.
      const statsPromise = statsService.getItemStats(item.id)
      // Only fetch the signed-in user's existing rating; logged-out users have none.
      const ratingPromise = user
        ? ratingService.getUserRating(item.id)
        : Promise.resolve({ data: null, error: null })

      const [{ data: statsData }, { data: ratingData }] = await Promise.all([
        statsPromise,
        ratingPromise
      ])

      // Discard stale responses if the user has since selected another item.
      if (requestedItemIdRef.current !== item.id) return

      if (statsData) setStats(statsData)
      setUserRating(ratingData ? ratingData.rating : null)
    },
    [user]
  )

  const handleRatingChange = useCallback(
    async (rating: number) => {
      if (!selectedItem) return

      const itemId = selectedItem.id
      const previousRating = userRating

      setUserRating(rating)
      const { error } = await ratingService.upsertRating({
        item_id: itemId,
        rating
      })

      if (requestedItemIdRef.current !== itemId) return

      if (error) {
        setUserRating(previousRating)
        return
      }

      const { data } = await statsService.getItemStats(itemId)
      if (requestedItemIdRef.current !== itemId) return
      if (data) setStats(data)
    },
    [selectedItem, userRating]
  )

  const scrollToFaq = useCallback(() => {
    document.getElementById(FAQ_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <PageTransition>
      <SEO
        title="mytops - Search and Rate Movies, Books, Games & More"
        description="One search box for everything you like. Rate movies, series, books, anime, games and restaurants. If it's not in the database yet, AI finds it and adds it for everyone."
        url="/"
      />
      <WebSiteSchema />

      <TopicBands />

      <div className="mx-auto max-w-5xl px-4">
        <div className="relative">
          <button
            type="button"
            onClick={scrollToFaq}
            className="absolute left-0 top-0 -rotate-6 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            What the heck is this?
          </button>

          {/*
            Hero: fills the first viewport until a search runs, then shrinks so
            the results take over the space. Both the height and the tagline
            animate, which is what makes the input appear to travel upward.
          */}
          <motion.div
            className="flex flex-col justify-center"
            animate={{
              minHeight: isSearchActive ? '22vh' : '70vh',
              paddingTop: isSearchActive ? '4rem' : '0rem'
            }}
            initial={false}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="overflow-hidden text-center"
              animate={{
                opacity: isSearchActive ? 0 : 1,
                height: isSearchActive ? 0 : 'auto',
                marginBottom: isSearchActive ? 0 : '2rem'
              }}
              initial={false}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden={isSearchActive}
            >
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                Search anything. Movies, books, games, ramen shops.
              </p>
              <p className="mt-2 text-muted-foreground">
                If it&apos;s not here yet, AI finds it and adds it — for everyone.
              </p>
            </motion.div>

            <ItemSearch
              onSelectItem={handleSelectItem}
              onActiveChange={setIsSearchActive}
            />
          </motion.div>
        </div>

        <FaqSection />
      </div>

      <ItemDetailModal
        item={selectedItem}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        avgRating={stats.avgRating}
        ratingCount={stats.ratingCount}
        userRating={userRating}
        onRatingChange={handleRatingChange}
        isAuthenticated={Boolean(user)}
      />
    </PageTransition>
  )
}
