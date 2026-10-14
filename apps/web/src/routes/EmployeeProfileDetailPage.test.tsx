import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

  describe('lifecycle status', () => {
    const withStatus = (status: string) => ({ ...employee, status })

    it('AC1: the status select offers exactly Active, On leave and Terminated', async () => {
      mockApi({ 'GET /employees/u1': withStatus('active'), 'GET /employees/u1/history': history, 'GET /pending-change-requests': [] })
      renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
      const select = await screen.findByLabelText(/status/i)
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Active', 'On leave', 'Terminated'])
    })

    it.each([
      ['active', 'on_leave'],
      ['on_leave', 'active'],
      ['active', 'terminated'],
    ])('AC2-AC4: changing %s to %s PATCHes and shows the new status', async (from, to) => {
      let current = from
      const api = mockApi({
        'GET /employees/u1': () => withStatus(current),
        'GET /employees/u1/history': history,
        'GET /pending-change-requests': [],
        'PATCH /employees/u1/status': (init?: RequestInit) => {
          current = JSON.parse(init!.body as string).status
          return withStatus(current)
        },
      })
      renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
      const select = (await screen.findByLabelText(/status/i)) as HTMLSelectElement
      expect(select.value).toBe(from)
      fireEvent.change(select, { target: { value: to } })
      if (to === 'terminated') {
        // A terminated record is read-only, so the select is replaced by the status text.
        await waitFor(() => expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument())
        expect(screen.getByText('Terminated')).toBeInTheDocument()
      } else {
        await waitFor(() => expect((screen.getByLabelText(/status/i) as HTMLSelectElement).value).toBe(to))
      }
      const patch = api.mock.calls.find(([, init]) => init?.method === 'PATCH')!
      expect(JSON.parse(patch[1]!.body as string)).toEqual({ status: to })
    })

    it('re-selecting the current status is a no-op that still succeeds', async () => {
      const api = mockApi({
        'GET /employees/u1': withStatus('active'),
        'GET /employees/u1/history': history,
        'GET /pending-change-requests': [],
        'PATCH /employees/u1/status': withStatus('active'),
      })
      renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
      const select = (await screen.findByLabelText(/status/i)) as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'active' } })
      expect(select.value).toBe('active')
      expect(screen.queryByText(/couldn't/i)).not.toBeInTheDocument()
      expect(api.mock.calls.filter(([, init]) => init?.method === 'PATCH').length).toBe(0)
    })

    it('AC8/AC9: a terminated employee shows no edit control, a rehire link, and keeps its data', async () => {
      mockApi({ 'GET /employees/u1': withStatus('terminated'), 'GET /employees/u1/history': history, 'GET /pending-change-requests': [] })
      renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
      expect((await screen.findAllByText('Alicia Gomez')).length).toBeGreaterThan(0)
      expect(screen.getByText('EMP-1042')).toBeInTheDocument()
      expect(screen.getAllByText('$118,000').length).toBeGreaterThan(0)
      expect(screen.queryByRole('link', { name: /edit profile/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /create rehire/i })).toHaveAttribute('href', '/employees/u1/rehire')
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument()
      expect(screen.getByText('Terminated')).toBeInTheDocument()
    })

    it('shows the status as read-only text to non-HR viewers', async () => {
      localStorage.clear()
      signIn('employee')
      mockApi({ 'GET /employees/u1': withStatus('on_leave'), 'GET /employees/u1/history': history })
      renderAt(<EmployeeProfileDetailPage />, '/employees/u1', '/employees/:id')
      expect(await screen.findByText('On leave')).toBeInTheDocument()
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument()
    })
  })
})
