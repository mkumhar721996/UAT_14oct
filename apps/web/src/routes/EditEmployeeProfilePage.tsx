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

const asText = (v: string | number | null) => (v === null ? '' : String(v))

function EditForm({ employee }: { employee: Employee }) {
  const navigate = useNavigate()
  const toast = useToast()
  const original = {
    jobTitle: asText(employee.jobTitle),
    department: asText(employee.department),
    contractType: asText(employee.contractType),
    salary: asText(employee.salary),
  }
  const [values, setValues] = useState({ fullName: employee.fullName, startDate: employee.startDate.slice(0, 10), ...original })
  const [effective, setEffective] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, boolean> = {}
    if (!values.fullName.trim()) next.fullName = true
    if (!values.startDate) next.startDate = true
    const changed = CORE_FIELDS.filter((f) => values[f] !== original[f])
    for (const f of changed) if (!effective[f]) next[f] = true
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const body: Record<string, unknown> = { fullName: values.fullName.trim(), startDate: values.startDate }
    for (const f of changed) {
      body[f] = values[f] === '' ? null : f === 'salary' ? Number(values[f]) : values[f]
      body[`${f}EffectiveDate`] = effective[f]
    }
    setSaving(true)
    setServerError('')
    try {
      await apiClient.patch(`/employees/${employee.id}`, body)
      toast('Profile updated. New values are active immediately.')
      navigate(`/employees/${employee.id}`)
    } catch (err) {
      setServerError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 680 }}>
      <h3 className="card-title">{employee.fullName}</h3>
      <div className="readonly-row">
        <span className="readonly-label">Employee ID</span>
        <span className="readonly-value mono">{employee.employeeNumber}</span>
      </div>
      <form onSubmit={onSubmit} noValidate style={{ marginTop: 'var(--space-3)' }}>
        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="ee-fullName">
              Full name<span className="required-mark">*</span>
            </label>
            <input
              className={'input' + (errors.fullName ? ' has-error' : '')}
              id="ee-fullName"
              value={values.fullName}
              onChange={(e) => setValues({ ...values, fullName: e.target.value })}
            />
            {errors.fullName && <div className="field-error">Enter the employee's full name.</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ee-startDate">
              Start date<span className="required-mark">*</span>
            </label>
            <input
              className={'input' + (errors.startDate ? ' has-error' : '')}
              id="ee-startDate"
              type="date"
              value={values.startDate}
              onChange={(e) => setValues({ ...values, startDate: e.target.value })}
            />
            {errors.startDate && <div className="field-error">Enter a start date.</div>}
          </div>
        </div>
        {CORE_FIELDS.map((f) => (
          <div key={f}>
            <div className="field">
              <label className="field-label" htmlFor={`ee-${f}`}>
                {f === 'salary' ? 'Salary (annual, USD)' : CORE_FIELD_LABELS[f]}
              </label>
              <CoreFieldInput field={f} id={`ee-${f}`} value={values[f]} onChange={(v) => setValues({ ...values, [f]: v })} allowUnset />
            </div>
            {values[f] !== original[f] && (
              <div className="effective-date-field">
                <label className="field-label" htmlFor={`ee-${f}-eff`}>
                  Effective date for {CORE_FIELD_LABELS[f].toLowerCase()} change<span className="required-mark">*</span>
                </label>
                <input
                  className={'input' + (errors[f] ? ' has-error' : '')}
                  id={`ee-${f}-eff`}
                  type="date"
                  value={effective[f] ?? ''}
                  onChange={(e) => setEffective({ ...effective, [f]: e.target.value })}
                />
                {errors[f] && <div className="field-error">Enter an effective date for this change.</div>}
              </div>
            )}
          </div>
        ))}
        {(Object.keys(errors).length > 0 || serverError) && (
          <Banner kind="danger" title="Couldn't save">
            {serverError || 'Fix the highlighted fields and try again.'}
          </Banner>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link className="btn btn-secondary" to={`/employees/${employee.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function EditEmployeeProfilePage() {
  const { id = '' } = useParams()
  const { data, error } = useAsync(() => apiClient.get<Employee>(`/employees/${id}`))
  return (
    <Layout
      title="Edit employee profile"
      crumbs={[
        { label: 'Employees', to: '/employees' },
        { label: data?.fullName ?? '…', to: `/employees/${id}` },
        { label: 'Edit' },
      ]}
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load this profile">
          {error.message}
        </Banner>
      ) : data ? (
        <EditForm employee={data} />
      ) : (
        <div className="card" style={{ maxWidth: 680 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18 }} />
        </div>
      )}
    </Layout>
  )
}
