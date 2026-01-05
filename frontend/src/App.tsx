import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import { HomePage } from './pages/HomePage'
import { TopicsPage } from './pages/TopicsPage'
import { AuthCallback } from './pages/AuthCallback'

// Lazy load pages for code splitting and improved performance
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const TopicDetailPage = lazy(() => import('./pages/TopicDetailPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
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
        <Route
          path="topics/:slug"
          element={
            <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>}>
              <TopicDetailPage />
            </Suspense>
          }
        />

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
          <Route
            path="login"
            element={
              <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route
            path="register"
            element={
              <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>}>
                <RegisterPage />
              </Suspense>
            }
          />
        </Route>

        {/* Protected routes - require authentication */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="profile"
            element={
              <Suspense fallback={<div className="flex justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>}>
                <ProfilePage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
