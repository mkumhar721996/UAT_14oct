import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeRequisition, renderPage } from '../../test/render'
import { JobPostingPage } from './JobPostingPage'

vi.mock('../../api/requisitionsApi', async () => {
  class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message)
    }
  }
  return { ApiError, requisitionsApi: { getJob: vi.fn(), apply: vi.fn() } }
})
import { ApiError, requisitionsApi } from '../../api/requisitionsApi'

const page = { path: '/jobs/:id', route: '/jobs/1020' }

describe('JobPostingPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lets a candidate apply to an open posting', async () => {
    vi.mocked(requisitionsApi.getJob).mockResolvedValue(makeRequisition())
    vi.mocked(requisitionsApi.apply).mockResolvedValue({ applied: true })
    renderPage(<JobPostingPage />, page)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply now' }))
    expect(await screen.findByText(/Application submitted — Staff Data Engineer/)).toBeInTheDocument()
    expect(requisitionsApi.apply).toHaveBeenCalledWith(1020)
  })

  it('AC7: an unapproved posting is unavailable and cannot be applied to', async () => {
    vi.mocked(requisitionsApi.getJob).mockRejectedValue(new ApiError(404, 'This posting is not open.'))
    renderPage(<JobPostingPage />, { path: '/jobs/:id', route: '/jobs/1039' })
    expect(await screen.findByText("This job posting isn't open for applications yet.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeDisabled()
    expect(requisitionsApi.apply).not.toHaveBeenCalled()
  })

  it('AC7: shows the refusal if the application is refused by the API', async () => {
    vi.mocked(requisitionsApi.getJob).mockResolvedValue(makeRequisition())
    vi.mocked(requisitionsApi.apply).mockRejectedValue(new ApiError(409, 'This job posting is not open for applications.'))
    renderPage(<JobPostingPage />, page)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply now' }))
    await waitFor(() => expect(screen.getByText('This job posting is not open for applications.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeEnabled()
  })

  it('shows a generic error when the posting cannot be loaded', async () => {
    vi.mocked(requisitionsApi.getJob).mockRejectedValue(new Error('offline'))
    renderPage(<JobPostingPage />, page)
    expect(await screen.findByText("Couldn't load this posting.")).toBeInTheDocument()
  })
})
