import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session, Subscription } from '@supabase/supabase-js'

type OAuthProvider = 'google' | 'github'

// Store subscription outside of Zustand to avoid serialization issues
let authSubscription: Subscription | null = null

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  oauthLoading: OAuthProvider | null
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithGithub: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  cleanup: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: false,
  oauthLoading: null,
  initialized: false,

  initialize: async () => {
    // Clean up any existing subscription before creating a new one
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({
        session,
        user: session?.user ?? null,
        initialized: true
      })

      // Listen for auth changes and store the subscription
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null })
      })
      authSubscription = subscription
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ initialized: true })
    }
  },

  cleanup: () => {
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false })
    return { error }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true })
    const { error } = await supabase.auth.signUp({ email, password })
    set({ loading: false })
    return { error }
  },

  signInWithGoogle: async () => {
    set({ oauthLoading: 'google' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      set({ oauthLoading: null })
    }
    return { error }
  },

  signInWithGithub: async () => {
    set({ oauthLoading: 'github' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      set({ oauthLoading: null })
    }
    return { error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },
}))
