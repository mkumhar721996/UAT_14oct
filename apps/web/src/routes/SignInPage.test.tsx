import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { TOKEN_KEY } from '../lib/auth'
import { errorResponse, mockApi } from '../test/helpers'
import SignInPage from './SignInPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const MISMATCH = "That email and password don't match. Check your details and try again."

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={['/signin']}>
      <ToastProvider>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/expenses" element={<h1>Expenses</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

describe('SignInPage', () => {
  it('AC1: shows an email input and a password input', () => {
    renderSignIn()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('AC2: valid credentials land in Expenses', async () => {
    mockApi({ 'POST /customers/login': { accessToken: 'fake-token-1' } })
    renderSignIn()
    fill('dana@example.com', 'test-password')
    submit()
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fake-token-1')
  })

  describe.each([
    ['unknown email', 'nobody@example.com'],
    ['wrong password', 'dana@example.com'],
  ])('wrong credentials (%s)', (_name, email) => {
    const failSignIn = async () => {
      mockApi({ 'POST /customers/login': errorResponse(401, 'ignored server text') })
      renderSignIn()
      fill(email, 'wrong-password')
      submit()
      return screen.findByRole('alert')
    }

    it('AC3: shows a failure message above the form', async () => {
      const alert = await failSignIn()
      const form = document.querySelector('form')!
      expect(alert.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('AC4: the message does not say which field was wrong', async () => {
      const alert = await failSignIn()
      expect(alert.textContent).toBe(MISMATCH)
    })

    it('AC5: the user remains on Sign-in', async () => {
      await failSignIn()
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Expenses' })).toBeNull()
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    })

    it('AC6: the email input keeps the entered email', async () => {
      await failSignIn()
      expect(screen.getByLabelText('Email')).toHaveValue(email)
    })
  })

  it.each([
    ['email', '', 'test-password'],
    ['password', 'dana@example.com', ''],
  ])('AC9/AC10: an empty %s shows a message, makes no request and stays on Sign-in', async (_name, email, password) => {
    const api = mockApi({})
    renderSignIn()
    fill(email, password)
    submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Expenses' })).toBeNull()
  })
})
