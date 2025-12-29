import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function HomePage() {
  const { user } = useAuthStore()

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <h1 className="text-4xl font-bold mb-4">mytops</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Track your favorite things. Share them with the world.
      </p>

      <div className="bg-card border rounded-lg p-6 mb-8 text-left">
        <h2 className="font-semibold mb-2">How it works:</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Browse topics (movies, books, games, etc.)</li>
          <li>Search for anything — if it doesn't exist, AI creates it</li>
          <li>Rate it 1-5 stars to add it to your collection</li>
          <li>Your profile shows all your favorites</li>
        </ol>
      </div>

      <div className="flex gap-4 justify-center">
        <Link
          to="/topics"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Browse Topics
        </Link>
        {!user && (
          <Link
            to="/register"
            className="px-6 py-3 border rounded-md hover:bg-accent transition-colors"
          >
            Create Account
          </Link>
        )}
      </div>

      <p className="mt-12 text-sm text-muted-foreground italic">
        "I built this because I wanted to track my favorite anime and couldn't find anything simple enough."
      </p>
    </div>
  )
}
