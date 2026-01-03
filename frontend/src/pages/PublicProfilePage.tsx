import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { profileService, type ProfileWithRatings } from '../services/profileService'
import { StarRating } from '../components/StarRating'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { SEO, ProfileSchema } from '@/components/SEO'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/PageTransition'
import { Star, Calendar, ArrowLeft } from 'lucide-react'
import type { Item, Topic } from '../types'

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

function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const prefersReducedMotion = useReducedMotion()

  const [profile, setProfile] = useState<ProfileWithRatings | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('')

  // Group ratings by topic
  const ratingsByTopic = useMemo(() => {
    if (!profile?.ratings) return []

    const grouped: Record<string, RatingsByTopic> = {}

    for (const rating of profile.ratings) {
      const item = rating.item
      const topic = item?.topic

      if (!topic) continue

      if (!grouped[topic.id]) {
        grouped[topic.id] = { topic, ratings: [] }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { topic: _, ...itemWithoutTopic } = item
      grouped[topic.id].ratings.push({
        id: rating.id,
        rating: rating.rating,
        notes: rating.notes,
        item: itemWithoutTopic
      })
    }

    return Object.values(grouped).sort((a, b) => b.ratings.length - a.ratings.length)
  }, [profile?.ratings])

  // Get top rated items
  const topRated = useMemo(() => {
    if (!profile?.ratings) return []
    return profile.ratings.filter((r) => r.rating === 5).slice(0, 10)
  }, [profile?.ratings])

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

  // Get user initials for avatar
  const initials = useMemo(() => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase()
    }
    if (profile?.username) {
      return profile.username.slice(0, 2).toUpperCase()
    }
    return '?'
  }, [profile?.display_name, profile?.username])

  useEffect(() => {
    async function fetchProfile() {
      if (!username) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const { data, error } = await profileService.getProfileByUsername(username)

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(data)

      // Set first topic as active tab after data loads
      const ratings = data.ratings || []
      const grouped: Record<string, Topic> = {}
      for (const r of ratings) {
        const topic = r.item?.topic
        if (topic && !grouped[topic.id]) {
          grouped[topic.id] = topic
        }
      }
      const topicIds = Object.keys(grouped)
      if (topicIds.length > 0) {
        setActiveTab(topicIds[0])
      }

      setLoading(false)
    }

    fetchProfile()
  }, [username])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileSkeleton />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <PageTransition>
        <SEO
          title="Profile Not Found"
          description="This profile doesn't exist or is private."
          noindex
        />
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-2 font-medium">Profile not found</p>
            <p className="text-sm text-muted-foreground mb-4">
              This profile doesn't exist or is set to private.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Go home
              </Link>
            </Button>
          </Card>
        </div>
      </PageTransition>
    )
  }

  const displayName = profile.display_name || profile.username || 'Anonymous'

  return (
    <PageTransition>
      <SEO
        title={`@${profile.username}'s Favorites`}
        description={profile.bio || `${displayName}'s curated collection of favorites across movies, books, games, and more.`}
        url={`/@${profile.username}`}
        type="profile"
      />
      <ProfileSchema
        username={profile.username || ''}
        displayName={profile.display_name || undefined}
        bio={profile.bio || undefined}
        url={`/@${profile.username}`}
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
            <h1 className="text-xl font-bold truncate">{displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && (
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
        </motion.div>

        {/* Stats Grid */}
        {ratingsByTopic.length > 0 && (
          <FadeIn delay={0.1}>
            <Card className="p-4 mb-8">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                {ratingsByTopic.slice(0, 6).map(({ topic, ratings }) => (
                  <div key={topic.id}>
                    <span className="text-xl">{topic.icon}</span>
                    <p className="text-lg font-bold">{ratings.length}</p>
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
              No public ratings yet.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Check back later for updates.
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

export default PublicProfilePage
