import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ActiveGrid } from '../components/ActiveGrid'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { CORE_FIELD_LABELS, EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS } from '../lib/fields'
import { fmtDate, fmtDateTime, fmtFieldValue } from '../lib/format'
import type { ChangeRequest, Employee, EmployeeStatus, HistoryEntry } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function EmployeeProfileDetailPage() {
  const { id = '' } = useParams()
  const isHr = useAuth()?.role === 'hr_admin'
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const { data, error, loading, reload } = useAsync(async () => {
    const [employee, history, pending] = await Promise.all([
      apiClient.get<Employee>(`/employees/${id}`),
      apiClient.get<HistoryEntry[]>(`/employees/${id}/history`),
      isHr ? apiClient.get<ChangeRequest[]>('/pending-change-requests') : Promise.resolve([] as ChangeRequest[]),
    ])
    return { employee, history, pending: pending.filter((r) => r.employeeId === id) }
  })
  const employee = data?.employee
  const terminated = employee?.status === 'terminated'

  async function changeStatus(status: EmployeeStatus) {
    if (status === employee?.status) return
    setSaving(true)
    try {
      await apiClient.patch(`/employees/${id}/status`, { status })
      reload()
    } catch (err) {
      toast((err as Error).message, true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout
      title={employee?.fullName ?? 'Employee profile'}
      crumbs={[{ label: 'Employees', to: '/employees' }, { label: employee?.fullName ?? '…' }]}
      actions={
        terminated ? (
          isHr && (
            <Link className="btn btn-primary" to={`/employees/${id}/rehire`}>
              Create rehire
            </Link>
          )
        ) : isHr ? (
          <Link className="btn btn-primary" to={`/employees/${id}/edit`}>
            Edit profile
          </Link>
        ) : (
          <button className="btn btn-primary" disabled title="Requires HR Admin role">
            Edit profile
          </button>
        )
      }
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load this profile">
          {error.message}
        </Banner>
      ) : loading || !data || !employee ? (
        <div className="card" style={{ maxWidth: 720 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18, marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', marginBottom: 'var(--space-2)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        </div>
      ) : (
        <>
          {!isHr && (
            <Banner kind="warning" title="Read-only for your role">
              Only HR Admins can edit this profile.
            </Banner>
          )}
          {data.pending.map((r) => (
            <Banner key={r.id} kind="warning" title={`${CORE_FIELD_LABELS[r.field]} change pending`}>
              Requested change to "{fmtFieldValue(r.field, r.requestedValue)}" effective {fmtDate(r.effectiveDate)} is awaiting HR
              Admin approval in <Link to="/pending-changes">Pending changes</Link>. The current value stays active until approved.
            </Banner>
          ))}
          <div className="card" style={{ maxWidth: 720, marginBottom: 'var(--space-4)' }}>
            <h3 className="card-title">Core profile</h3>
            <div className="readonly-row">
              <span className="readonly-label">Employee ID</span>
              <span className="readonly-value mono">{employee.employeeNumber}</span>
            </div>
            <div className="readonly-row">
              <span className="readonly-label">Full name</span>
              <span className="readonly-value">{employee.fullName}</span>
            </div>
            <div className="readonly-row">
              <span className="readonly-label">Start date</span>
              <span className="readonly-value">{fmtDate(employee.startDate)}</span>
            </div>
            <div className="readonly-row">
              <label className="readonly-label" htmlFor="employee-status">
                Status
              </label>
              {isHr && !terminated ? (
                <select
                  className="select"
                  id="employee-status"
                  value={employee.status}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value as EmployeeStatus)}
                >
                  {EMPLOYEE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {EMPLOYEE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="readonly-value">{EMPLOYEE_STATUS_LABELS[employee.status]}</span>
              )}
            </div>
            {employee.personalEmail !== undefined && (
              <>
                <div className="readonly-row">
                  <span className="readonly-label">Personal email</span>
                  <span className={'readonly-value' + (employee.personalEmail ? '' : ' muted')}>{employee.personalEmail || 'Not set'}</span>
                </div>
                <div className="readonly-row">
                  <span className="readonly-label">Phone</span>
                  <span className={'readonly-value' + (employee.phone ? '' : ' muted')}>{employee.phone || 'Not set'}</span>
                </div>
              </>
            )}
            <div className="section-heading" style={{ marginTop: 'var(--space-4)' }}>
              <h4 className="heading-lg" style={{ fontSize: 'var(--font-size-md)' }}>
                Active now
              </h4>
            </div>
            <ActiveGrid employee={employee} />
          </div>

          <div className="card" style={{ maxWidth: 720 }}>
            <div className="section-heading">
              <h3 className="card-title" style={{ margin: 0 }}>
                Employment history
              </h3>
              <span className="text-muted">Oldest to newest</span>
            </div>
            {data.history.length === 0 ? (
              <div className="empty-state">
                <div className="glyph" aria-hidden="true">&#128196;</div>
                <p>
                  <strong>No history yet</strong>
                </p>
                <p className="text-muted">
                  Changes to job title, department, contract type or salary will appear here, dated and timestamped.
                </p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Previous value</th>
                    <th>New value</th>
                    <th>Effective date</th>
                    <th>Recorded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id}>
                      <td>{CORE_FIELD_LABELS[h.field]}</td>
                      <td>{fmtFieldValue(h.field, h.previousValue) ?? '—'}</td>
                      <td>{fmtFieldValue(h.field, h.newValue) ?? '—'}</td>
                      <td>{fmtDate(h.effectiveDate)}</td>
                      <td className="text-muted">{fmtDateTime(h.recordedAt)}</td>
                      <td className="history-actions-col">No edit or delete</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
