import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import DefectDetailPage from './DefectDetailPage'

const defect = {
  id: 'd1', defectNumber: 'DEF-1038', title: 'Dashboard widgets are slow', description: 'Takes 8-12 seconds to render.',
  reproSteps: '1. Open dashboard', severity: 'High', priority: 'P2 — High', type: 'Performance', status: 'Triaged',
  triagedAt: '2026-10-07T10:00:00Z', reporterId: 'reporter-1', reporterName: 'Priya Shah', assigneeId: 's1',
  assigneeName: 'Sam Okafor', environment: 'Production / Chrome 128', createdAt: '2026-10-06T14:47:00Z', updatedAt: '2026-10-12T11:03:00Z',
}

describe('DefectDetailPage', () => {
  beforeEach(() => {
    signIn('employee', undefined, 'someone-else')
    mockApi({ 'GET /defects/d1': defect })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('AC1: shows every field, the status and the assignee to any signed-in user', async () => {
    renderAt(<DefectDetailPage />, '/defects/d1', '/defects/:id')
    expect(await screen.findByText(defect.title)).toBeInTheDocument()
    expect(screen.getByText(defect.defectNumber)).toBeInTheDocument()
    expect(screen.getByText(defect.status)).toBeInTheDocument()
    expect(screen.getAllByText(defect.assigneeName)).not.toHaveLength(0)
    for (const text of [defect.description, defect.reproSteps, defect.severity, defect.priority, defect.type, defect.reporterName, defect.environment]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: /edit defect/i })).toHaveAttribute('href', '/defects/d1/edit')
  })
})
