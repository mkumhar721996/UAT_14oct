import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import EmployeeProfileDetailPage from './EmployeeProfileDetailPage'

const employee = {
  id: 'u1', employeeNumber: 'EMP-1042', fullName: 'Alicia Gomez', startDate: '2022-03-14',
  jobTitle: 'Senior Product Designer', department: 'Design', contractType: 'Full-time', salary: 118000,
}
const history = [
  { id: 'h1', field: 'jobTitle', previousValue: null, newValue: 'Product Designer', effectiveDate: '2022-03-14', recordedAt: '2022-03-10T14:05:00Z' },
  { id: 'h2', field: 'salary', previousValue: '98000', newValue: '118000', effectiveDate: '2025-01-01', recordedAt: '2024-12-15T10:00:00Z' },
]

describe('EmployeeProfileDetailPage', () => {
  beforeEach(() => {
    signIn('hr_admin')
    mockApi({ 'GET /employees/u1': employee, 'GET /employees/u1/history': history, 'GET /pending-change-requests': [] })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('AC10: shows the employee ID as text with no edit control', async () => {
    renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
    expect(await screen.findByText('EMP-1042')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /employee id/i })).not.toBeInTheDocument()
  })

  it('AC6: shows the active value of each core field', async () => {
    renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
    const active = (await screen.findByText('Active now')).closest('div')!.parentElement!
    expect(within(active).getByText('Senior Product Designer')).toBeInTheDocument()
    expect(within(active).getByText('$118,000')).toBeInTheDocument()
  })

  it('AC5/AC13/AC14: lists history in order with effective date and recorded time, and no edit/delete controls', async () => {
    renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('Product Designer')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Mar 14, 2022')).toBeInTheDocument()
    expect(within(rows[2]).getByText('$118,000')).toBeInTheDocument()
    expect(screen.getAllByText('No edit or delete')).toHaveLength(2)
    const table = screen.getByRole('table')
    expect(within(table).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: /edit|delete/i })).not.toBeInTheDocument()
  })
})
