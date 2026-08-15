import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../test/utils'
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

function type(value: string) {
  fireEvent.change(screen.getByLabelText('Search everything'), { target: { value } })
}

/** Types a query and submits it the only way the UI allows: Enter. */
function search(value: string) {
  type(value)
  fireEvent.keyDown(screen.getByLabelText('Search everything'), { key: 'Enter' })
}

describe('ItemSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAuth({ id: 'u1' })
    vi.mocked(searchService.listTopics).mockResolvedValue({ data: topics as never, error: null })
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: results as never, error: null })
  })

  it('does not search while the user is only typing', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    type('dune')

    await waitFor(() => {
      expect(searchService.listTopics).toHaveBeenCalled()
    })
    expect(searchService.searchItems).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not search for queries shorter than the minimum', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('d')

    await waitFor(() => {
      expect(searchService.searchItems).not.toHaveBeenCalled()
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('searches on Enter and shows result cards grouped by topic', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('dune')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    expect(searchService.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dune', topicId: undefined })
    )
    const listbox = within(screen.getByRole('listbox'))
    expect(listbox.getByText('Books')).toBeInTheDocument()
    expect(listbox.getByText('Movies')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('reports its active state so the hero can collapse', async () => {
    const onActiveChange = vi.fn()
    render(<ItemSearch onSelectItem={vi.fn()} onActiveChange={onActiveChange} />)

    expect(onActiveChange).toHaveBeenLastCalledWith(false)

    search('dune')
    await waitFor(() => {
      expect(onActiveChange).toHaveBeenLastCalledWith(true)
    })
  })

  it('scopes the search when a topic chip is active', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))

    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))
    search('dune')

    await waitFor(() => {
      expect(searchService.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune', topicId: 't1' })
      )
    })
  })

  it('re-runs the submitted query when the scope changes', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))

    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    fireEvent.click(screen.getByRole('button', { name: 'Search Books only' }))

    await waitFor(() => {
      expect(searchService.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dune', topicId: 't2' })
      )
    })
  })

  it('calls onSelectItem when a result card is clicked', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    search('dune')

    await waitFor(() => screen.getByRole('listbox'))
    fireEvent.click(screen.getByRole('option', { name: /Dune \(2021\)/ }))

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('moves the highlight with arrow keys and selects with Enter', async () => {
    const onSelectItem = vi.fn()
    render(<ItemSearch onSelectItem={onSelectItem} />)
    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    const input = screen.getByLabelText('Search everything')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('clears the highlight on Escape but keeps the query and results', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    const input = screen.getByLabelText('Search everything')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(input).not.toHaveAttribute('aria-activedescendant')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(input).toHaveValue('dune')
  })

  it('prompts a logged-out user to log in when nothing matches', async () => {
    setAuth(null)
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('nope')

    await waitFor(() => {
      expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Log in/ })).toHaveAttribute('href', '/login')
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()
  })

  it('asks which topic it is when nothing matches an all-topics search', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('nope')

    await waitFor(() => {
      expect(screen.getByText(/Which topic is it/)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('enrichment-prompt')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to Books' }))
    expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Books')
  })

  it('exposes combobox attributes that track open state', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    const input = screen.getByLabelText('Search everything')
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
  })

  it('sets aria-activedescendant to the highlighted option and updates with arrow keys', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    const input = screen.getByLabelText('Search everything')
    expect(input).not.toHaveAttribute('aria-activedescendant')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id)
  })

  it('gives each topic section an accessible name', async () => {
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('dune')
    await waitFor(() => screen.getByRole('listbox'))

    const groups = within(screen.getByRole('listbox')).getAllByRole('group')
    const names = groups.map((group) =>
      document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent
    )
    expect(names.map((name) => name?.replace(/[^A-Za-z]/g, '')).sort()).toEqual([
      'Books',
      'Movies'
    ])
  })

  it('skips a result whose topic is missing rather than crashing', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({
      data: [...results, { id: 'i3', name: 'Broken', topic: null }] as never,
      error: null
    })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    search('dune')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByText('Broken')).not.toBeInTheDocument()
  })

  it('skips the topic question when a chip is already active', async () => {
    vi.mocked(searchService.searchItems).mockResolvedValue({ data: [], error: null })
    render(<ItemSearch onSelectItem={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: 'Search Movies only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search Movies only' }))

    search('nope')

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-prompt')).toHaveTextContent('Movies')
    })
    expect(screen.queryByText(/Which topic is it/)).not.toBeInTheDocument()
  })
})
