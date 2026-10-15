import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ActorProvider, type Actor } from '../auth/ActorContext'

export const hiringManager: Actor = { id: 'priya', name: 'Priya Nathan', role: 'hiring_manager' }
export const hrAdmin: Actor = { id: 'morgan', name: 'Morgan Clarke', role: 'hr_admin' }

export function renderPage(
  element: ReactElement,
  { actor = hiringManager, path = '/', route = path }: { actor?: Actor; path?: string; route?: string } = {},
) {
  return render(
    <ActorProvider actor={actor}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </ActorProvider>,
  )
}

export function makeRequisition(overrides: Partial<import('../api/requisitionsApi').Requisition> = {}) {
  return {
    id: 1020,
    title: 'Staff Data Engineer',
    department: 'Engineering',
    location: 'New York, NY',
    employmentType: 'Full-time',
    headcount: 1,
    startDate: '2026-10-05',
    description: 'Design the event-streaming platform.',
    salaryMin: 170000,
    salaryMax: 205000,
    hiringManagerId: 'priya',
    hiringManager: { id: 'priya', name: 'Priya Nathan', role: 'hiring_manager', employmentStatus: 'active', eligible: true },
    status: 'open' as const,
    pipeline: [],
    pipelineCandidateCount: 0,
    submittedAt: null,
    approvedBy: null,
    publishedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    lastSavedAt: null,
    ...overrides,
  }
}
