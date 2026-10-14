import { useState } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { CORE_FIELD_LABELS } from '../lib/fields'
import { fmtDate, fmtDateTime, fmtFieldValue } from '../lib/format'
import type { ChangeRequest, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function PendingChangesPage() {
  const toast = useToast()
  const [rejecting, setRejecting] = useState<ChangeRequest | null>(null)
  const { data, error, reload } = useAsync(async () => {
    const [requests, employees] = await Promise.all([
      apiClient.get<ChangeRequest[]>('/pending-change-requests'),
      apiClient.get<Employee[]>('/employees'),
    ])
    return { requests, byId: new Map(employees.map((e) => [e.id, e])) }
  })

  async function resolve(r: ChangeRequest, action: 'approve' | 'reject') {
    const name = data?.byId.get(r.employeeId)?.fullName ?? 'The employee'
    const label = CORE_FIELD_LABELS[r.field].toLowerCase()
    try {
      await apiClient.post(`/pending-change-requests/${r.id}/${action}`)
      if (action === 'approve') toast(`Approved. ${name}'s ${label} is now ${fmtFieldValue(r.field, r.requestedValue)}.`)
      else toast(`Rejected. No changes were made to ${name}'s profile.`, true)
    } catch (err) {
      toast((err as Error).message, true)
    }
    setRejecting(null)
    reload()
  }

  const rejectedName = rejecting && (data?.byId.get(rejecting.employeeId)?.fullName ?? 'The employee')

  return (
    <Layout title="Pending changes" crumbs={[{ label: 'Requests awaiting HR Admin approval' }]}>
      {error ? (
        <Banner kind="danger" title="Couldn't load pending changes">
          {error.message}
        </Banner>
      ) : data && data.requests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="glyph" aria-hidden="true">&#9989;</div>
            <p>
              <strong>No pending changes</strong>
            </p>
            <p className="text-muted">
              When an employee requests a change to their job title, department, contract type or salary, it will appear here for
              your review.
            </p>
          </div>
        </div>
      ) : data ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Field</th>
                <th>Current → Requested</th>
                <th>Effective date</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => {
                const emp = data.byId.get(r.employeeId)
                return (
                  <tr className="pending-row" key={r.id}>
                    <td>{emp?.fullName ?? r.employeeId}</td>
                    <td>{CORE_FIELD_LABELS[r.field]}</td>
                    <td>
                      {(emp && fmtFieldValue(r.field, emp[r.field])) ?? '—'} &rarr; {fmtFieldValue(r.field, r.requestedValue)}
                    </td>
                    <td>{fmtDate(r.effectiveDate)}</td>
                    <td className="text-muted">{fmtDateTime(r.submittedAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-primary" onClick={() => resolve(r, 'approve')}>
                        Approve
                      </button>{' '}
                      <button className="btn btn-secondary" onClick={() => setRejecting(r)}>
                        Reject
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {rejecting && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRejecting(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reject-title">
            <h3 id="reject-title">Reject this change?</h3>
            <p>
              {rejectedName} will keep their current {CORE_FIELD_LABELS[rejecting.field].toLowerCase()}. This can't be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: 'var(--color-danger)' }} onClick={() => resolve(rejecting, 'reject')}>
                Reject change
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
