import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnrichmentPrompt } from './EnrichmentPrompt'
import { BrowserRouter } from 'react-router-dom'
import * as enrichmentHook from '../hooks/useEnrichment'

// Mock the useEnrichment hook
vi.mock('../hooks/useEnrichment', () => ({
  useEnrichment: vi.fn()
}))

const mockUseEnrichment = vi.mocked(enrichmentHook.useEnrichment)

const defaultProps = {
  searchQuery: 'The Matrix',
  topicSlug: 'movies',
  topicId: 'topic-123',
  topicName: 'Movies',
  onEnrichmentComplete: vi.fn(),
  onCancel: vi.fn()
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('EnrichmentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render initial prompt state', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText(/Couldn't find/)).toBeInTheDocument()
    expect(screen.getByText(/"The Matrix"/)).toBeInTheDocument()
    expect(screen.getByText(/Want me to search the web/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Search the Web/i })).toBeInTheDocument()
  })

  it('should show remaining requests badge when less than 3', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 2,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText(/2 searches left today/)).toBeInTheDocument()
  })

  it('should disable button when rate limit reached', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 0,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    const button = screen.getByRole('button', { name: /Daily Limit Reached/i })
    expect(button).toBeDisabled()
    expect(screen.getByText(/Daily search limit reached/)).toBeInTheDocument()
  })

  it('should show loading state during search', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'searching',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText(/Searching the web/)).toBeInTheDocument()
    expect(screen.getByText(/This might take a moment/)).toBeInTheDocument()
  })

  it('should show extracting state', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'extracting',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText(/Found something! Gathering details/)).toBeInTheDocument()
  })

  it('should show saving state', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'saving',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText(/Saving to database/)).toBeInTheDocument()
  })

  it('should show error state with suggestions', () => {
    mockUseEnrichment.mockReturnValue({
      status: 'error',
      error: 'Item not found',
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(screen.getByText('Item not found')).toBeInTheDocument()
    expect(screen.getByText(/Suggestions:/)).toBeInTheDocument()
    expect(screen.getByText(/Check for typos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })

  it('should call enrichItem when search button clicked', async () => {
    const mockEnrichItem = vi.fn()
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: mockEnrichItem,
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    const user = userEvent.setup()
    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    const button = screen.getByRole('button', { name: /Search the Web/i })
    await user.click(button)

    expect(mockEnrichItem).toHaveBeenCalledWith('topic-123', 'movies', 'The Matrix')
  })

  it('should call onCancel when cancel button clicked', async () => {
    const mockOnCancel = vi.fn()
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: vi.fn(),
      reset: vi.fn()
    })

    const user = userEvent.setup()
    renderWithRouter(
      <EnrichmentPrompt {...defaultProps} onCancel={mockOnCancel} />
    )

    const button = screen.getByRole('button', { name: /Cancel/i })
    await user.click(button)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should check rate limit on mount', () => {
    const mockCheckRateLimit = vi.fn()
    mockUseEnrichment.mockReturnValue({
      status: 'idle',
      error: null,
      remainingRequests: 5,
      dailyLimit: 5,
      enrichItem: vi.fn(),
      checkRateLimit: mockCheckRateLimit,
      reset: vi.fn()
    })

    renderWithRouter(<EnrichmentPrompt {...defaultProps} />)

    expect(mockCheckRateLimit).toHaveBeenCalled()
  })
})
