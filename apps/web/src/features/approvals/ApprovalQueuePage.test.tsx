import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hrAdmin, makeRequisition, renderPage } from '../../test/render'
import { ApprovalQueuePage } from './ApprovalQueuePage'

vi.mock('../../api/requisitionsApi', () => ({
  requisitionsApi: { listPending: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}))
import { requisitionsApi } from '../../api/requisitionsApi'

const pending = makeRequisition({ id: 1039, title: 'Product Designer', status: 'pending_approval', submittedAt: '2026-10-12T00:00:00Z' })

describe('ApprovalQueuePage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('AC2: approving a queued requisition publishes it and refreshes the queue', async () => {
    vi.mocked(requisitionsApi.listPending).mockResolvedValueOnce([pending]).mockResolvedValue([])
    vi.mocked(requisitionsApi.approve).mockResolvedValue({ ...pending, status: 'open' })
    renderPage(<ApprovalQueuePage />, { actor: hrAdmin })
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Product Designer' }))
    await waitFor(() => expect(requisitionsApi.approve).toHaveBeenCalledWith(hrAdmin, 1039))
    expect(await screen.findByText('No requisitions waiting on approval')).toBeInTheDocument()
  })

  it('AC4: rejecting requires a reason before calling the API', async () => {
    vi.mocked(requisitionsApi.listPending).mockResolvedValue([pending])
    vi.mocked(requisitionsApi.reject).mockResolvedValue({ ...pending, status: 'rejected' })
    renderPage(<ApprovalQueuePage />, { actor: hrAdmin })
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Product Designer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.getByText(/Enter a reason/)).toBeInTheDocument()
    expect(requisitionsApi.reject).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Reason for rejection'), { target: { value: 'Not now.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() => expect(requisitionsApi.reject).toHaveBeenCalledWith(hrAdmin, 1039, 'Not now.'))
  })

  it('shows an error state with retry', async () => {
    vi.mocked(requisitionsApi.listPending).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([pending])
    renderPage(<ApprovalQueuePage />, { actor: hrAdmin })
    expect(await screen.findByText("Couldn't load the approval queue.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Product Designer')).toBeInTheDocument()
  })

  it('shows the API refusal when an action fails', async () => {
    vi.mocked(requisitionsApi.listPending).mockResolvedValue([pending])
    vi.mocked(requisitionsApi.approve).mockRejectedValue(new Error('This requisition is not pending approval.'))
    renderPage(<ApprovalQueuePage />, { actor: hrAdmin })
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Product Designer' }))
    expect(await screen.findByText('This requisition is not pending approval.')).toBeInTheDocument()
  })
})
