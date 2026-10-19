import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { getCustomerEmail } from '../lib/auth'
import { fmtDate } from '../lib/format'
import type { Booking } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const SERVICE_TYPES = ['Faucet repair', 'Drain cleaning', 'Water heater install', 'AC tune-up']

const statusChip = (status: string) =>
  status === 'Completed' ? 'chip-success' : status === 'Cancelled' ? 'chip-danger' : 'chip-warning'

export default function AccountPage() {
  const toast = useToast()
  const email = getCustomerEmail()
  const { data, error, reload } = useAsync(() => apiClient.get<Booking[]>('/customers/me/bookings'))
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0])
  const [submitting, setSubmitting] = useState(false)

  const requestService = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiClient.post('/customers/me/bookings', { serviceType })
      toast('Booking requested')
      reload()
    } catch {
      toast('Could not request the service. Try again.', true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <CustomerHeader />
      <main className="account-page">
        <div className="card">
          <h1 className="card-title">My account</h1>
          <p className="card-body">
            Signed in{email && (
              <>
                {' '}as <strong>{email}</strong>
              </>
            )}
            .
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--font-size-md)' }}>
            Your bookings
          </h2>
          {error ? (
            <p className="field-error" role="alert">
              Could not load your bookings. Try again.
            </p>
          ) : data && data.length === 0 ? (
            <div className="bookings-empty">
              <Icon name="calendar" />
              <p>No bookings yet. Request a service below to get started.</p>
            </div>
          ) : data ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id}>
                    <td>{b.serviceType}</td>
                    <td>{fmtDate(b.createdAt)}</td>
                    <td>
                      <span className={`chip ${statusChip(b.status)}`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--font-size-md)' }}>
            Request a service
          </h2>
          <p className="text-muted" style={{ marginTop: 'calc(-1 * var(--space-2))', marginBottom: 'var(--space-3)' }}>
            A quick way to try it here. The full request form (address, timing, urgency) lives in its own flow.
          </p>
          <form onSubmit={requestService}>
            <div className="quick-booking-row">
              <div className="field">
                <label className="field-label" htmlFor="booking-service">
                  Service type
                </label>
                <select id="booking-service" className="select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Requesting…' : 'Request service'}
              </button>
            </div>
          </form>
        </div>

        <div className="card admin-preview-card">
          <div>
            <strong>Admin dashboard</strong>
            <p className="text-muted" style={{ margin: 'var(--space-1) 0 0 0' }}>
              Admin and technician accounts only.
            </p>
          </div>
          <Link className="btn btn-secondary" to="/employees">
            Try an admin page
          </Link>
        </div>
      </main>
    </>
  )
}
