import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { FlagItemModal, flagPlaceholderForTopic } from './FlagItemModal'
import { flagService, DUPLICATE_FLAG_MESSAGE } from '@/services/flagService'
import type { Item, Topic } from '@/types'

vi.mock('@/services/flagService', async () => {
  const actual = await vi.importActual<typeof import('@/services/flagService')>('@/services/flagService')
  return {
    ...actual,
    flagService: { createFlag: vi.fn() }
  }
})

const item = (topicSlug: string): Item & { topic?: Topic } => ({
  id: 'item-1', topic_id: 't1', name: 'Blade Runner', slug: 'blade-runner',
  description: null, metadata: null, image_url: null, source: 'ai_generated',
  ai_confidence: 0.9, created_by: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  topic: { id: 't1', name: 'Movies', slug: topicSlug, description: null, icon: null,
    image_url: null, schema_template: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
})

describe('flagPlaceholderForTopic', () => {
  it('is topic specific', () => {
    expect(flagPlaceholderForTopic('movies')).toContain('Director')
    expect(flagPlaceholderForTopic('series')).toContain('seasons')
    expect(flagPlaceholderForTopic('books')).toContain('Publish year')
  })

  it('falls back for an unknown topic', () => {
    expect(flagPlaceholderForTopic('kayaks')).toContain('release year')
  })
})

describe('FlagItemModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the topic placeholder and leaves the field empty', () => {
    render(<FlagItemModal item={item('series')} open onOpenChange={vi.fn()} />)

    const field = screen.getByLabelText(/what's wrong/i)
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', expect.stringContaining('seasons'))
  })

  it('keeps submit disabled until 10 characters are entered', () => {
    render(<FlagItemModal item={item('movies')} open onOpenChange={vi.fn()} />)

    const submit = screen.getByRole('button', { name: /send report/i })
    const field = screen.getByLabelText(/what's wrong/i)
    expect(submit).toBeDisabled()

    // A single fireEvent.change sets the whole value at once instead of
    // simulating each keystroke — the behaviour under test is the length
    // threshold, not the act of typing, and per-keystroke real events are
    // the dominant, CPU-load-sensitive cost in this suite.
    fireEvent.change(field, { target: { value: 'too short' } })
    expect(submit).toBeDisabled()

    fireEvent.change(field, { target: { value: 'too short but now it is long enough' } })
    expect(submit).toBeEnabled()
  })

  it('submits, closes and reports success', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onFlagged = vi.fn()
    vi.mocked(flagService.createFlag).mockResolvedValue({ data: { id: 'f1' } as never, error: null })

    render(<FlagItemModal item={item('movies')} open onOpenChange={onOpenChange} onFlagged={onFlagged} />)

    fireEvent.change(screen.getByLabelText(/what's wrong/i), {
      target: { value: 'The director is listed as the wrong person' }
    })
    await user.click(screen.getByRole('button', { name: /send report/i }))

    await screen.findByDisplayValue('')
    expect(flagService.createFlag).toHaveBeenCalledWith(
      'item-1', 'The director is listed as the wrong person'
    )
    expect(onFlagged).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the duplicate message inline and stays open', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    vi.mocked(flagService.createFlag).mockResolvedValue({
      data: null, error: new Error(DUPLICATE_FLAG_MESSAGE)
    })

    render(<FlagItemModal item={item('movies')} open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText(/what's wrong/i), {
      target: { value: 'The director is listed as the wrong person' }
    })
    await user.click(screen.getByRole('button', { name: /send report/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(DUPLICATE_FLAG_MESSAGE)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
