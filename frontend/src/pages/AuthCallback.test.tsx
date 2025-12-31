import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/utils'
import userEvent from '@testing-library/user-event'
import { AuthCallback } from './AuthCallback'

// Mock react-router-dom
const mockNavigate = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams]
  }
})

// Mock Supabase
const mockGetSession = vi.fn()
let authStateCallback: ((event: string, session: unknown) => void) | null = null
const mockUnsubscribe = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        authStateCallback = callback
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe
            }
          }
        }
      }
    }
  }
}))

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    authStateCallback = null
  })

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      render(<AuthCallback />)

      expect(screen.getByText('Completing sign in...')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should show error when error param is in URL', () => {
      mockSearchParams = new URLSearchParams('error=access_denied&error_description=User cancelled')

      render(<AuthCallback />)

      expect(screen.getByText('Sign in failed')).toBeInTheDocument()
      expect(screen.getByText('User cancelled')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to login' })).toBeInTheDocument()
    })

    it('should show error code when no description provided', () => {
      mockSearchParams = new URLSearchParams('error=server_error')

      render(<AuthCallback />)

      expect(screen.getByText('server_error')).toBeInTheDocument()
    })
  })

  describe('session handling', () => {
    it('should navigate to home when session already exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } }
      })

      render(<AuthCallback />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should navigate to home when auth state changes to SIGNED_IN', async () => {
      render(<AuthCallback />)

      // Simulate auth state change
      if (authStateCallback) {
        authStateCallback('SIGNED_IN', { user: { id: 'user-1' } })
      }

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should not navigate on other auth events', () => {
      render(<AuthCallback />)

      // Simulate other auth events
      if (authStateCallback) {
        authStateCallback('TOKEN_REFRESHED', { user: { id: 'user-1' } })
        authStateCallback('USER_UPDATED', { user: { id: 'user-1' } })
      }

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe on unmount', () => {
      const { unmount } = render(<AuthCallback />)

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('back to login button', () => {
    it('should navigate to login when clicked', async () => {
      const user = userEvent.setup()
      mockSearchParams = new URLSearchParams('error=test_error')

      render(<AuthCallback />)

      const button = screen.getByRole('button', { name: 'Back to login' })
      await user.click(button)

      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })
})
