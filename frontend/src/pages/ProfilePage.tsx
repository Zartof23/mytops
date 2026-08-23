import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { todoService } from '../services/todoService'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SEO } from '@/components/SEO'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/PageTransition'
import { ItemPosterCard } from '@/components/ItemPosterCard'
import { TodoSection, type TodoGroup } from '@/components/profile/TodoSection'
import { RatingRow } from '@/components/profile/RatingRow'
import { Share2, Star, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { Item, Topic, Profile } from '@/types'

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
  const [todoGroups, setTodoGroups] = useState<TodoGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('')
  const ratingsRef = useRef<HTMLDivElement>(null)

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
        // Fetch profile, ratings, and TODO list in parallel
        const [profileResult, ratingsResult, todosResult] = await Promise.all([
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
            .order('created_at', { ascending: false }),
          todoService.getAllTodos()
        ])

        if (abortController.signal.aborted) return

        // Set profile
        if (profileResult.data) {
          setProfile(profileResult.data)
        }

        // Keep the TODO list grouped by topic - the filter pills navigate it
        if (todosResult.data) {
          setTodoGroups(Array.from(todosResult.data.values()))
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

        // Set first topic as active tab (functional update keeps a user's
        // choice if they clicked a stat before the fetch resolved)
        if (groupedArray.length > 0) {
          setActiveTab((current) => current || groupedArray[0].topic.id)
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

  const handleRemoveTodo = useCallback(async (itemId: string) => {
    let previous: TodoGroup[] = []
    setTodoGroups((prev) => {
      previous = prev
      return prev
        .map((group) => ({
          ...group,
          items: group.items.filter((todo) => todo.item_id !== itemId)
        }))
        .filter((group) => group.items.length > 0)
    })

    const { error } = await todoService.removeFromTodo(itemId)
    if (error) {
      setTodoGroups(previous)
      toast.error("Couldn't remove from list.")
    } else {
      toast.success('Removed from your list.')
    }
  }, [])

  // Jump from a topic stat down to that topic's ratings
  const handleTopicStatClick = useCallback((topicId: string) => {
    setActiveTab(topicId)
    ratingsRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    })
  }, [prefersReducedMotion])

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
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <Card className="p-4">
            <div className="flex items-start gap-4">
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
              </div>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>

            <Separator className="my-3" />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined {joinDate}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {totalRatings} ratings
              </span>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid - each topic jumps to its ratings tab */}
        {ratingsByTopic.length > 0 && (
          <FadeIn delay={0.1}>
            <Card className="p-4 mb-8">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {ratingsByTopic.slice(0, 6).map(({ topic, ratings }) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicStatClick(topic.id)}
                    aria-label={`Show your ${ratings.length} ${topic.name} ratings`}
                    className="rounded-md p-2 text-center transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="text-xl" aria-hidden="true">{topic.icon}</span>
                    <p className="text-lg font-bold">
                      <CountUp value={ratings.length} />
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{topic.name}</p>
                  </button>
                ))}
              </div>
            </Card>
          </FadeIn>
        )}

        {/* Top Rated Section */}
        {topRated.length > 0 && (
          <FadeIn delay={0.2}>
            <section className="mb-8" aria-labelledby="top-rated-heading">
              <h2
                id="top-rated-heading"
                className="text-sm font-medium mb-3 flex items-center gap-2"
              >
                <Star className="h-4 w-4 fill-foreground" />
                Top Rated
                <Badge variant="secondary" className="text-xs">
                  {topRated.length}
                </Badge>
              </h2>
              <ScrollArea className="w-full">
                <div className="flex gap-3 pb-4">
                  {topRated.map((rating) => (
                    <ItemPosterCard
                      key={rating.id}
                      item={rating.item}
                      topic={rating.item.topic}
                      className="w-[120px] shrink-0"
                      footer={
                        <div className="flex gap-0.5" aria-label="Rated 5 out of 5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className="h-3 w-3 fill-foreground text-foreground"
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                      }
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          </FadeIn>
        )}

        {/* Watch Later - topic pills + poster grid */}
        <FadeIn delay={0.25}>
          <TodoSection groups={todoGroups} onRemove={handleRemoveTodo} />
        </FadeIn>

        {/* Ratings by topic */}
        <div ref={ratingsRef} className="scroll-mt-4">
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
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Your Ratings
                <Badge variant="secondary" className="text-xs">
                  {totalRatings}
                </Badge>
              </h2>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-transparent p-0">
                  {ratingsByTopic.map(({ topic, ratings }) => (
                    <TabsTrigger
                      key={topic.id}
                      value={topic.id}
                      className="data-[state=active]:bg-accent"
                    >
                      <span className="mr-1" aria-hidden="true">{topic.icon}</span>
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
                          <RatingRow
                            item={rating.item}
                            topic={topic}
                            rating={rating.rating}
                            notes={rating.notes}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </TabsContent>
                ))}
              </Tabs>
            </FadeIn>
          )}
        </div>
      </div>
    </PageTransition>
  )
}

export default ProfilePage
