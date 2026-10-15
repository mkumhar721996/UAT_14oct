import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import DefectEditPage from './DefectEditPage'

const base = {
  id: 'def-1', title: 'Broken login', description: 'Old desc', severity: 'High', stepsToReproduce: 'Old steps',
  expectedResult: null, actualResult: null, environment: null, status: 'New', priority: null,
  assigneeName: null, reportedBy: 'rep-1', createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T11:00:00Z',
}

describe('DefectEditPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  let api: ReturnType<typeof mockApi>
  const setup = async (defect: Record<string, unknown>, role: Parameters<typeof signIn>[0], sub: string) => {
    signIn(role, undefined, sub)
    api = mockApi({ 'GET /defects/def-1': defect, 'PATCH /defects/def-1': defect })
    renderAt(<DefectEditPage />, '/defects/def-1/edit', '/defects/:id/edit')
    await screen.findByRole('heading', { level: 3, name: 'Broken login' })
  }
  const patches = () => api.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

  it('AC2: the reporter saves description and steps before triage', async () => {
    await setup(base, 'reporter', 'rep-1')
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: 'New desc' } })
    fireEvent.change(screen.getByLabelText(/^steps to reproduce/i), { target: { value: 'New steps' } })
    save()
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).toEqual({ description: 'New desc', stepsToReproduce: 'New steps' })
  })

  it('requires description and steps', async () => {
    await setup(base, 'reporter', 'rep-1')
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: '  ' } })
    save()
    expect(await screen.findByText('Describe the defect.')).toBeInTheDocument()
    expect(patches()).toHaveLength(0)
  })

  it('AC3: the reporter sees locked fields and no Save after triage', async () => {
    await setup({ ...base, status: 'Triaged' }, 'reporter', 'rep-1')
    expect(screen.getByLabelText(/description/i)).toBeDisabled()
    expect(screen.getByLabelText(/steps to reproduce/i)).toBeDisabled()
    expect(screen.getByText('Locked after triage')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it.each(['New', 'Triaged'])('AC4: an admin always gets an enabled severity select (%s) and saves it', async (status) => {
    await setup({ ...base, status }, 'admin', 'adm-1')
    expect(screen.getByLabelText(/severity/i)).toBeEnabled()
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: 'Low' } })
    save()
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).toEqual(
      status === 'New' ? { severity: 'Low' } : { severity: 'Low', description: 'Old desc', stepsToReproduce: 'Old steps' },
    )
  })

  it('AC5: an admin can edit description only once triaged', async () => {
    await setup({ ...base, status: 'Triaged' }, 'admin', 'adm-1')
    expect(screen.getByLabelText(/^description/i)).toBeEnabled()
  })

  it('AC5: an admin sees description locked before triage', async () => {
    await setup(base, 'admin', 'adm-1')
    expect(screen.getByLabelText(/description/i)).toBeDisabled()
    expect(screen.getByText(/becomes editable for admins once this defect is triaged/i)).toBeInTheDocument()
  })

  it('AC6: someone else sees the permission banner and disabled fields', async () => {
    await setup(base, 'employee', 'other')
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument()
    for (const t of screen.getAllByRole('textbox')) expect(t).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('AC7: priority still shows after a severity save', async () => {
    await setup({ ...base, status: 'Triaged', priority: 'P2' }, 'admin', 'adm-1')
    expect(screen.getByText('P2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: 'Low' } })
    save()
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).not.toHaveProperty('priority')
  })

  it('AC8: no status control is offered', async () => {
    await setup(base, 'admin', 'adm-1')
    expect(screen.queryByRole('combobox', { name: /status/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument()
    expect(screen.getByText(/status changes aren't made here/i)).toBeInTheDocument()
  })
})
