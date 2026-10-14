import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActorProvider } from '../../auth/ActorContext'
import { hrAdmin, makeRequisition } from '../../test/render'
import { ReassignModal } from './ReassignModal'

vi.mock('../../api/requisitionsApi', () => ({ requisitionsApi: { reassignmentTargets: vi.fn(), reassign: vi.fn() } }))
import { requisitionsApi } from '../../api/requisitionsApi'

const user = (id: string, name: string, role: string, eligible: boolean) => ({
  id, name, role, employmentStatus: 'active', eligible,
})

function setup(onReassigned = vi.fn(), onClose = vi.fn()) {
  vi.mocked(requisitionsApi.reassignmentTargets).mockResolvedValue([
    user('priya', 'Priya Nathan', 'hiring_manager', true),
    user('jordan', 'Jordan Reyes', 'hiring_manager', true),
    user('sam', 'Sam Osei', 'finance_analyst', false),
  ])
  render(
    <ActorProvider actor={hrAdmin}>
      <ReassignModal requisition={makeRequisition()} onClose={onClose} onReassigned={onReassigned} />
    </ActorProvider>,
  )
  return { onReassigned, onClose }
}

describe('ReassignModal', () => {
  beforeEach(() => vi.resetAllMocks())

  it('AC17: lists users without the Hiring Manager role as disabled options', async () => {
    setup()
    const sam = await screen.findByRole('option', { name: 'Sam Osei (Finance Analyst)' })
    expect(sam).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Jordan Reyes' })).toBeEnabled()
    expect(screen.queryByRole('option', { name: 'Priya Nathan' })).not.toBeInTheDocument()
  })

  it('AC8: confirming reassigns to the selected manager', async () => {
    const updated = makeRequisition({ hiringManagerId: 'jordan' })
    vi.mocked(requisitionsApi.reassign).mockResolvedValue(updated)
    const { onReassigned } = setup()
    await screen.findByRole('option', { name: 'Jordan Reyes' })
    fireEvent.change(screen.getByLabelText('New hiring manager'), { target: { value: 'jordan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reassignment' }))
    await waitFor(() => expect(onReassigned).toHaveBeenCalledWith(updated, 'Jordan Reyes'))
    expect(requisitionsApi.reassign).toHaveBeenCalledWith(hrAdmin, 1020, 'jordan')
  })

  it('requires a selection', async () => {
    setup()
    await screen.findByRole('option', { name: 'Jordan Reyes' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reassignment' }))
    expect(screen.getByText('Select a hiring manager to reassign to.')).toBeInTheDocument()
    expect(requisitionsApi.reassign).not.toHaveBeenCalled()
  })

  it('shows a refusal from the API', async () => {
    vi.mocked(requisitionsApi.reassign).mockRejectedValue(new Error('The new owner must be an active user with the Hiring Manager role.'))
    setup()
    await screen.findByRole('option', { name: 'Jordan Reyes' })
    fireEvent.change(screen.getByLabelText('New hiring manager'), { target: { value: 'jordan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reassignment' }))
    expect(await screen.findByText(/must be an active user/)).toBeInTheDocument()
  })

  it('closes on Cancel and Escape', async () => {
    const { onClose } = setup()
    await screen.findByRole('option', { name: 'Jordan Reyes' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
