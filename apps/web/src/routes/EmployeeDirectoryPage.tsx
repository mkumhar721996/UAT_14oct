import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { EMPLOYEE_STATUS_LABELS } from '../lib/fields'
import type { ChangeRequest, Employee, EmployeeStatus } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const STATUS_CHIP_CLASS: Record<EmployeeStatus, string> = {
  active: 'chip-success',
  on_leave: 'chip-warning',
  terminated: 'chip-danger',
}

export default function EmployeeDirectoryPage() {
  const auth = useAuth()
  const isHr = auth?.role === 'hr_admin'
  const [filter, setFilter] = useState('')
  const { data, error, loading, reload } = useAsync(async () => {
    const [employees, pending] = await Promise.all([
      apiClient.get<Employee[]>('/employees'),
      isHr ? apiClient.get<ChangeRequest[]>('/pending-change-requests') : Promise.resolve([] as ChangeRequest[]),
    ])
    return { employees, pendingIds: new Set(pending.map((r) => r.employeeId)) }
  })

  const q = filter.trim().toLowerCase()
  const rows = (data?.employees ?? []).filter(
    (e) =>
      !q ||
      e.fullName.toLowerCase().includes(q) ||
      e.employeeNumber.toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q),
  )

  return (
    <Layout
      title="Employees"
      crumbs={[{ label: 'HR Admin console' }]}
      actions={
        isHr ? (
          <Link className="btn btn-primary" to="/employees/new">
            + New employee
          </Link>
        ) : (
          <button className="btn btn-primary" disabled title="Requires HR Admin role">
            + New employee
          </button>
        )
      }
    >
      {!isHr && (
        <Banner kind="warning" title="Viewing with limited access">
          Only HR Admins can create or edit employee profiles. You can still browse the directory.
        </Banner>
      )}
      <div className="search-row">
        <input
          className="input"
          type="search"
          aria-label="Search employees"
          placeholder="Search name, ID or department"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {error ? (
        <>
          <Banner kind="danger" title="Couldn't load employees">
            The directory service didn't respond in time. Check your connection and try again.
          </Banner>
          <button className="btn btn-secondary" onClick={reload}>
            Retry
          </button>
        </>
      ) : !loading && rows.length === 0 ? (
        <div className="empty-state">
          <div className="glyph" aria-hidden="true">&#128269;</div>
          {q ? (
            <>
              <p>
                <strong>No employees match "{filter}"</strong>
              </p>
              <p className="text-muted">Try a different name, employee ID or department.</p>
            </>
          ) : (
            <p>
              <strong>No employees yet</strong>
            </p>
          )}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Job title</th>
              <th>Department</th>
              <th>Contract type</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr className="skeleton-row" key={i} aria-hidden="true">
                    {[70, 120, 140, 100, 80, 60].map((w) => (
                      <td key={w}>
                        <div className="skeleton skeleton-line" style={{ width: w }} />
                      </td>
                    ))}
                    <td></td>
                  </tr>
                ))
              : rows.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{e.employeeNumber}</td>
                    <td>{e.fullName}</td>
                    <td>{e.jobTitle || '—'}</td>
                    <td>{e.department || '—'}</td>
                    <td>{e.contractType || '—'}</td>
                    <td>
                      {data?.pendingIds.has(e.id) ? (
                        <span className="chip chip-warning">Change pending</span>
                      ) : (
                        <span className={`chip ${STATUS_CHIP_CLASS[e.status]}`}>{EMPLOYEE_STATUS_LABELS[e.status]}</span>
                      )}
                    </td>
                    <td>
                      <Link className="btn btn-secondary" to={`/employees/${e.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
