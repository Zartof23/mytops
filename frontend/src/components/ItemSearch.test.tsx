import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/utils'
import { ItemSearch } from './ItemSearch'
import { searchService } from '../services/searchService'
import { useAuthStore } from '../store/authStore'

vi.mock('../services/searchService', () => ({
  MIN_QUERY_LENGTH: 2,
  searchService: {
    searchItems: vi.fn(),
    listTopics: vi.fn()
  }
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
}))

vi.mock('./EnrichmentPrompt', () => ({
  EnrichmentPrompt: ({ topicName }: { topicName: string }) => (
    <div data-testid="enrichment-prompt">{topicName}</div>
  )
}))

const topics = [
  { id: 't1', name: 'Movies', slug: 'movies', icon: '🎬' },
  { id: 't2', name: 'Books', slug: 'books', icon: '📚' }
]

const results = [
  { id: 'i1', name: 'Dune', topic: topics[1] },
  { id: 'i2', name: 'Dune (2021)', topic: topics[0] }
]

function setAuth(user: { id: string } | null) {
  vi.mocked(useAuthStore).mockReturnValue({ user } as never)
}

async function type(value: string) {
  fireEvent.change(screen.getByLabelText('Search everything'), { target: { value } })
}

describe('ItemSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setAuth({ id: 'u1' })
    vi.mocked(searchService.listTopics).mockResolvedValue({ data: topics as never, error: null })
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: results as never, error: null })
  })

  it('does not search for queries shorter than the minimum', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('d')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(searchService.searchItems).not.toHaveBeenCalled()
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('searches after the debounce and shows results grouped by topic', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    expect(searchService.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dune', topicId: undefined })
    )
    expect(screen.getByText('Books')).toBeInTheDocument()
    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('scopes the search when a topic chip is active', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))

    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(searchService.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune', topicId: 't1' })
      )
    })
  })

  it('calls onSelectItem when a result is clicked', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    await type('dune')
    vi.advanceTimersByTime(400)

    await waitFor(() => screen.getByRole('listbox'))
    fireEvent.click(screen.getByRole('option', { name: /Dune \(2021\)/ }))

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('moves the highlight with arrow keys and selects with Enter', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    await type('dune')
    vi.advanceTimersByTime(400)
    await waitFor(() => screen.getByRole('listbox'))

    const input = screen.getByLabelText('Search everything')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('closes the dropdown on Escape but keeps the query', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('dune')
    vi.advanceTimersByTime(400)
    await waitFor(() => screen.getByRole('listbox'))

    fireEvent.keyDown(screen.getByLabelText('Search everything'), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search everything')).toHaveValue('dune')
  })

  it('prompts a logged-out user to log in when nothing matches', async () => {
    setAuth(null)
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Log in/ })).toHaveAttribute('href', '/login')
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()
  })

  it('asks which topic it is when nothing matches an all-topics search', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByText(/Which topic is it/)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to Books' }))
    expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Books')
  })

  it('skips the topic question when a chip is already active', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))

    await type('nope')
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Movies')
    })
    expect(screen.queryByText(/Which topic is it/)).not.toBeInTheDocument()
  })
})
