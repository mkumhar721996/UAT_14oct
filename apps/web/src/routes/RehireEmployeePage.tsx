import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { CoreFieldInput } from '../components/CoreFieldInput'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { CORE_FIELDS, CORE_FIELD_LABELS } from '../lib/fields'
import type { Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const EMPTY = { startDate: '', jobTitle: '', department: '', contractType: '', salary: '' }

export default function RehireEmployeePage() {
  const { id = '' } = useParams()
  const [draft, setDraft] = useState(EMPTY)
  const [errors, setErrors] = useState<{ startDate?: boolean; server?: string }>({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const { data: source, error, loading } = useAsync(() => apiClient.get<Employee>(`/employees/${id}`))
  const set = (k: keyof typeof EMPTY) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const crumbs = [
    { label: 'Employees', to: '/employees' },
    { label: source?.fullName ?? '…', to: `/employees/${id}` },
    { label: 'Rehire' },
  ]

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.startDate) {
      setErrors({ startDate: true })
      return
    }
    setErrors({})
    const body: Record<string, unknown> = { startDate: draft.startDate }
    if (draft.jobTitle.trim()) body.jobTitle = draft.jobTitle.trim()
    if (draft.department) body.department = draft.department
    if (draft.contractType) body.contractType = draft.contractType
    if (draft.salary !== '') body.salary = Number(draft.salary)
    setSaving(true)
    try {
      const employee = await apiClient.post<Employee>(`/employees/${id}/rehire`, body)
      toast(`Rehire saved. Employee ID ${employee.employeeNumber} assigned, linked to ${source?.employeeNumber}.`)
      navigate(`/employees/${employee.id}`)
    } catch (err) {
      setErrors({ server: (err as Error).message })
      setSaving(false)
    }
  }

  return (
    <Layout title="Rehire employee" crumbs={crumbs}>
      {error ? (
        <Banner kind="danger" title="Couldn't load this profile">
          {error.message}
        </Banner>
      ) : loading || !source ? (
        <div className="card" style={{ maxWidth: 640 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 className="card-title">New record for {source.fullName}</h3>
          <div className="readonly-row">
            <span className="readonly-label">Original Employee ID</span>
            <span className="readonly-value mono">{source.employeeNumber}</span>
          </div>
          <p className="card-body">
            The terminated record stays unchanged. A new, linked record is created with the start date below; the other fields are optional.
          </p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="rh-startDate">
                Start date<span className="required-mark">*</span>
              </label>
              <input
                className={'input' + (errors.startDate ? ' has-error' : '')}
                id="rh-startDate"
                type="date"
                value={draft.startDate}
                onChange={(e) => set('startDate')(e.target.value)}
              />
              {errors.startDate && <div className="field-error">Enter a start date.</div>}
            </div>
            <div className="grid-2">
              {CORE_FIELDS.map((f) => (
                <div className="field" key={f}>
                  <label className="field-label" htmlFor={`rh-${f}`}>
                    {f === 'salary' ? 'Salary (annual, USD)' : CORE_FIELD_LABELS[f]}
                  </label>
                  <CoreFieldInput field={f} id={`rh-${f}`} value={draft[f]} onChange={set(f)} allowUnset />
                </div>
              ))}
            </div>
            {errors.server && (
              <Banner kind="danger" title="Couldn't create the rehire">
                {errors.server}
              </Banner>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create rehire'}
              </button>
              <Link className="btn btn-secondary" to={`/employees/${id}`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}
