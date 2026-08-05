import { useCallback } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Linkedin, Globe } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ThemeToggle } from './ThemeToggle'
import { GitHubStarBadge } from './GitHubStarBadge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Main application layout with header, navigation, and footer.
 *
 * Features:
 * - Skip to main content link for accessibility
 * - Responsive navigation
 * - Theme toggle
 * - Toast notifications
 */
export function Layout() {
  const { user, signOut } = useAuthStore()

  const handleSignOut = useCallback(async () => {
    await signOut()
  }, [signOut])

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:border focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-bold tracking-tight">
              mytops
            </Link>
            <GitHubStarBadge />
          </div>

          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/topics">Topics</Link>
            </Button>

            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/profile">Profile</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Sign up</Link>
                </Button>
              </>
            )}

            <Separator orientation="vertical" className="mx-2 h-4" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="container mx-auto px-4 py-8 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-3 text-center text-xs text-muted-foreground">
          <p>Built by a backend dev who doesn't usually do frontend.</p>
          <div className="flex items-center gap-2">
            <a
              href="https://robertocalo.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Roberto Calo's personal website"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              robertocalo.me
            </a>
            <a
              href="https://www.linkedin.com/in/roberto-calo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Roberto Calo on LinkedIn"
            >
              <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
    </TooltipProvider>
  )
}
