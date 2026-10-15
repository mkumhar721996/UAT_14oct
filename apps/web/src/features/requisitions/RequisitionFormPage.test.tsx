import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '../../test/user'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequisition, renderPage } from '../../test/render'
import { RequisitionFormPage } from './RequisitionFormPage'

vi.mock('../../api/requisitionsApi', () => ({
  requisitionsApi: { create: vi.fn(), update: vi.fn(), submit: vi.fn(), get: vi.fn() },
}))
import { requisitionsApi } from '../../api/requisitionsApi'

const routes = { path: '/requisitions/new', route: '/requisitions/new' }

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Job title'), 'Senior Backend Engineer')
  await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
  await user.type(screen.getByLabelText('Location'), 'Remote (US)')
  await user.type(screen.getByLabelText('Job description'), 'Own the rewrite.')
}

describe('RequisitionFormPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('AC1: submitting a new requisition sends it for approval', async () => {
    vi.mocked(requisitionsApi.create).mockResolvedValue(makeRequisition({ status: 'pending_approval' }))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, routes)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    await waitFor(() =>
      expect(requisitionsApi.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Senior Backend Engineer', department: 'Engineering' }),
        'submit',
      ),
    )
    expect(await screen.findByText('elsewhere')).toBeInTheDocument()
  })

  it('shows inline validation, keeps input, and does not call the API', async () => {
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, routes)
    await user.type(screen.getByLabelText('Job title'), 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(screen.getByText('Select a department.')).toBeInTheDocument()
    expect(screen.getByText('Enter a location.')).toBeInTheDocument()
    expect(screen.getByText('Add a short job description.')).toBeInTheDocument()
    expect(screen.getByLabelText('Job title')).toHaveValue('Keep me')
    expect(requisitionsApi.create).not.toHaveBeenCalled()
  })

  it('AC12: saves a draft with only a title', async () => {
    vi.mocked(requisitionsApi.create).mockResolvedValue(makeRequisition({ status: 'draft' }))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, routes)
    await user.type(screen.getByLabelText('Job title'), 'Staff Engineer')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(requisitionsApi.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'draft'))
  })

  it('disables and relabels both actions while submitting', async () => {
    vi.mocked(requisitionsApi.create).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, routes)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(await screen.findByRole('button', { name: 'Submitting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeDisabled()
  })

  it('AC13: submitting an existing draft updates then submits it', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(
      makeRequisition({ id: 1042, status: 'draft', title: 'Draft role', description: 'Desc' }),
    )
    vi.mocked(requisitionsApi.update).mockResolvedValue(makeRequisition())
    vi.mocked(requisitionsApi.submit).mockResolvedValue(makeRequisition({ status: 'pending_approval' }))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, { path: '/requisitions/:id/edit', route: '/requisitions/1042/edit' })
    expect(await screen.findByLabelText('Job title')).toHaveValue('Draft role')
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    await waitFor(() => expect(requisitionsApi.submit).toHaveBeenCalledWith(expect.anything(), 1042))
    expect(requisitionsApi.update).toHaveBeenCalled()
  })

  it('AC15: a rejected requisition shows the rejection and can be resubmitted', async () => {
    vi.mocked(requisitionsApi.get).mockResolvedValue(
      makeRequisition({
        id: 1031,
        status: 'rejected',
        rejectedBy: 'Morgan Clarke (HR Admin)',
        rejectedAt: '2026-10-08T00:00:00Z',
        rejectionReason: 'Headcount moves to Q1 planning.',
      }),
    )
    vi.mocked(requisitionsApi.update).mockResolvedValue(makeRequisition())
    vi.mocked(requisitionsApi.submit).mockResolvedValue(makeRequisition({ status: 'pending_approval' }))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, { path: '/requisitions/:id/edit', route: '/requisitions/1031/edit' })
    expect(await screen.findByText(/Headcount moves to Q1 planning\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resubmit for approval' }))
    await waitFor(() => expect(requisitionsApi.submit).toHaveBeenCalledWith(expect.anything(), 1031))
  })

  it('shows the API error and re-enables the form when saving fails', async () => {
    vi.mocked(requisitionsApi.create).mockRejectedValue(new Error('Server said no.'))
    const user = userEvent.setup()
    renderPage(<RequisitionFormPage />, routes)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(await screen.findByText('Server said no.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled()
  })
})
