import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import OrgChartPage from './OrgChartPage'

const emp = (id: string, fullName: string, managerId: string | null) => ({ id, fullName, managerId, departmentId: null, jobTitle: 'Role' })

describe('OrgChartPage', () => {
  beforeEach(() => {
    signIn('employee', 'x')
    mockApi({
      'GET /employees': [emp('d', 'Dana Whitfield', null), emp('p', 'Priya Natarajan', 'd'), emp('o', 'Other Root', null)],
      'GET /departments': [],
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('AC8: a direct report renders nested under their manager', async () => {
    renderAt(<OrgChartPage />, '/org/chart', '/org/chart')
    const managerLi = (await screen.findByText('Dana Whitfield')).closest('li')!
    expect(within(managerLi).getByText('Priya Natarajan')).toBeInTheDocument()
    expect(within(managerLi).queryByText('Other Root')).not.toBeInTheDocument()
  })
})
