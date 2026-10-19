import { fireEvent, screen, waitFor } from '@testing-library/react'
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
