import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '../components/Toast'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_KEY } from '../lib/auth'
import { errorResponse, mockApi, renderAt } from '../test/helpers'
import LogInPage from './LogInPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const render = () => renderAt(<LogInPage />, '/login', '/login')
const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

describe('LogInPage', () => {
  it('AC2: a successful login stores the token', async () => {
    const api = mockApi({ 'POST /customers/login': { accessToken: 'fake-token-1' } })
    render()
    fill('dana@example.com', 'test-password')
    submit()
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe('fake-token-1'))
    expect(JSON.parse(api.mock.calls[0][1]!.body as string)).toEqual({ email: 'dana@example.com', password: 'test-password' })
  })

  it('AC3: wrong credentials show the generic error and store no token', async () => {
    mockApi({ 'POST /customers/login': errorResponse(401, 'ignored server text') })
    render()
    fill('dana@example.com', 'wrong-password')
    submit()
    expect(await screen.findByText(/that email and password don't match/i)).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

const Landed = () => <p>landed on {useLocation().pathname}</p>

describe('LogInPage post-login destination', () => {
  const loginWithNext = async (next: string) => {
    mockApi({ 'POST /customers/login': { accessToken: 'fake-token-1' } })
    rtlRender(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { next } }]}>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LogInPage />} />
            <Route path="*" element={<Landed />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    )
    fill('dana@example.com', 'test-password')
    submit()
  }

  it('goes to /expenses when next is /expenses', async () => {
    await loginWithNext('/expenses')
    expect(await screen.findByText('landed on /expenses')).toBeInTheDocument()
  })

  it('ignores a next destination outside /expenses', async () => {
    await loginWithNext('https://evil.example')
    expect(await screen.findByText('landed on /account')).toBeInTheDocument()
  })
})
