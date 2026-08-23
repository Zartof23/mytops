import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/utils'
import userEvent from '@testing-library/user-event'
import { ItemPosterCard } from './ItemPosterCard'
import type { Item, Topic } from '../types'

const topic: Topic = {
  id: 'topic-1',
  name: 'Movies',
  slug: 'movies',
  description: null,
  icon: '🎬',
  image_url: null,
  schema_template: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    topic_id: 'topic-1',
    name: 'Dune: Part Two',
    slug: 'dune-part-two',
    description: null,
    metadata: null,
    image_url: null,
    source: 'seed',
    ai_confidence: null,
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides
  }
}

describe('ItemPosterCard', () => {
  it('renders the item image when one is available', () => {
    render(
      <ItemPosterCard item={makeItem({ image_url: 'https://img.test/dune.jpg' })} />
    )

    const image = screen.getByAltText('Dune: Part Two')
    expect(image).toHaveAttribute('src', 'https://img.test/dune.jpg')
  })

  it('falls back to metadata.poster_url when image_url is missing', () => {
    render(
      <ItemPosterCard
        item={makeItem({ metadata: { poster_url: 'https://img.test/poster.jpg' } })}
      />
    )

    expect(screen.getByAltText('Dune: Part Two')).toHaveAttribute(
      'src',
      'https://img.test/poster.jpg'
    )
  })

  it('falls back to the topic emoji when the item has no image', () => {
    render(<ItemPosterCard item={makeItem()} topic={topic} />)

    expect(screen.queryByAltText('Dune: Part Two')).not.toBeInTheDocument()
    expect(screen.getByTestId('poster-fallback')).toHaveTextContent('🎬')
  })

  it('always shows the item name', () => {
    render(<ItemPosterCard item={makeItem()} topic={topic} />)

    expect(screen.getByText('Dune: Part Two')).toBeInTheDocument()
  })

  it('renders footer content when provided', () => {
    render(
      <ItemPosterCard item={makeItem()} footer={<span>★★★★★</span>} />
    )

    expect(screen.getByText('★★★★★')).toBeInTheDocument()
  })

  it('is clickable and keyboard accessible when onClick is provided', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ItemPosterCard item={makeItem()} topic={topic} onClick={onClick} />)

    const card = screen.getByRole('button', { name: /Dune: Part Two/ })
    await user.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)

    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('is not a button when there is nothing to click', () => {
    render(<ItemPosterCard item={makeItem()} topic={topic} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
