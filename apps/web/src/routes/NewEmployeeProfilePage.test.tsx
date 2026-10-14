import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import NewEmployeeProfilePage from './NewEmployeeProfilePage'

const saved = {
  id: 'u9', employeeNumber: 'EMP-1045', fullName: 'Min Viable', startDate: '2026-01-01',
  jobTitle: null, department: null, contractType: null, salary: null,
}

describe('NewEmployeeProfilePage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('hr_admin')
    api = mockApi({ 'POST /employees': saved, 'GET /pending-change-requests': [] })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const posts = () => api.mock.calls.filter(([, init]) => init?.method === 'POST' && init.body && !String(init.body).includes('field'))

  it.each([
    ['full name', /start date/i, '2026-01-01', 'Enter the employee\'s full name.'],
    ['start date', /full name/i, 'Jordan Lee', 'Enter a start date.'],
  ])('AC7: does not save when %s is missing', async (_n, label, value, error) => {
    renderAt(<NewEmployeeProfilePage />, '/employees/new', '/employees/new')
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    expect(await screen.findByText(error)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  it('AC8/AC9: saves with only name and start date and shows the generated ID', async () => {
    renderAt(<NewEmployeeProfilePage />, '/employees/new', '/employees/new')
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Min Viable' } })
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    expect((await screen.findAllByText('EMP-1045')).length).toBeGreaterThan(0)
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ fullName: 'Min Viable', startDate: '2026-01-01' })
  })
})
