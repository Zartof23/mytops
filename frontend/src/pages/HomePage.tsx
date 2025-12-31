import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function HomePage() {
  const { user } = useAuthStore()

  return (
    <div className="max-w-xl mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">mytops</h1>
        <p className="text-muted-foreground">
          Track your favorite things. Share them with the world.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex gap-3">
            <span className="text-foreground font-mono">1.</span>
            <span>Browse topics (movies, books, games, etc.)</span>
          </div>
          <div className="flex gap-3">
            <span className="text-foreground font-mono">2.</span>
            <span>Search for anything — if it doesn't exist, AI creates it</span>
          </div>
          <div className="flex gap-3">
            <span className="text-foreground font-mono">3.</span>
            <span>Rate it 1-5 stars to add it to your collection</span>
          </div>
          <div className="flex gap-3">
            <span className="text-foreground font-mono">4.</span>
            <span>Your profile shows all your favorites</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-center">
        <Button asChild>
          <Link to="/topics">Browse Topics</Link>
        </Button>
        {!user && (
          <Button variant="outline" asChild>
            <Link to="/register">Create Account</Link>
          </Button>
        )}
      </div>

      <Separator className="my-8" />

      <p className="text-center text-xs text-muted-foreground italic">
        "I built this because I wanted to track my favorite anime and couldn't find anything simple enough."
      </p>
    </div>
  )
}
