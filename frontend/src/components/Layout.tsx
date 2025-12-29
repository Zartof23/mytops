import { Outlet, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ThemeToggle } from './ThemeToggle'

export function Layout() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            mytops
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/topics"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Topics
            </Link>

            {user ? (
              <>
                <Link
                  to="/profile"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}

            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Built by a backend dev who doesn't usually do frontend.</p>
        </div>
      </footer>
    </div>
  )
}
