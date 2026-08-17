import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { RescanDiff } from './RescanDiff'
import { adminService } from '@/services/adminService'

vi.mock('@/services/adminService', () => ({
  adminService: { previewRescan: vi.fn(), applyRescan: vi.fn() }
}))

const preview = {
  data: {
    proposal_id: 'p1',
    current: { id: 'item-1', name: 'Blade Runner', description: 'old desc', metadata: { director: 'Wrong Person', year: 1982 }, image_url: null },
    proposed: { name: 'Blade Runner', description: 'new desc', metadata: { director: 'Ridley Scott', year: 1982 }, image_url: null },
    changed_fields: ['description', 'metadata.director'],
    confidence: 0.91,
    sources: ['https://example.com']
  },
  error: null
}

describe('RescanDiff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while the scan runs', async () => {
    vi.mocked(adminService.previewRescan).mockReturnValue(new Promise(() => {}) as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(screen.getByText(/checking the web/i)).toBeInTheDocument()
  })

  it('lists each changed field with before and after, all checked', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByText('Wrong Person')).toBeInTheDocument()
    expect(screen.getByText('Ridley Scott')).toBeInTheDocument()
    expect(screen.getByLabelText(/metadata\.director/i)).toBeChecked()
    expect(screen.getByLabelText(/description/i)).toBeChecked()
  })

  it('excludes unchecked fields from the apply payload', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)
    vi.mocked(adminService.applyRescan).mockResolvedValue({ data: { id: 'item-1' } as never, error: null })

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    await user.click(await screen.findByLabelText(/description/i))
    await user.click(screen.getByRole('button', { name: /apply/i }))

    await waitFor(() => expect(adminService.applyRescan).toHaveBeenCalledWith(
      'p1', ['metadata.director']
    ))
  })

  it('disables apply when nothing is selected', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    await user.click(await screen.findByLabelText(/description/i))
    await user.click(screen.getByLabelText(/metadata\.director/i))

    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled()
  })

  it('reports when the scan found nothing to change', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue({
      data: { ...preview.data, changed_fields: [] }, error: null
    } as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByText(/nothing looks different/i)).toBeInTheDocument()
  })

  it('surfaces a scan failure', async () => {
    vi.mocked(adminService.previewRescan).mockResolvedValue({
      data: null, error: new Error("Couldn't find reliable information on this one.")
    } as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't find reliable information")
  })

  it('surfaces an expired proposal error telling the admin to re-scan', async () => {
    const user = userEvent.setup()
    vi.mocked(adminService.previewRescan).mockResolvedValue(preview as never)
    vi.mocked(adminService.applyRescan).mockResolvedValue({
      data: null, error: new Error('This proposal expired. Re-scan to get fresh results.')
    } as never)

    render(<RescanDiff itemId="item-1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /apply/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/re-scan/i)
  })
})
