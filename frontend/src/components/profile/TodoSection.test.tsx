import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { TodoSection } from './TodoSection'
import type { Item, Topic, UserTodoItem } from '../../types'

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

function makeItem(id: string, name: string, topicId: string): Item {
  return {
    id,
    topic_id: topicId,
    name,
    slug: id,
    description: null,
    metadata: null,
    image_url: null,
    source: 'seed',
    ai_confidence: null,
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
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

const movies = makeTopic('t-movies', 'Movies', '🎬')
const books = makeTopic('t-books', 'Books', '📚')

const groups = [
  {
    topic: movies,
    items: [
      makeTodo('todo-1', makeItem('i-1', 'Dune', movies.id), movies),
      makeTodo('todo-2', makeItem('i-2', 'Arrival', movies.id), movies)
    ]
  },
  {
    topic: books,
    items: [makeTodo('todo-3', makeItem('i-3', 'Piranesi', books.id), books)]
  }
]

describe('TodoSection', () => {
  it('renders nothing when there are no todos', () => {
    const { container } = render(<TodoSection groups={[]} onRemove={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows an All pill with the total plus one pill per topic', () => {
    render(<TodoSection groups={groups} onRemove={vi.fn()} />)

    expect(screen.getByRole('button', { name: /All, 3 items/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Movies, 2 items/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Books, 1 items/ })).toBeInTheDocument()
  })

  it('shows every item across topics by default', () => {
    render(<TodoSection groups={groups} onRemove={vi.fn()} />)

    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Arrival')).toBeInTheDocument()
    expect(screen.getByText('Piranesi')).toBeInTheDocument()
  })

  it('filters to a single topic when its pill is clicked', async () => {
    const user = userEvent.setup()
    render(<TodoSection groups={groups} onRemove={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Books, 1 items/ }))

    expect(screen.getByText('Piranesi')).toBeInTheDocument()
    expect(screen.queryByText('Dune')).not.toBeInTheDocument()
    expect(screen.queryByText('Arrival')).not.toBeInTheDocument()
  })

  it('marks the active pill as pressed', async () => {
    const user = userEvent.setup()
    render(<TodoSection groups={groups} onRemove={vi.fn()} />)

    const allPill = screen.getByRole('button', { name: /All, 3 items/ })
    const booksPill = screen.getByRole('button', { name: /Books, 1 items/ })
    expect(allPill).toHaveAttribute('aria-pressed', 'true')

    await user.click(booksPill)

    expect(booksPill).toHaveAttribute('aria-pressed', 'true')
    expect(allPill).toHaveAttribute('aria-pressed', 'false')
  })

  it('returns to all items when the All pill is clicked again', async () => {
    const user = userEvent.setup()
    render(<TodoSection groups={groups} onRemove={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Books, 1 items/ }))
    await user.click(screen.getByRole('button', { name: /All, 3 items/ }))

    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Piranesi')).toBeInTheDocument()
  })

  it('calls onRemove with the item id', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(<TodoSection groups={groups} onRemove={onRemove} />)

    await user.click(
      screen.getByRole('button', { name: /Remove Dune from watch later/i })
    )

    expect(onRemove).toHaveBeenCalledWith('i-1')
  })
})
