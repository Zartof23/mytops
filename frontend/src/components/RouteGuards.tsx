import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * Protects routes that require authentication.
 * Redirects to /login if user is not authenticated.
 */
export function ProtectedRoute() {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return null // App.tsx handles the loading state
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

/**
 * Protects routes that should only be accessible to unauthenticated users.
 * Redirects to / if user is already authenticated.
 */
export function PublicOnlyRoute() {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return null // App.tsx handles the loading state
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
