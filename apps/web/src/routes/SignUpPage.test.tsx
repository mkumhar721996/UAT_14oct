import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { TOKEN_KEY } from '../lib/auth'
import { errorResponse, mockApi, signIn } from '../test/helpers'
import ExpensesPage from './ExpensesPage'
import LogInPage from './LogInPage'
import SignUpPage from './SignUpPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const render = () =>
  rtlRender(
    <MemoryRouter initialEntries={['/signup']}>
      <ToastProvider>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LogInPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
const fill = (name: string, email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
const duplicate = () => errorResponse(409, 'An account with dana@example.com already exists. Log in instead.')

describe('SignUpPage', () => {
  it('AC1: shows name, email and password inputs', () => {
    render()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
  })

  it('AC2: creating an account signs in and shows Expenses', async () => {
    signIn('customer')
    const token = localStorage.getItem(TOKEN_KEY)!
    localStorage.clear()
    const api = mockApi({ 'POST /customers/signup': { email: 'dana@example.com', accessToken: token } })
    render()
    fill('Dana', 'dana@example.com', 'test-password')
    submit()
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(JSON.parse(api.mock.calls[0][1]!.body as string)).toEqual({ name: 'Dana', email: 'dana@example.com', password: 'test-password' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token)
  })

  it('AC3/AC4: the Log in link opens Log-in', async () => {
    render()
    const link = within(document.querySelector('.auth-switch') as HTMLElement).getByRole('link', { name: 'Log in' })
    fireEvent.click(link)
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('AC5-AC7: a registered email stays on Sign-up with an alert above the form and the email kept', async () => {
    mockApi({ 'POST /customers/signup': duplicate() })
    render()
    fill('Dana', 'dana@example.com', 'test-password')
    submit()
    const alert = await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(alert.compareDocumentPosition(screen.getByLabelText('Email')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByLabelText('Email')).toHaveValue('dana@example.com')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('AC8/AC9: the failure message links to Log-in', async () => {
    mockApi({ 'POST /customers/signup': duplicate() })
    render()
    fill('Dana', 'dana@example.com', 'test-password')
    submit()
    const alert = await screen.findByRole('alert')
    fireEvent.click(within(alert).getByRole('link', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it.each([
    ['name', ['', 'dana@example.com', 'test-password']],
    ['email', ['Dana', '', 'test-password']],
    ['password', ['Dana', 'dana@example.com', '']],
  ] as const)('AC12-AC15: an empty %s is rejected without calling the API', async (_field, [name, email, password]) => {
    const api = mockApi({})
    render()
    fill(name, email, password)
    submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(email)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(api).not.toHaveBeenCalled()
  })

  it('AC12-AC15: a rejected password shows the server message and keeps the email', async () => {
    mockApi({ 'POST /customers/signup': errorResponse(400, 'Choose a stronger password that meets the password requirements.') })
    render()
    fill('Dana', 'dana@example.com', 'test-password')
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a stronger password that meets the password requirements.')
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('dana@example.com')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
