import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import MyDepartmentPage from './MyDepartmentPage'

const emp = (id: string, fullName: string, departmentId: string, managerId: string | null) => ({ id, fullName, departmentId, managerId, jobTitle: 'Eng' })

describe('MyDepartmentPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('AC14: shows employees of a nested sub-department under their own heading', async () => {
    signIn('employee', 'p')
    mockApi({
      'GET /departments/my': {
        departments: [
          { id: 'eng', name: 'Engineering', parentId: null, managerId: 'p' },
          { id: 'plat', name: 'Platform', parentId: 'eng', managerId: 'p' },
        ],
        employees: [emp('c', 'Chloe Tan', 'plat', 'p'), emp('p', 'Priya', 'eng', null)],
      },
    })
    renderAt(<MyDepartmentPage />, '/org/my-department', '/org/my-department')
    const heading = await screen.findByText('Platform')
    expect(within(heading.closest('section')!).getByText('Chloe Tan')).toBeInTheDocument()
    expect(within(heading.closest('section')!).getByText('(sub-department)')).toBeInTheDocument()
    expect(within(heading.closest('section')!).getByText('Priya')).toBeInTheDocument()
  })

  it('shows the empty state for someone who manages nothing', async () => {
    signIn('employee', 'x')
    mockApi({ 'GET /departments/my': { departments: [], employees: [] } })
    renderAt(<MyDepartmentPage />, '/org/my-department', '/org/my-department')
    expect(await screen.findByText("You don't manage a department")).toBeInTheDocument()
  })
})
