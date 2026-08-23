import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  }
}))

const mockProfileQuery = (profile: unknown) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  vi.mocked(supabase.from).mockReturnValue({ select } as never)
}

const sessionWith = (userId: string) => ({
  data: {
    session: {
      user: { id: userId, email: 'a@b.c', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' },
      access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer'
    }
  },
  error: null
})

describe('authStore isAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, profile: null, isAdmin: false, initialized: false })
  })

  it('sets isAdmin true when the profile is flagged admin', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u1') as never)
    mockProfileQuery({ id: 'u1', is_admin: true, is_public: true })

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(true)
    expect(useAuthStore.getState().profile?.id).toBe('u1')
  })

  it('leaves isAdmin false for a normal profile', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u2') as never)
    mockProfileQuery({ id: 'u2', is_admin: false, is_public: true })

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(false)
  })

  it('leaves isAdmin false when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().isAdmin).toBe(false)
    expect(useAuthStore.getState().profile).toBeNull()
  })

  it('holds profileLoading true until a signed-in profile resolves', async () => {
    let resolveProfile: (v: unknown) => void = () => {}
    const maybeSingle = vi.fn(() => new Promise((r) => { resolveProfile = r }))
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    vi.mocked(supabase.from).mockReturnValue({ select } as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue(sessionWith('u1') as never)

    const done = useAuthStore.getState().initialize()
    await Promise.resolve()
    expect(useAuthStore.getState().profileLoading).toBe(true)

    resolveProfile({ data: { id: 'u1', is_admin: true }, error: null })
    await done

    expect(useAuthStore.getState().profileLoading).toBe(false)
    expect(useAuthStore.getState().isAdmin).toBe(true)
  })

  it('leaves profileLoading false when there is no session to load', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().profileLoading).toBe(false)
  })

  it('clears profile and isAdmin on sign out', async () => {
    useAuthStore.setState({ profile: { id: 'u1', is_admin: true } as never, isAdmin: true })

    await useAuthStore.getState().signOut()

    expect(useAuthStore.getState().isAdmin).toBe(false)
    expect(useAuthStore.getState().profile).toBeNull()
  })
})
