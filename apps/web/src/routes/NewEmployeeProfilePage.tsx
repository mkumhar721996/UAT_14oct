import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActiveGrid } from '../components/ActiveGrid'
import { Banner } from '../components/Banner'
import { CoreFieldInput } from '../components/CoreFieldInput'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { CORE_FIELDS, CORE_FIELD_LABELS } from '../lib/fields'
import { fmtDate } from '../lib/format'
import type { Employee } from '../lib/types'

const EMPTY = { fullName: '', startDate: '', jobTitle: '', department: '', contractType: '', salary: '' }

export default function NewEmployeeProfilePage() {
  const [draft, setDraft] = useState(EMPTY)
  const [errors, setErrors] = useState<{ fullName?: boolean; startDate?: boolean; server?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Employee | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const set = (k: keyof typeof EMPTY) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const fullName = draft.fullName.trim()
    const next = { fullName: !fullName, startDate: !draft.startDate }
    if (next.fullName || next.startDate) {
      setErrors(next)
      return
    }
    setErrors({})
    const body: Record<string, unknown> = { fullName, startDate: draft.startDate }
    if (draft.jobTitle.trim()) body.jobTitle = draft.jobTitle.trim()
    if (draft.department) body.department = draft.department
    if (draft.contractType) body.contractType = draft.contractType
    if (draft.salary !== '') body.salary = Number(draft.salary)
    setSaving(true)
    try {
      const employee = await apiClient.post<Employee>('/employees', body)
      setSaved(employee)
      toast(`Profile saved. Employee ID ${employee.employeeNumber} assigned.`)
    } catch (err) {
      setErrors({ server: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const crumbs = [{ label: 'Employees', to: '/employees' }, { label: 'New' }]

  if (saved) {
    return (
      <Layout title="New employee profile" crumbs={crumbs}>
        <Banner kind="success" title="Profile saved">
          Employee ID <span className="mono">{saved.employeeNumber}</span> was generated automatically.
        </Banner>
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 className="card-title">{saved.fullName}</h3>
          <div className="readonly-row">
            <span className="readonly-label">Employee ID</span>
            <span className="readonly-value mono">{saved.employeeNumber}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Start date</span>
            <span className="readonly-value">{fmtDate(saved.startDate)}</span>
          </div>
          <ActiveGrid employee={saved} />
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/employees/${saved.id}`)}>
              View full profile
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSaved(null)
                setDraft(EMPTY)
              }}
            >
              + Add another employee
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="New employee profile" crumbs={crumbs}>
      <div className="card" style={{ maxWidth: 640 }}>
        <h3 className="card-title">Core details</h3>
        <p className="card-body">
          Full name and start date are required. Job title, department, contract type and salary can be added now or later.
        </p>
        <form onSubmit={onSubmit} noValidate>
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="ne-fullName">
                Full name<span className="required-mark">*</span>
              </label>
              <input
                className={'input' + (errors.fullName ? ' has-error' : '')}
                id="ne-fullName"
                type="text"
                placeholder="e.g. Jordan Lee"
                value={draft.fullName}
                onChange={(e) => set('fullName')(e.target.value)}
              />
              {errors.fullName && <div className="field-error">Enter the employee's full name.</div>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ne-startDate">
                Start date<span className="required-mark">*</span>
              </label>
              <input
                className={'input' + (errors.startDate ? ' has-error' : '')}
                id="ne-startDate"
                type="date"
                value={draft.startDate}
                onChange={(e) => set('startDate')(e.target.value)}
              />
              {errors.startDate && <div className="field-error">Enter a start date.</div>}
            </div>
          </div>
          <div className="grid-2">
            {CORE_FIELDS.map((f) => (
              <div className="field" key={f}>
                <label className="field-label" htmlFor={`ne-${f}`}>
                  {f === 'salary' ? 'Salary (annual, USD)' : CORE_FIELD_LABELS[f]}
                </label>
                <CoreFieldInput field={f} id={`ne-${f}`} value={draft[f]} onChange={set(f)} allowUnset />
              </div>
            ))}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ne-employeeNumber">
              Employee ID
            </label>
            <input className="input" id="ne-employeeNumber" type="text" value="Generated automatically after save" disabled readOnly />
          </div>
          {(errors.fullName || errors.startDate) && (
            <Banner kind="danger" title="Couldn't save">
              Fix the highlighted fields and try again.
            </Banner>
          )}
          {errors.server && (
            <Banner kind="danger" title="Couldn't save">
              {errors.server}
            </Banner>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <Link className="btn btn-secondary" to="/employees">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  )
}
