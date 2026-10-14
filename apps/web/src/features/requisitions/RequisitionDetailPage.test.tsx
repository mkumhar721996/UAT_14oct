import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hiringManager, hrAdmin, makeRequisition, renderPage } from '../../test/render'
import { RequisitionDetailPage } from './RequisitionDetailPage'

vi.mock('../../api/requisitionsApi', () => ({
  requisitionsApi: {
    get: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    reassignmentTargets: vi.fn().mockResolvedValue([]),
  },
}))
import { requisitionsApi } from '../../api/requisitionsApi'

const page = { path: '/requisitions/:id', route: '/requisitions/1039' }
const pending = () => makeRequisition({ id: 1039, status: 'pending_approval', title: 'Product Designer', submittedAt: '2026-10-12T00:00:00Z' })

describe('RequisitionDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requisitionsApi.reassignmentTargets).mockResolvedValue([])
  })

  it('AC2: a reviewer approving a pending requisition publishes it', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValueOnce(pending()).mockResolvedValue({ ...pending(), status: 'open', approvedBy: 'Morgan Clarke (HR Admin)' })
    vi.mocked(requisitionsApi.approve).mockResolvedValue(pending())
    renderPage(<RequisitionDetailPage />, { ...page, actor: hrAdmin })
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(requisitionsApi.approve).toHaveBeenCalledWith(hrAdmin, 1039))
    expect(await screen.findByText('Approved by')).toBeInTheDocument()
  })

  it('AC3/AC5: a hiring manager cannot approve or reject a pending requisition', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(pending())
    renderPage(<RequisitionDetailPage />, { ...page, actor: hiringManager })
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
    expect(screen.getByText(/it stays pending approval/)).toBeInTheDocument()
  })

  it('AC4: rejecting requires a reason, then sends it', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(pending())
    vi.mocked(requisitionsApi.reject).mockResolvedValue(pending())
    renderPage(<RequisitionDetailPage />, { ...page, actor: hrAdmin })
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.getByText(/Enter a reason/)).toBeInTheDocument()
    expect(requisitionsApi.reject).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Reason for rejection'), { target: { value: 'Not this quarter.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() => expect(requisitionsApi.reject).toHaveBeenCalledWith(hrAdmin, 1039, 'Not this quarter.'))
  })

  it('AC16: reassignment is unavailable while pending', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(pending())
    renderPage(<RequisitionDetailPage />, { ...page, actor: hrAdmin })
    expect(await screen.findByRole('button', { name: 'Reassign owner' })).toBeDisabled()
  })

  it('AC14: a hiring manager sees a rejected requisition as rejected, with the reason and resubmit', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(
      makeRequisition({ id: 1031, status: 'rejected', rejectedBy: 'Morgan Clarke (HR Admin)', rejectedAt: '2026-10-08T00:00:00Z', rejectionReason: 'Headcount moves to Q1.' }),
    )
    renderPage(<RequisitionDetailPage />, { path: '/requisitions/:id', route: '/requisitions/1031' })
    expect(await screen.findByText(/Rejected by Morgan Clarke/)).toBeInTheDocument()
    expect(screen.getByText('Headcount moves to Q1.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resubmit for approval' })).toHaveAttribute('href', '/requisitions/1031/edit')
  })

  it('AC8/AC9: a reviewer can reassign an open requisition and the pipeline is shown', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(
      makeRequisition({ id: 1020, approvedBy: 'Morgan Clarke (HR Admin)', pipeline: [{ name: 'Elena Cho', stage: 'Phone screen' }] }),
    )
    renderPage(<RequisitionDetailPage />, { path: '/requisitions/:id', route: '/requisitions/1020', actor: hrAdmin })
    expect(await screen.findByText('Elena Cho')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reassign owner' }))
    expect(await screen.findByRole('dialog', { name: 'Reassign requisition owner' })).toBeInTheDocument()
  })

  it('AC10: a hiring manager cannot reassign an open requisition', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(makeRequisition({ id: 1020, approvedBy: 'Morgan Clarke (HR Admin)' }))
    renderPage(<RequisitionDetailPage />, { path: '/requisitions/:id', route: '/requisitions/1020' })
    expect(await screen.findByRole('button', { name: 'Reassign owner' })).toBeDisabled()
  })

  it('AC11: an open requisition whose owner changed role stays open with a warning', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(
      makeRequisition({
        id: 1005,
        approvedBy: 'Devon Blake (Recruiter)',
        pipeline: [{ name: 'Taylor Brooks', stage: 'Phone screen' }],
        hiringManager: { id: 'jordan', name: 'Jordan Reyes', role: 'support_engineer', employmentStatus: 'active', eligible: false },
      }),
    )
    renderPage(<RequisitionDetailPage />, { path: '/requisitions/:id', route: '/requisitions/1005', actor: hrAdmin })
    expect(await screen.findByText(/role has changed since this requisition opened/)).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Taylor Brooks')).toBeInTheDocument()
  })

  it('shows an error when the requisition cannot be loaded', async () => {
    vi.mocked(requisitionsApi.get).mockRejectedValue(new Error('This requisition belongs to another manager.'))
    renderPage(<RequisitionDetailPage />, page)
    expect(await screen.findByText('This requisition belongs to another manager.')).toBeInTheDocument()
  })
})
