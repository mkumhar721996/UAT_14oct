import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mockApi, signIn } from './test/helpers'

const employee = {
  id: 'u1', employeeNumber: 'EMP-1042', fullName: 'Alicia Gomez', startDate: '2022-03-14',
  jobTitle: 'Designer', department: 'Design', contractType: 'Full-time', salary: 1,
}
const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('App', () => {
  it('asks for sign-in when there is no session', () => {
    renderApp('/employees')
    expect(screen.getByText(/sign in required/i)).toBeInTheDocument()
  })

  it('AC1: a client-work page is publicly viewable without a session', async () => {
    mockApi({ 'GET /pages/client-work/p1': { title: 'Acme Redesign', body: '', heroImage: null, paragraphs: [] } })
    renderApp('/client-work/p1')
    expect(await screen.findByRole('heading', { name: 'Acme Redesign' })).toBeInTheDocument()
    expect(screen.queryByText(/sign in required/i)).not.toBeInTheDocument()
  })

  it.each(['/employees/new', '/employees/u1/edit', '/pending-changes'])(
    'AC3: a non-HR-Admin sees access restricted on %s and nothing is requested',
    (path) => {
      signIn('employee', 'u2')
      const api = mockApi({})
      renderApp(path)
      expect(screen.getByText('Access restricted')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
      expect(api.mock.calls.filter(([, i]) => i?.method && i.method !== 'GET')).toHaveLength(0)
    },
  )

  it.each(['/employees', '/employees/new', '/defects/new', '/me', '/pending-changes', '/nowhere'])(
    'AC4: a logged-in customer sees Access denied on %s and nothing is requested',
    (path) => {
      signIn('customer')
      const api = mockApi({})
      renderApp(path)
      expect(screen.getByText('Access denied')).toBeInTheDocument()
      expect(api).not.toHaveBeenCalled()
    },
  )

  it('a customer lands on My account', async () => {
    signIn('customer')
    mockApi({ 'GET /customers/me/bookings': [] })
    renderApp('/account')
    expect(await screen.findByText('My account')).toBeInTheDocument()
  })

  it('visitors can reach the sign-up and log-in pages', () => {
    renderApp('/signup')
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('AC2/AC13: editing a core field requires an effective date, then saves it', async () => {
    signIn('hr_admin')
    const api = mockApi({
      'GET /employees/u1': employee,
      'GET /employees/u1/history': [],
      'GET /pending-change-requests': [],
      'PATCH /employees/u1': { ...employee, jobTitle: 'Lead' },
    })
    renderApp('/employees/u1/edit')
    const title = await screen.findByLabelText('Job title')
    expect(screen.queryByLabelText(/effective date for job title/i)).not.toBeInTheDocument()
    fireEvent.change(title, { target: { value: 'Lead' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Enter an effective date for this change.')).toBeInTheDocument()
    expect(api.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false)

    fireEvent.change(screen.getByLabelText(/effective date for job title/i), { target: { value: '2026-02-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(api.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true))
    const patch = api.mock.calls.find(([, i]) => i?.method === 'PATCH')!
    expect(JSON.parse(patch[1]!.body as string)).toMatchObject({ jobTitle: 'Lead', jobTitleEffectiveDate: '2026-02-01' })
  })

  it('AC12: a core change from My profile is a request, shown as pending', async () => {
    signIn('employee', 'u1')
    const api = mockApi({
      'GET /employees/me': employee,
      'GET /employees/me/change-requests': [
        { id: 'r1', employeeId: 'u1', field: 'jobTitle', requestedValue: 'Director', effectiveDate: '2026-12-01', note: null, submittedAt: '2026-10-12T15:40:00Z' },
      ],
    })
    renderApp('/me')
    expect(await screen.findByText('Pending HR approval')).toBeInTheDocument()
    expect(screen.getByText('Designer')).toBeInTheDocument()
    expect(api.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false)
  })
})
