import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Topic } from '../types'

function TopicsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-10 w-10 rounded mb-3" />
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </div>
  )
}

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTopics() {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name')

      if (error) {
        setError(error.message)
      } else {
        setTopics(data || [])
      }
      setLoading(false)
    }

    fetchTopics()
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <TopicsSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-destructive mb-2 font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground italic mt-4">
            Honestly, I'm surprised it worked this long.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Topics</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Pick a category and start tracking your favorites.
      </p>

      {topics.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">No topics yet.</p>
          <p className="text-xs text-muted-foreground italic">
            The database is as empty as my design skills.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {topics.map((topic) => (
            <Link key={topic.id} to={`/topics/${topic.slug}`}>
              <Card className="p-5 hover:bg-accent/50 transition-colors h-full">
                <span className="text-3xl mb-2 block">{topic.icon}</span>
                <h2 className="font-medium text-sm">{topic.name}</h2>
                {topic.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {topic.description}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
