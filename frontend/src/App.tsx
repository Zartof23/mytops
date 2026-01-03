import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { TopicsPage } from './pages/TopicsPage'
import { TopicDetailPage } from './pages/TopicDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { AuthCallback } from './pages/AuthCallback'

// Lazy load public profile page for code splitting
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))

function App() {
  const { initialize, cleanup, initialized } = useAuthStore()

  useEffect(() => {
    initialize()
    return () => cleanup()
  }, [initialize, cleanup])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public routes */}
        <Route index element={<HomePage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="topics/:slug" element={<TopicDetailPage />} />

        {/* Public profile route - /@username style */}
        <Route
          path="@:username"
          element={
            <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading profile...</p></div>}>
              <PublicProfilePage />
            </Suspense>
          }
        />

        {/* Auth routes - redirect to home if already logged in */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        {/* Protected routes - require authentication */}
        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
