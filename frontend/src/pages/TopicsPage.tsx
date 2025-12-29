import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Topic } from '../types'

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
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading topics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-2">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground italic mt-4">
          Honestly, I'm surprised it worked this long.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Topics</h1>
      <p className="text-muted-foreground mb-8">
        Pick a category and start tracking your favorites.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            to={`/topics/${topic.slug}`}
            className="block p-6 border rounded-lg hover:bg-accent transition-colors"
          >
            <span className="text-4xl mb-2 block">{topic.icon}</span>
            <h2 className="font-semibold">{topic.name}</h2>
            {topic.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {topic.description}
              </p>
            )}
          </Link>
        ))}
      </div>

      {topics.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No topics yet.</p>
          <p className="text-sm italic mt-2">
            The database is as empty as my design skills.
          </p>
        </div>
      )}
    </div>
  )
}
