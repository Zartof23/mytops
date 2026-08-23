import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '../test/utils'
import userEvent from '@testing-library/user-event'
import { ProfilePage } from './ProfilePage'
import { supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { todoService } from '../services/todoService'
import type { Item, Topic, UserTodoItem } from '../types'

// Stable object identity: the page's fetch effect keys off `user`, so a fresh
// object per render would refetch on every render.
const mockAuthState = { user: { id: 'user-1', email: 'rober@test.io' } }

vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockAuthState
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() }
}))

vi.mock('../services/profileService', () => ({
  profileService: { getCurrentProfile: vi.fn() }
}))

vi.mock('../services/todoService', () => ({
  todoService: { getAllTodos: vi.fn(), removeFromTodo: vi.fn() }
}))

function makeTopic(id: string, name: string, icon: string): Topic {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    icon,
    image_url: null,
    schema_template: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }
}

function makeItem(id: string, name: string, topic: Topic, imageUrl: string | null = null) {
  return {
    id,
    topic_id: topic.id,
    name,
    slug: id,
    description: null,
    metadata: null,
    image_url: imageUrl,
    source: 'seed' as const,
    ai_confidence: null,
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    topic
  }
}

const movies = makeTopic('t-movies', 'Movies', '🎬')
const books = makeTopic('t-books', 'Books', '📚')

function makeRating(id: string, item: Item, rating: number, notes: string | null = null) {
  return {
    id,
    user_id: 'user-1',
    item_id: item.id,
    rating,
    notes,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    item
  }
}

function makeTodo(id: string, item: Item, topic: Topic): UserTodoItem {
  return {
    id,
    user_id: 'user-1',
    item_id: item.id,
    topic_id: topic.id,
    priority: 0,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    item,
    topic
  }
}

/** Mock the `.select().eq().order()` chain used for user_ratings. */
function mockRatings(data: unknown[], error: unknown = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data, error }))
  }
  vi.mocked(supabase.from).mockReturnValue(chain as never)
}

const dune = makeItem('i-dune', 'Dune', movies, 'https://img.test/dune.jpg')
const arrival = makeItem('i-arrival', 'Arrival', movies)
const piranesi = makeItem('i-piranesi', 'Piranesi', books)

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()

    vi.mocked(profileService.getCurrentProfile).mockResolvedValue({
      data: {
        id: 'user-1',
        username: 'rober',
        display_name: 'Rober',
        avatar_url: null,
        bio: 'Rates things.',
        is_public: true,
        is_admin: false,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      },
      error: null
    } as never)

    vi.mocked(todoService.getAllTodos).mockResolvedValue({
      data: new Map([
        ['t-movies', { topic: movies, items: [makeTodo('todo-1', arrival, movies)] }],
        ['t-books', { topic: books, items: [makeTodo('todo-2', piranesi, books)] }]
      ]),
      error: null
    } as never)

    vi.mocked(todoService.removeFromTodo).mockResolvedValue({ error: null } as never)

    mockRatings([
      makeRating('r-1', dune, 5, 'peak cinema'),
      makeRating('r-2', arrival, 4),
      makeRating('r-3', piranesi, 5)
    ])
  })

  it('renders the profile header with name, handle and totals', async () => {
    render(<ProfilePage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Rober' })).toBeInTheDocument()
    expect(screen.getByText('@rober')).toBeInTheDocument()
    expect(screen.getByText('Rates things.')).toBeInTheDocument()
    expect(screen.getByText('3 ratings')).toBeInTheDocument()
  })

  it('shows item images in the ratings list and falls back to the topic emoji', async () => {
    render(<ProfilePage />)

    // Dune shows up twice: once in Top Rated, once in the Movies ratings list
    const duneImages = await screen.findAllByAltText('Dune')
    expect(duneImages).toHaveLength(2)
    duneImages.forEach((img) =>
      expect(img).toHaveAttribute('src', 'https://img.test/dune.jpg')
    )
    // Arrival has no image anywhere, so it gets the emoji placeholder
    expect(screen.getAllByTestId('rating-row-fallback').length).toBeGreaterThan(0)
  })

  it('renders each topic stat as a button that switches the ratings tab', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)

    const booksStat = await screen.findByRole('button', {
      name: /Show your 1 Books ratings/i
    })
    await user.click(booksStat)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Books/ })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('renders Watch Later with topic filter pills', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)

    expect(await screen.findByRole('button', { name: /All, 2 items/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Books, 1 items/ }))

    // Scope to Watch Later: both items also appear in Top Rated / the ratings list
    const watchLater = within(screen.getByRole('region', { name: /Watch Later/ }))
    expect(watchLater.getByText('Piranesi')).toBeInTheDocument()
    expect(watchLater.queryByText('Arrival')).not.toBeInTheDocument()
  })

  it('removes a todo optimistically and drops the emptied topic pill', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)

    await user.click(
      await screen.findByRole('button', { name: /Remove Piranesi from watch later/i })
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Books, 1 items/ })
      ).not.toBeInTheDocument()
    })
    expect(todoService.removeFromTodo).toHaveBeenCalledWith('i-piranesi')
  })

  it('shows the empty state when there are no ratings', async () => {
    mockRatings([])
    render(<ProfilePage />)

    expect(
      await screen.findByText("You haven't rated anything yet.")
    ).toBeInTheDocument()
  })
})
