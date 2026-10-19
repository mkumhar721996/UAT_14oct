import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, mockApi, renderAt } from '../test/helpers'
import SignUpPage from './SignUpPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const render = () => renderAt(<SignUpPage />, '/signup', '/signup')
const fill = (email: string, password: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

describe('SignUpPage', () => {
  it('AC1: submits email+password and shows the success state', async () => {
    const api = mockApi({ 'POST /customers/signup': {} })
    render()
    fill('dana@example.com', 'test-password', 'test-password')
    submit()
    expect(await screen.findByRole('heading', { name: 'Account created' })).toBeInTheDocument()
    expect(JSON.parse(api.mock.calls[0][1]!.body as string)).toEqual({ email: 'dana@example.com', password: 'test-password' })
    expect(screen.getByRole('button', { name: 'Continue to log in' })).toBeInTheDocument()
  })

  it('AC1: invalid input shows field errors and calls nothing', () => {
    const api = mockApi({})
    render()
    fill('not-an-email', 'short', 'different')
    submit()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  it('AC1: a password rejected by the password policy shows the server message', async () => {
    mockApi({ 'POST /customers/signup': errorResponse(400, 'Choose a stronger password that meets the password requirements.') })
    render()
    fill('dana@example.com', 'test-password', 'test-password')
    submit()
    expect(await screen.findByText('Choose a stronger password that meets the password requirements.')).toBeInTheDocument()
  })

  it('AC1: an already-registered email shows the log-in-instead alert', async () => {
    mockApi({ 'POST /customers/signup': errorResponse(409, 'An account with dana@example.com already exists. Log in instead.') })
    render()
    fill('dana@example.com', 'test-password', 'test-password')
    submit()
    expect(await screen.findByText('An account with dana@example.com already exists. Log in instead.')).toBeInTheDocument()
    expect(screen.queryByText('Account created')).not.toBeInTheDocument()
  })
})
