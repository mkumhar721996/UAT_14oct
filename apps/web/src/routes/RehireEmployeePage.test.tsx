import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import RehireEmployeePage from './RehireEmployeePage'

const terminated = {
  id: 'u1', employeeNumber: 'EMP-1042', fullName: 'Alicia Gomez', startDate: '2022-03-14', status: 'terminated',
  jobTitle: 'Designer', department: 'Design', contractType: 'Full-time', salary: 118000,
}
const rehired = { ...terminated, id: 'u2', employeeNumber: 'EMP-1050', status: 'active', rehiredFromId: 'u1' }

describe('RehireEmployeePage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('hr_admin')
    api = mockApi({ 'GET /employees/u1': terminated, 'POST /employees/u1/rehire': rehired, 'GET /employees/u2': rehired })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const posts = () => api.mock.calls.filter(([, init]) => init?.method === 'POST')
  const renderPage = () => {
    renderAt(
      <Routes>
        <Route path="/employees/:id/rehire" element={<RehireEmployeePage />} />
        <Route path="/employees/:id" element={<div>new profile page</div>} />
      </Routes>,
      '/employees/u1/rehire',
      '/*',
    )
  }

  it('AC10-AC12: submitting only a start date POSTs it and navigates to the new record', async () => {
    renderPage()
    expect(await screen.findByText('EMP-1042')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: /create rehire/i }))
    expect(await screen.findByText('new profile page')).toBeInTheDocument()
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ startDate: '2026-06-01' })
    expect(posts()[0][0]).toBe('/employees/u1/rehire')
  })

  it('does not POST when the start date is missing', async () => {
    renderPage()
    await screen.findByText('EMP-1042')
    fireEvent.click(screen.getByRole('button', { name: /create rehire/i }))
    expect(await screen.findByText('Enter a start date.')).toBeInTheDocument()
    await waitFor(() => expect(posts()).toHaveLength(0))
  })
})
