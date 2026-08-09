import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../test/utils'
import { SearchInput } from './SearchInput'
import type { Topic } from '@/types'

const topics = [
  { id: 't1', name: 'Movies', slug: 'movies', icon: '🎬' },
  { id: 't2', name: 'Books', slug: 'books', icon: '📚' }
] as Topic[]

describe('SearchInput', () => {
  it('renders as a controlled input', () => {
    render(
      <SearchInput
        value="dune"
        onChange={vi.fn()}
        placeholder="search anything..."
        ariaLabel="Search everything"
      />
    )

    expect(screen.getByLabelText('Search everything')).toHaveValue('dune')
  })

  it('calls onChange with the new value', () => {
    const onChange = vi.fn()
    render(
      <SearchInput
        value=""
        onChange={onChange}
        placeholder="search anything..."
        ariaLabel="Search everything"
      />
    )

    fireEvent.change(screen.getByLabelText('Search everything'), {
      target: { value: 'akira' }
    })

    expect(onChange).toHaveBeenCalledWith('akira')
  })

  it('shows a busy status only while searching', () => {
    const { rerender } = render(
      <SearchInput value="d" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <SearchInput value="d" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" isSearching />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders no chip row when topics are omitted', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="p" ariaLabel="Search everything" />)

    expect(screen.queryByRole('group', { name: 'Search scope' })).not.toBeInTheDocument()
  })

  it('renders an "All" chip plus one per topic', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId={null}
        onTopicChange={vi.fn()}
      />
    )

    const group = screen.getByRole('group', { name: 'Search scope' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search all topics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search Movies only' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search Books only' })).toBeInTheDocument()
  })

  it('marks the active chip as pressed', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId="t1"
        onTopicChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Search Movies only' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Search all topics' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('reports null when the All chip is picked and the id otherwise', () => {
    const onTopicChange = vi.fn()
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="p"
        ariaLabel="Search everything"
        topics={topics}
        activeTopicId="t1"
        onTopicChange={onTopicChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search all topics' }))
    expect(onTopicChange).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Search Books only' }))
    expect(onTopicChange).toHaveBeenCalledWith('t2')
  })
})
