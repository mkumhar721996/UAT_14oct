import { useState, type FormEvent } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { selfAndReportIds } from '../lib/orgTree'
import type { Department, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function EmployeesManagersPage() {
  const toast = useToast()
  const [editing, setEditing] = useState<Employee | null>(null)
  const { data, error, reload } = useAsync(async () => {
    const [employees, departments] = await Promise.all([
      apiClient.get<Employee[]>('/employees'),
      apiClient.get<Department[]>('/departments'),
    ])
    return { employees, departments }
  })
  const employees = data?.employees ?? []
  const byId = new Map(employees.map((e) => [e.id, e]))

  return (
    <Layout title="Employees & managers" crumbs={[{ label: "Assign each employee's single reporting manager" }]}>
      {error ? (
        <Banner kind="danger" title="Couldn't load employees">
          {error.message}
        </Banner>
      ) : data ? (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Title</th>
                <th>Department</th>
                <th>Manager</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.fullName}</td>
                  <td>{e.jobTitle ?? '—'}</td>
                  <td>{data.departments.find((d) => d.id === e.departmentId)?.name ?? '—'}</td>
                  <td>{e.managerId ? byId.get(e.managerId)?.fullName : <span className="text-muted">None</span>}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(e)}>
                      Edit manager
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {editing && (
        <ManagerModal
          employee={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            toast(message)
            reload()
          }}
        />
      )}
    </Layout>
  )
}

function ManagerModal({
  employee,
  employees,
  onClose,
  onSaved,
}: {
  employee: Employee
  employees: Employee[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [managerId, setManagerId] = useState(employee.managerId ?? '')
  const [error, setError] = useState<string | null>(null)
  const current = employees.find((e) => e.id === employee.managerId)
  const excluded = selfAndReportIds(employees, employee.id)
  const options = employees.filter((e) => !excluded.includes(e.id))

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!managerId) return setError('Select a manager for this employee.')
    setError(null)
    try {
      await apiClient.patch(`/employees/${employee.id}/manager`, { managerId })
      const next = employees.find((e) => e.id === managerId)
      onSaved(`${employee.fullName}'s manager updated to ${next?.fullName}.`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="manager-modal-title">
        <h3 id="manager-modal-title">Edit manager for {employee.fullName}</h3>
        <form onSubmit={submit} noValidate>
          <p className="field-help" style={{ marginBottom: 'var(--space-3)' }}>
            Current manager: {current?.fullName ?? 'none'}
          </p>
          <div className="field">
            <label className="field-label" htmlFor="manager-select">
              New manager
            </label>
            <select
              className={'select' + (error ? ' has-error' : '')}
              id="manager-select"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">— Select a manager —</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.jobTitle ? ` — ${e.jobTitle}` : ''}
                </option>
              ))}
            </select>
            {error && (
              <span className="field-error" role="alert">
                {error}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save manager
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
