import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, mockApi, renderAt, signIn } from '../test/helpers'
import DefectDetailPage from './DefectDetailPage'

const defect = {
  id: 'def-1', title: 'Broken login', description: 'Desc text', severity: 'High', stepsToReproduce: '1. go',
  expectedResult: null, actualResult: 'Nothing happens', environment: null, status: 'New', priority: null,
  assigneeName: null, resolutionNote: null, reopenReason: null, reportedBy: 'rep-1', createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T11:00:00Z',
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

  describe('workflow actions', () => {
    const open = async (status: string, role: Parameters<typeof signIn>[0], extra = {}, routes: Record<string, unknown> = {}) => {
      signIn(role, undefined, 'dev-1')
      const api = mockApi({ 'GET /defects/def-1': { ...defect, status, ...extra }, ...routes })
      render()
      await screen.findByRole('heading', { level: 3, name: 'Broken login' })
      return api
    }
    const transitionCalls = (api: ReturnType<typeof mockApi>) => api.mock.calls.filter(([u]) => String(u).includes('/transitions'))

    it('AC2: the Triage action is visible to a Developer and the refused attempt leaves status New', async () => {
      await open('New', 'developer', {}, { 'POST /defects/def-1/transitions': errorResponse(403, 'Triaging a defect is limited to QA/Verifier or Admin.') })
      fireEvent.click(screen.getByRole('button', { name: /^triage$/i }))
      fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: 'P2' } })
      fireEvent.click(screen.getByRole('button', { name: /set to triaged/i }))
      expect(await screen.findByText(/triaging a defect is limited to qa\/verifier or admin/i)).toBeInTheDocument()
      expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('AC1: a successful triage shows the new status', async () => {
      await open('New', 'qa_verifier', {}, { 'POST /defects/def-1/transitions': { ...defect, status: 'Triaged', priority: 'P2' } })
      fireEvent.click(screen.getByRole('button', { name: /^triage$/i }))
      fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: 'P2' } })
      fireEvent.click(screen.getByRole('button', { name: /set to triaged/i }))
      expect(await screen.findByText('Triaged', { selector: '.chip' })).toBeInTheDocument()
    })

    it('AC6: a blank resolution note is refused locally without calling the API', async () => {
      const api = await open('In Progress', 'developer', { assigneeName: 'dev-1' })
      fireEvent.click(screen.getByRole('button', { name: /^mark resolved$/i }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^mark resolved$/i }))
      expect(screen.getByText("Resolution note can't be empty.")).toBeInTheDocument()
      expect(transitionCalls(api)).toHaveLength(0)
    })

    it('AC10: a blank reopen reason is refused locally', async () => {
      const api = await open('Verified', 'qa_verifier')
      fireEvent.click(screen.getByRole('button', { name: /^reopen$/i }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^reopen$/i }))
      expect(screen.getByText("Reopen reason can't be empty.")).toBeInTheDocument()
      expect(transitionCalls(api)).toHaveLength(0)
    })

    it('shows Reassign and Start progress for an Assigned defect and starts work directly', async () => {
      const api = await open('Assigned', 'developer', { assigneeName: 'dev-1' }, { 'POST /defects/def-1/transitions': { ...defect, status: 'In Progress' } })
      expect(screen.getByRole('button', { name: /^reassign$/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /start progress/i }))
      expect(await screen.findByText('In Progress', { selector: '.chip' })).toBeInTheDocument()
      expect(JSON.parse(transitionCalls(api)[0][1]!.body as string)).toEqual({ action: 'start' })
    })

    it('shows the resolution note and reopen reason when set', async () => {
      await open('Reopened', 'admin', { resolutionNote: 'Fixed null check', reopenReason: 'Still broken' })
      expect(screen.getByText('Fixed null check')).toBeInTheDocument()
      expect(screen.getByText('Still broken')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument()
    })
  })
})
