import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequisition, renderPage } from '../../test/render'
import { JobBoardPage } from './JobBoardPage'

vi.mock('../../api/requisitionsApi', () => ({ requisitionsApi: { listJobs: vi.fn() } }))
import { requisitionsApi } from '../../api/requisitionsApi'

describe('JobBoardPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('AC6: lists only the open postings the API returns, linking to each', async () => {
    vi.mocked(requisitionsApi.listJobs).mockResolvedValue([makeRequisition({ id: 1020 })])
    renderPage(<JobBoardPage />)
    expect(await screen.findByText('Staff Data Engineer')).toBeInTheDocument()
    expect(screen.queryByText(/Product Designer/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View & apply/ })).toHaveAttribute('href', '/jobs/1020')
  })

  it('searches through the API and shows the empty state', async () => {
    vi.mocked(requisitionsApi.listJobs).mockResolvedValueOnce([makeRequisition()]).mockResolvedValue([])
    renderPage(<JobBoardPage />)
    await screen.findByText('Staff Data Engineer')
    fireEvent.change(screen.getByLabelText('Search open roles'), { target: { value: 'designer' } })
    await waitFor(() => expect(requisitionsApi.listJobs).toHaveBeenLastCalledWith('designer'))
    expect(await screen.findByText('No open roles match your search')).toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    vi.mocked(requisitionsApi.listJobs).mockRejectedValue(new Error('offline'))
    renderPage(<JobBoardPage />)
    expect(await screen.findByText("Couldn't load open roles.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
