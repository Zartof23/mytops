import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { StarRating } from '../components/StarRating'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/SEO'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/PageTransition'
import { Share2, Star, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { Item, Topic, Profile } from '../types'

interface RatingWithItem {
  id: string
  user_id: string
  item_id: string
  rating: number
  notes: string | null
  created_at: string
  updated_at: string
  item: Item & { topic: Topic }
}

interface RatingsByTopic {
  topic: Topic
  ratings: Array<{
    id: string
    rating: number
    notes: string | null
    item: Item
  }>
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}

function CountUp({ value, duration = 1 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) {
      setCount(value)
      return
    }

    let start = 0
    const end = value
    const increment = end / (duration * 60) // 60fps
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 1000 / 60)

    return () => clearInterval(timer)
  }, [value, duration, prefersReducedMotion])

  return <span>{count}</span>
}

export function ProfilePage() {
  const { user } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ratingsByTopic, setRatingsByTopic] = useState<RatingsByTopic[]>([])
  const [topRated, setTopRated] = useState<RatingWithItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('')

  // Calculate total ratings
  const totalRatings = useMemo(
    () => ratingsByTopic.reduce((acc, { ratings }) => acc + ratings.length, 0),
    [ratingsByTopic]
  )

  // Format join date
  const joinDate = useMemo(() => {
    if (!profile?.created_at) return ''
    return new Date(profile.created_at).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    })
  }, [profile?.created_at])

  useEffect(() => {
    if (!user) return

    const abortController = new AbortController()

    async function fetchData() {
      if (!user) return

      try {
        // Fetch profile and ratings in parallel
        const [profileResult, ratingsResult] = await Promise.all([
          profileService.getCurrentProfile(),
          supabase
            .from('user_ratings')
            .select(`
              *,
              item:items (
                *,
                topic:topics (*)
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
        ])

        if (abortController.signal.aborted) return

        // Set profile
        if (profileResult.data) {
          setProfile(profileResult.data)
        }

        // Handle ratings
        if (ratingsResult.error) {
          console.error('Error fetching ratings:', ratingsResult.error)
          setLoading(false)
          return
        }

        const ratings = (ratingsResult.data || []) as RatingWithItem[]

        // Get top rated (5 stars)
        const topRatedItems = ratings
          .filter((r) => r.rating === 5)
          .slice(0, 10)
        setTopRated(topRatedItems)

        // Group ratings by topic
        const grouped: Record<string, RatingsByTopic> = {}

        for (const rating of ratings) {
          const item = rating.item
          const topic = item?.topic

          if (!topic) continue

          if (!grouped[topic.id]) {
            grouped[topic.id] = { topic, ratings: [] }
          }

          // Remove topic from item to avoid duplication
          const { topic: _omitted, ...itemWithoutTopic } = item
          grouped[topic.id].ratings.push({
            id: rating.id,
            rating: rating.rating,
            notes: rating.notes,
            item: itemWithoutTopic
          })
        }

        const groupedArray = Object.values(grouped).sort(
          (a, b) => b.ratings.length - a.ratings.length
        )

        setRatingsByTopic(groupedArray)

        // Set first topic as active tab (only if not already set)
        if (groupedArray.length > 0 && !activeTab) {
          setActiveTab(groupedArray[0].topic.id)
        }

        setLoading(false)
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching profile data:', err)
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      abortController.abort()
    }
  }, [user])

  const handleShare = useCallback(async () => {
    if (!profile?.username) {
      toast.error("Set a username first to share your profile.")
      return
    }

    const url = `${window.location.origin}/@${profile.username}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Profile link copied!")
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      toast.error("Couldn't copy link. Try selecting and copying manually.")
    }
  }, [profile?.username])

  // Get user initials for avatar
  const initials = useMemo(() => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return '?'
  }, [profile?.display_name, user?.email])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto" role="status" aria-live="polite">
        <ProfileSkeleton />
        <span className="sr-only">Loading profile...</span>
      </div>
    )
  }

  return (
    <PageTransition>
      <SEO
        title="Your Profile"
        description="Your personal collection of favorites across movies, books, games, and more."
        url="/profile"
        noindex // Private profile shouldn't be indexed
      />

      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <motion.div
          className="flex items-start gap-4 mb-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">
              {profile?.display_name || user?.email?.split('@')[0] || 'Anonymous'}
            </h1>
            {profile?.username && (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {profile.bio}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined {joinDate}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {totalRatings} ratings
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </motion.div>

        {/* Stats Grid */}
        {ratingsByTopic.length > 0 && (
          <FadeIn delay={0.1}>
            <Card className="p-4 mb-8">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                {ratingsByTopic.slice(0, 6).map(({ topic, ratings }) => (
                  <div key={topic.id}>
                    <span className="text-xl">{topic.icon}</span>
                    <p className="text-lg font-bold">
                      <CountUp value={ratings.length} />
                    </p>
                    <p className="text-xs text-muted-foreground">{topic.name}</p>
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>
        )}

        {/* Top Rated Section */}
        {topRated.length > 0 && (
          <FadeIn delay={0.2}>
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 fill-foreground" />
                Top Rated
                <Badge variant="secondary" className="text-xs">
                  {topRated.length}
                </Badge>
              </h2>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-4">
                  {topRated.map((rating) => (
                    <Card
                      key={rating.id}
                      className="inline-flex flex-col items-center p-4 min-w-[120px]"
                    >
                      <span className="text-lg mb-1">
                        {rating.item.topic?.icon || '📦'}
                      </span>
                      <p className="text-xs font-medium text-center truncate max-w-[100px]">
                        {rating.item.name}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className="h-3 w-3 fill-foreground text-foreground"
                          />
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </FadeIn>
        )}

        {/* Tabbed Content */}
        {ratingsByTopic.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-2">
              You haven't rated anything yet.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Go find something you love and give it some stars.
            </p>
          </Card>
        ) : (
          <FadeIn delay={0.3}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-transparent p-0">
                {ratingsByTopic.map(({ topic, ratings }) => (
                  <TabsTrigger
                    key={topic.id}
                    value={topic.id}
                    className="data-[state=active]:bg-accent"
                  >
                    <span className="mr-1">{topic.icon}</span>
                    {topic.name}
                    <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                      {ratings.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {ratingsByTopic.map(({ topic, ratings }) => (
                <TabsContent key={topic.id} value={topic.id}>
                  <StaggerContainer className="space-y-2">
                    {ratings.map((rating) => (
                      <StaggerItem key={rating.id}>
                        <Card className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {rating.item?.name}
                            </p>
                            {rating.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {rating.notes}
                              </p>
                            )}
                          </div>
                          <StarRating value={rating.rating} readOnly size="sm" />
                        </Card>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </TabsContent>
              ))}
            </Tabs>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  )
}
