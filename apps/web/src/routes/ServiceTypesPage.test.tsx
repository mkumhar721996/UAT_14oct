import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { errorResponse, mockApi, renderAt, signIn } from '../test/helpers'
import ServiceTypesPage from './ServiceTypesPage'

const faucet = { id: 's1', name: 'Faucet repair', description: 'Fix leaky or broken faucets.', active: true }
const drain = { id: 's2', name: 'Drain cleaning', description: null, active: false }
const render = () => renderAt(<ServiceTypesPage />, '/service-types', '/service-types')
const calls = (api: ReturnType<typeof mockApi>, method: string) => api.mock.calls.filter(([, i]) => i?.method === method)

describe('ServiceTypesPage', () => {
  beforeEach(() => {
    localStorage.clear()
    signIn('admin')
  })

  it('AC1: submitting the new form posts the trimmed body', async () => {
    const api = mockApi({ 'GET /service-types': [], 'POST /service-types': faucet })
    render()
    fireEvent.click(await screen.findByRole('button', { name: /new service type/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Faucet repair ' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Fix leaky or broken faucets.' } })
    fireEvent.click(screen.getByRole('button', { name: /save service type/i }))
    expect(await screen.findByText('Service type created')).toBeInTheDocument()
    expect(JSON.parse(calls(api, 'POST')[0][1]!.body as string)).toEqual({ name: 'Faucet repair', description: 'Fix leaky or broken faucets.' })
  })

  it('AC2/AC3: editing patches name and description', async () => {
    const api = mockApi({ 'GET /service-types': [faucet], 'PATCH /service-types/s1': faucet })
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Faucet fixing' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New copy' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Service type updated')).toBeInTheDocument()
    expect(JSON.parse(calls(api, 'PATCH')[0][1]!.body as string)).toEqual({ name: 'Faucet fixing', description: 'New copy' })
  })

  it('an empty name shows the inline error and makes no request', async () => {
    const api = mockApi({ 'GET /service-types': [] })
    render()
    fireEvent.click(await screen.findByRole('button', { name: /new service type/i }))
    fireEvent.click(screen.getByRole('button', { name: /save service type/i }))
    expect(await screen.findByText('Enter a name for this service type.')).toBeInTheDocument()
    expect(calls(api, 'POST')).toHaveLength(0)
  })

  it('a 409 is shown next to the name field and the modal stays open', async () => {
    mockApi({ 'GET /service-types': [faucet], 'POST /service-types': errorResponse(409, 'Another service type already uses this name.') })
    render()
    fireEvent.click(await screen.findByRole('button', { name: /new service type/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'faucet repair' } })
    fireEvent.click(screen.getByRole('button', { name: /save service type/i }))
    expect(await screen.findByText('Another service type already uses this name.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('AC4: deactivate asks for confirmation, then flips the chip', async () => {
    let active = true
    const api = mockApi({
      'GET /service-types': () => [{ ...faucet, active }],
      'PATCH /service-types/s1/status': () => {
        active = false
        return { ...faucet, active }
      },
    })
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    expect(screen.getByText(/will no longer be listed to customers when booking/i)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[1])
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
    expect(JSON.parse(calls(api, 'PATCH')[0][1]!.body as string)).toEqual({ active: false })
  })

  it('AC6: activate is immediate with no confirmation', async () => {
    let active = false
    mockApi({
      'GET /service-types': () => [{ ...drain, active }],
      'PATCH /service-types/s2/status': () => {
        active = true
        return { ...drain, active }
      },
    })
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('search filters rows and the no-matches state can be cleared', async () => {
    mockApi({ 'GET /service-types': [faucet, drain] })
    render()
    const search = await screen.findByLabelText(/search service types/i)
    fireEvent.change(search, { target: { value: 'drain' } })
    expect(screen.queryByText('Faucet repair')).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(await screen.findByText(/no service types match/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(await screen.findByText('Faucet repair')).toBeInTheDocument()
  })

  it('AC7: an empty catalog shows the "none yet" state, not "no matches"', async () => {
    mockApi({ 'GET /service-types': [] })
    render()
    expect(await screen.findByText(/no service types yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/no service types match/i)).not.toBeInTheDocument()
  })

  it('a failed load shows an error with Retry', async () => {
    mockApi({})
    render()
    expect(await screen.findByText(/couldn't load service types/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renders markup-like names as literal text', async () => {
    mockApi({ 'GET /service-types': [{ ...faucet, name: '<img src=x onerror=alert(1)>' }] })
    render()
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })
})
