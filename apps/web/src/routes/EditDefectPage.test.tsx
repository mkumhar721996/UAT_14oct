import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import EditDefectPage from './EditDefectPage'

const base = {
  id: 'd1', defectNumber: 'DEF-1042', title: 'Export freezes', description: 'Original description', reproSteps: 'Original steps',
  severity: 'Medium', priority: null, type: 'Functional', status: 'New', triagedAt: null, reporterId: 'reporter-1',
  reporterName: 'Jordan Lee', assigneeId: null, assigneeName: null, environment: null, createdAt: '2026-10-10T09:14:00Z', updatedAt: '2026-10-10T09:14:00Z',
}
const triaged = { ...base, id: 'd2', defectNumber: 'DEF-1038', status: 'Triaged', priority: 'P2 — High', triagedAt: '2026-10-11T10:00:00Z' }
const render = (id: string) => renderAt(<EditDefectPage />, `/defects/${id}/edit`, '/defects/:id/edit')
const patches = (api: ReturnType<typeof mockApi>) => api.mock.calls.filter(([, i]) => i?.method === 'PATCH')

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('EditDefectPage', () => {
  it('AC2: the Reporter edits description and reproduction details before Triaged and saves', async () => {
    signIn('employee', undefined, 'reporter-1')
    const api = mockApi({ 'GET /defects/d1': base, 'PATCH /defects/d1': { ...base, description: 'New description' } })
    render('d1')
    const description = await screen.findByLabelText('Description')
    fireEvent.change(description, { target: { value: 'New description' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches(api)).toHaveLength(1))
    expect(JSON.parse(patches(api)[0][1]!.body as string)).toEqual({ description: 'New description' })
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
  })

  it('AC3: once Triaged the Reporter sees locked fields and no save control', async () => {
    signIn('employee', undefined, 'reporter-1')
    mockApi({ 'GET /defects/d2': triaged })
    render('d2')
    expect(await screen.findByLabelText('Description')).toBeDisabled()
    expect(screen.getByLabelText('Reproduction details')).toBeDisabled()
    expect(screen.getByText(/has entered triaged/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('AC4/AC5: an Admin can edit severity and description of a Triaged defect', async () => {
    signIn('admin', undefined, 'admin-1')
    const api = mockApi({ 'GET /defects/d2': triaged, 'PATCH /defects/d2': { ...triaged, severity: 'Low' } })
    render('d2')
    expect(await screen.findByLabelText('Description')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'Low' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches(api)).toHaveLength(1))
    expect(JSON.parse(patches(api)[0][1]!.body as string)).toEqual({ severity: 'Low' })
  })

  it('AC6: a user who is neither Reporter nor Admin sees the refusal and no PATCH is attempted', async () => {
    signIn('employee', undefined, 'other-1')
    const api = mockApi({ 'GET /defects/d2': triaged })
    render('d2')
    expect(await screen.findByText(/you don't have permission to edit this defect/i)).toBeInTheDocument()
    expect(patches(api)).toHaveLength(0)
  })

  it('AC7: saving a severity change on a Triaged defect states that priority is unchanged', async () => {
    signIn('admin', undefined, 'admin-1')
    mockApi({ 'GET /defects/d2': triaged, 'PATCH /defects/d2': { ...triaged, severity: 'Low' } })
    render('d2')
    fireEvent.change(await screen.findByLabelText('Severity'), { target: { value: 'Low' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/priority remains "P2 — High"/i)).toBeInTheDocument()
  })

  it('AC8: the Admin form offers no status control', async () => {
    signIn('admin', undefined, 'admin-1')
    mockApi({ 'GET /defects/d2': triaged })
    render('d2')
    await screen.findByText(triaged.status)
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument()
  })
})
