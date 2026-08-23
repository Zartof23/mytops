import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session, Subscription } from '@supabase/supabase-js'
import type { Profile } from '../types'

type OAuthProvider = 'google' | 'github'

// Store subscription outside of Zustand to avoid serialization issues
let authSubscription: Subscription | null = null

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile:', error)
    return null
  }
  return (data as Profile) ?? null
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  profileLoading: boolean
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
  profile: null,
  isAdmin: false,
  profileLoading: false,
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
      const user = session?.user ?? null
      set({ profileLoading: !!user })
      const profile = user ? await fetchProfile(user.id) : null
      set({
        session,
        user,
        profile,
        isAdmin: profile?.is_admin ?? false,
        profileLoading: false,
        initialized: true
      })

      // Listen for auth changes and store the subscription
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null
        set({ session, user: nextUser })
        if (!nextUser) {
          set({ profile: null, isAdmin: false, profileLoading: false })
          return
        }
        // Not awaited: awaiting inside this callback deadlocks the client.
        // profileLoading covers the gap so AdminRoute doesn't redirect early.
        set({ profileLoading: true })
        void fetchProfile(nextUser.id).then((profile) => {
          set({ profile, isAdmin: profile?.is_admin ?? false, profileLoading: false })
        })
      })
      authSubscription = subscription
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ initialized: true, profileLoading: false })
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
    set({ user: null, session: null, profile: null, isAdmin: false, profileLoading: false })
  },
}))
