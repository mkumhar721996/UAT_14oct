import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { ActorProvider } from './auth/ActorContext'
import { hiringManager, hrAdmin } from './test/render'

vi.mock('./api/requisitionsApi', () => ({
  requisitionsApi: {
    list: vi.fn().mockResolvedValue([]),
    listPending: vi.fn().mockResolvedValue([]),
    listJobs: vi.fn().mockResolvedValue([]),
  },
}))

const renderAt = (route: string, actor = hiringManager) =>
  render(
    <ActorProvider actor={actor}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </ActorProvider>,
  )

describe('App routing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a hiring manager home to their requisitions', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'My requisitions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My requisitions' })).toHaveClass('is-active')
  })

  it('sends a recruiter or HR admin home to the approval queue', async () => {
    renderAt('/', hrAdmin)
    expect(await screen.findByRole('heading', { name: 'Approval queue' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open requisitions' })).toBeInTheDocument()
  })

  it('serves the public job board with candidate navigation', async () => {
    renderAt('/jobs')
    expect(await screen.findByRole('heading', { name: 'Open positions' })).toBeInTheDocument()
    expect(screen.getByText(/not signed in/)).toBeInTheDocument()
  })
})
