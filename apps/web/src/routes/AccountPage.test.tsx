import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import AccountPage from './AccountPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const booking = { id: 'bk-0', serviceType: 'Drain cleaning', status: 'Requested', createdAt: '2026-10-12T10:00:00Z' }
const render = () => renderAt(<AccountPage />, '/account', '/account')

describe('AccountPage', () => {
  it('AC5: submitting a booking posts it for the signed-in account and lists it', async () => {
    signIn('customer')
    let bookings: unknown[] = []
    const api = mockApi({
      'GET /customers/me/bookings': () => bookings,
      'POST /customers/me/bookings': () => {
        bookings = [{ ...booking, id: 'bk-1', serviceType: 'Faucet repair' }]
        return bookings[0]
      },
    })
    render()
    expect(await screen.findByText(/no bookings yet/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/service type/i), { target: { value: 'Faucet repair' } })
    fireEvent.click(screen.getByRole('button', { name: /request service/i }))
    expect(await screen.findByRole('cell', { name: 'Faucet repair' })).toBeInTheDocument()
    const post = api.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ serviceType: 'Faucet repair' })
  })

  it('AC6: a booking already on the account is listed on load (post logout/login)', async () => {
    signIn('customer')
    mockApi({ 'GET /customers/me/bookings': [booking] })
    render()
    expect(await screen.findByRole('cell', { name: 'Drain cleaning' })).toBeInTheDocument()
    expect(screen.getByText('Requested')).toBeInTheDocument()
  })

  it('Log out clears the stored token', async () => {
    signIn('customer')
    mockApi({ 'GET /customers/me/bookings': [] })
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(localStorage.getItem('arc.accessToken')).toBeNull()
  })
})
