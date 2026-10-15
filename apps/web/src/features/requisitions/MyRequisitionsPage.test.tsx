import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequisition, renderPage } from '../../test/render'
import { MyRequisitionsPage } from './MyRequisitionsPage'

vi.mock('../../api/requisitionsApi', () => ({ requisitionsApi: { list: vi.fn() } }))
import { requisitionsApi } from '../../api/requisitionsApi'

describe('MyRequisitionsPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('AC12: shows a saved draft in draft state with an edit action', async () => {
    vi.mocked(requisitionsApi.list).mockResolvedValue([
      makeRequisition({ id: 1042, title: 'Senior Backend Engineer', status: 'draft', lastSavedAt: '2026-10-13T00:00:00Z' }),
    ])
    renderPage(<MyRequisitionsPage />)
    expect(await screen.findByText('Draft')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit draft' })).toHaveAttribute('href', '/requisitions/1042/edit')
  })

  it('AC14: shows a rejected requisition as rejected', async () => {
    vi.mocked(requisitionsApi.list).mockResolvedValue([makeRequisition({ id: 1031, status: 'rejected' })])
    renderPage(<MyRequisitionsPage />)
    expect(await screen.findByText('Rejected')).toBeInTheDocument()
  })

  it('shows the empty state with a New requisition action', async () => {
    vi.mocked(requisitionsApi.list).mockResolvedValue([])
    renderPage(<MyRequisitionsPage />)
    expect(await screen.findByText("You haven't created any requisitions yet")).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New requisition' })).toHaveLength(2)
  })

  it('shows an error with retry when loading fails', async () => {
    vi.mocked(requisitionsApi.list).mockRejectedValue(new Error('offline'))
    renderPage(<MyRequisitionsPage />)
    expect(await screen.findByText("Couldn't load requisitions.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('reviewers see open requisitions without a New requisition action', async () => {
    vi.mocked(requisitionsApi.list).mockResolvedValue([makeRequisition()])
    renderPage(<MyRequisitionsPage mode="open" />, { actor: { id: 'morgan', name: 'Morgan Clarke', role: 'hr_admin' } })
    expect(await screen.findByRole('link', { name: 'View' })).toHaveAttribute('href', '/requisitions/1020')
    expect(screen.queryByRole('button', { name: 'New requisition' })).not.toBeInTheDocument()
    expect(requisitionsApi.list).toHaveBeenCalledWith(expect.anything(), 'open')
  })
})
