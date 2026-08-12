import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { statsService } from '../services/statsService'
import { ratingService } from '../services/ratingService'
import { ItemSearch } from '../components/ItemSearch'
import { FaqSection, FAQ_ANCHOR_ID } from '../components/FaqSection'
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

  const handleSelectItem = useCallback(async (item: SearchResultItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
    setStats({ avgRating: 0, ratingCount: 0 })
    setUserRating(null)

    // Search results carry no stats, so fetch them for just this item.
    const { data } = await statsService.getItemStats(item.id)
    if (data) setStats(data)
  }, [])

  const handleRatingChange = useCallback(
    async (rating: number) => {
      if (!selectedItem) return

      setUserRating(rating)
      const { error } = await ratingService.upsertRating({
        item_id: selectedItem.id,
        rating
      })
      if (error) {
        setUserRating(null)
        return
      }

      const { data } = await statsService.getItemStats(selectedItem.id)
      if (data) setStats(data)
    },
    [selectedItem]
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

      <div className="mx-auto max-w-3xl px-4">
        {/* Hero: tagline + search, sized to fill the first viewport */}
        <div className="relative flex min-h-[70vh] flex-col justify-center">
          <motion.div
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">
              Search anything. Movies, books, games, ramen shops.
            </p>
            <p className="mt-2 text-muted-foreground">
              If it&apos;s not here yet, AI finds it and adds it — for everyone.
            </p>
          </motion.div>

          <ItemSearch onSelectItem={handleSelectItem} />

          <button
            type="button"
            onClick={scrollToFaq}
            className="absolute bottom-0 right-0 -rotate-6 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            What the heck is this?
          </button>
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
