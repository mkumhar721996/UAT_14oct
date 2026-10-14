import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import EmployeesManagersPage from './EmployeesManagersPage'

const emp = (id: string, fullName: string, managerId: string | null) => ({ id, fullName, managerId, departmentId: null, jobTitle: null })
const employees = [emp('e', 'Erin', 'm'), emp('m', 'Mo', null), emp('n', 'Nia', null), emp('r', 'Rex', 'e')]

describe('EmployeesManagersPage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('hr_admin')
    api = mockApi({ 'GET /employees': employees, 'GET /departments': [], 'PATCH /employees/e/manager': {} })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  async function openErin() {
    renderAt(<EmployeesManagersPage />, '/org/employees-managers', '/org/employees-managers')
    const row = (await screen.findAllByText('Erin'))[0].closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit manager' }))
    return within(await screen.findByRole('dialog'))
  }
  const patches = () => api.mock.calls.filter(([, init]) => init?.method === 'PATCH')

  it('AC6: saves the newly selected manager', async () => {
    const m = await openErin()
    fireEvent.change(m.getByLabelText('New manager'), { target: { value: 'n' } })
    fireEvent.click(m.getByRole('button', { name: 'Save manager' }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).toEqual({ managerId: 'n' })
  })

  it('AC7: clearing the manager shows an error and does not call the API', async () => {
    const m = await openErin()
    fireEvent.change(m.getByLabelText('New manager'), { target: { value: '' } })
    fireEvent.click(m.getByRole('button', { name: 'Save manager' }))
    expect(await m.findByText('Select a manager for this employee.')).toBeInTheDocument()
    expect(patches()).toHaveLength(0)
  })

  it('excludes the employee and their reports from the options', async () => {
    const m = await openErin()
    const names = m.getAllByRole('option').map((o) => o.textContent)
    expect(names).toEqual(['— Select a manager —', 'Mo', 'Nia'])
  })
})
