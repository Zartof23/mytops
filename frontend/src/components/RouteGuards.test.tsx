import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRoute } from './RouteGuards'
import { useAuthStore } from '@/store/authStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<p>admin area</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAdmin: false, initialized: true, profileLoading: false })
  })

  it('renders the route for an admin', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAdmin: true, initialized: true, profileLoading: false })

    renderAt('/admin')

    expect(screen.getByText('admin area')).toBeInTheDocument()
  })

  it('waits instead of redirecting while a fresh sign-in profile loads', () => {
    // The regression this guards: initialized is already true after sign-in,
    // and isAdmin is still false until the profile lands.
    useAuthStore.setState({
      user: { id: 'u1' } as never, isAdmin: false, initialized: true, profileLoading: true
    })

    renderAt('/admin')

    expect(screen.queryByText('home')).not.toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })

  it('redirects a signed-in non-admin home', () => {
    useAuthStore.setState({ user: { id: 'u2' } as never, isAdmin: false, initialized: true, profileLoading: false })

    renderAt('/admin')

    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })

  it('redirects a signed-out visitor home', () => {
    renderAt('/admin')

    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('renders nothing rather than redirecting while auth is still initializing', () => {
    useAuthStore.setState({ user: null, isAdmin: false, initialized: false, profileLoading: false })

    renderAt('/admin')

    expect(screen.queryByText('home')).not.toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })
})
