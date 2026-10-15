import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import DefectDetailPage from './DefectDetailPage'

const defect = {
  id: 'def-1', title: 'Broken login', description: 'Desc text', severity: 'High', stepsToReproduce: '1. go',
  expectedResult: null, actualResult: 'Nothing happens', environment: null, status: 'New', priority: null,
  assigneeName: null, reportedBy: 'rep-1', createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T11:00:00Z',
}

describe('DefectDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const render = () => renderAt(<DefectDetailPage />, '/defects/def-1', '/defects/:id')

  it('AC1: shows every field, the status and the assignee', async () => {
    signIn('employee', undefined, 'someone')
    mockApi({ 'GET /defects/def-1': defect })
    render()
    expect(await screen.findByRole('heading', { level: 3, name: 'Broken login' })).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Not assigned')).toBeInTheDocument()
    expect(screen.getByText('Desc text')).toBeInTheDocument()
    expect(screen.getByText('1. go')).toBeInTheDocument()
    expect(screen.getByText('Nothing happens')).toBeInTheDocument()
    expect(screen.getByText('rep-1')).toBeInTheDocument()
    expect(screen.getByText('Set by the triage workflow')).toBeInTheDocument()
  })

  it('shows an error with retry when loading fails', async () => {
    signIn('employee')
    mockApi({})
    render()
    expect(await screen.findByText(/couldn't load this defect/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('AC6: Edit by a non-reporter non-admin toasts a refusal', async () => {
    signIn('employee', undefined, 'someone')
    mockApi({ 'GET /defects/def-1': defect })
    render()
    await screen.findByRole('heading', { level: 3, name: 'Broken login' })
    fireEvent.click(screen.getByRole('link', { name: /edit defect/i }))
    await waitFor(() => expect(screen.getByText(/edit refused/i)).toBeInTheDocument())
  })
})
