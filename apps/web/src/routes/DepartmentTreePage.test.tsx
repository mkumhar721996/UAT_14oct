import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import DepartmentTreePage from './DepartmentTreePage'

const emp = (id: string, fullName: string, departmentId: string | null = null) => ({
  id, fullName, departmentId, managerId: null, employeeNumber: id, startDate: '2024-01-01', jobTitle: null, department: null, contractType: null, salary: null,
})
const employees = [emp('p', 'Priya', 'eng'), emp('m', 'Marcus')]
const departments = [
  { id: 'eng', name: 'Engineering', parentId: null, managerId: 'p' },
  { id: 'plat', name: 'Platform', parentId: 'eng', managerId: 'm' },
  { id: 'ops', name: 'Ops', parentId: null, managerId: 'm' },
]

const open = () => renderAt(<DepartmentTreePage />, '/org/departments', '/org/departments')
const modal = async () => within(await screen.findByRole('dialog'))

describe('DepartmentTreePage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('hr_admin')
    api = mockApi({
      'GET /departments': departments,
      'GET /employees': employees,
      'POST /departments': {},
      'DELETE /departments/ops': {},
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  const writes = () => api.mock.calls.filter(([, init]) => init?.method === 'POST')

  it('AC2: renders a sub-department nested under its parent with manager and count', async () => {
    open()
    const eng = (await screen.findByText('Engineering')).closest('li')!
    expect(within(eng).getByText('Platform')).toBeInTheDocument()
    expect(within(eng).getByText('Managed by Priya')).toBeInTheDocument()
    expect(within(eng).getByText('1 person')).toBeInTheDocument()
  })

  it('AC16: blank name shows an error and does not call the API', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add department' }))
    const m = await modal()
    fireEvent.change(m.getByLabelText('Manager'), { target: { value: 'p' } })
    fireEvent.click(m.getByRole('button', { name: 'Save department' }))
    expect(await m.findByText('Enter a department name.')).toBeInTheDocument()
    expect(writes()).toHaveLength(0)
  })

  it('AC4: missing manager shows an error and does not call the API', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add department' }))
    const m = await modal()
    fireEvent.change(m.getByLabelText('Department name'), { target: { value: 'Sales' } })
    fireEvent.click(m.getByRole('button', { name: 'Save department' }))
    expect(await m.findByText('Select a manager for this department.')).toBeInTheDocument()
    expect(writes()).toHaveLength(0)
  })

  it('AC17: duplicate sibling name is rejected client-side', async () => {
    open()
    const eng = (await screen.findByText('Engineering')).closest('li')!
    fireEvent.click(within(eng.querySelector('.tree-row') as HTMLElement).getByRole('button', { name: 'Add sub-department' }))
    const m = await modal()
    fireEvent.change(m.getByLabelText('Department name'), { target: { value: 'platform' } })
    fireEvent.change(m.getByLabelText('Manager'), { target: { value: 'p' } })
    fireEvent.click(m.getByRole('button', { name: 'Save department' }))
    expect(await m.findByText(/already exists under Engineering/)).toBeInTheDocument()
    expect(writes()).toHaveLength(0)
  })

  it('AC1: creates a top-level department with a null parent', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add department' }))
    const m = await modal()
    fireEvent.change(m.getByLabelText('Department name'), { target: { value: 'Sales' } })
    fireEvent.change(m.getByLabelText('Manager'), { target: { value: 'p' } })
    fireEvent.click(m.getByRole('button', { name: 'Save department' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(JSON.parse(writes()[0][1]!.body as string)).toEqual({ name: 'Sales', parentId: null, managerId: 'p' })
  })

  it('AC11/AC12: delete is blocked with a message when members or sub-departments remain', async () => {
    open()
    const eng = (await screen.findByText('Engineering')).closest('li')!
    fireEvent.click(within(eng.querySelector('.tree-row') as HTMLElement).getByRole('button', { name: 'Delete' }))
    const m = await modal()
    expect(m.getByText(/Reassign its 1 employee and 1 sub-department/)).toBeInTheDocument()
    expect(m.queryByRole('button', { name: 'Delete department' })).not.toBeInTheDocument()
  })

  it('AC13: an empty department can be deleted', async () => {
    open()
    const ops = (await screen.findByText('Ops')).closest('li')!
    fireEvent.click(within(ops).getByRole('button', { name: 'Delete' }))
    fireEvent.click((await modal()).getByRole('button', { name: 'Delete department' }))
    await waitFor(() => expect(api.mock.calls.some(([u, i]) => u === '/departments/ops' && i?.method === 'DELETE')).toBe(true))
  })
})
