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

/**
 * Protects admin-only routes.
 *
 * This is a UX guard, not a security control — every admin operation is
 * enforced by RLS and by the admin RPCs. A user who forces this route sees
 * an empty page, not data.
 */
export function AdminRoute() {
  const { isAdmin, initialized, profileLoading } = useAuthStore()

  // profileLoading matters on fresh sign-in, where initialized is already
  // true but isAdmin has not resolved yet. Redirecting here would bounce an
  // admin off their own page until they reloaded.
  if (!initialized || profileLoading) {
    return null // App.tsx handles the loading state
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
