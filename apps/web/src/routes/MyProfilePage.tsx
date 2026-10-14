import { useState, type FormEvent } from 'react'
import { Banner } from '../components/Banner'
import { CoreFieldInput } from '../components/CoreFieldInput'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { CORE_FIELDS, CORE_FIELD_LABELS } from '../lib/fields'
import { fmtDate, fmtDateTime, fmtFieldValue } from '../lib/format'
import type { ChangeRequest, CoreField, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

function ContactForm({ employee }: { employee: Employee }) {
  const toast = useToast()
  const [email, setEmail] = useState(employee.personalEmail ?? '')
  const [phone, setPhone] = useState(employee.phone ?? '')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiClient.patch('/employees/me/contact', { personalEmail: email.trim(), phone: phone.trim() })
      toast('Saved. Your contact details are updated.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 680, marginBottom: 'var(--space-4)' }}>
      <h3 className="card-title">Contact details</h3>
      <p className="card-body">These fields save immediately — no approval needed.</p>
      <form onSubmit={onSubmit}>
        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="ss-personalEmail">
              Personal email
            </label>
            <input className="input" id="ss-personalEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ss-phone">
              Phone
            </label>
            <input className="input" id="ss-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {error && (
          <Banner kind="danger" title="Couldn't save">
            {error}
          </Banner>
        )}
        <button type="submit" className="btn btn-primary">
          Save contact details
        </button>
      </form>
    </div>
  )
}

function FieldRow({
  employee,
  field,
  pending,
  open,
  onToggle,
  onSubmitted,
}: {
  employee: Employee
  field: CoreField
  pending?: ChangeRequest
  open: boolean
  onToggle: () => void
  onSubmitted: () => void
}) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const label = CORE_FIELD_LABELS[field]
  const current = fmtFieldValue(field, employee[field]) ?? 'Not set'

  async function submit() {
    if (!value.trim() || !effectiveDate) {
      setError('Enter a requested value and an effective date.')
      return
    }
    try {
      await apiClient.post('/employees/me/change-requests', {
        field,
        requestedValue: value.trim(),
        effectiveDate,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      toast(`Request submitted. ${label} stays "${current}" until an HR Admin approves it.`)
      onSubmitted()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="readonly-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="readonly-label">{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="readonly-value">{current}</span>
          {!pending && (
            <button className="btn btn-secondary" onClick={onToggle} aria-label={`${open ? 'Cancel' : 'Request a change to'} ${label.toLowerCase()}`}>
              {open ? 'Cancel' : 'Request a change'}
            </button>
          )}
        </div>
      </div>
      {pending && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Banner kind="warning" title="Pending HR approval">
            Requested: {fmtFieldValue(field, pending.requestedValue)}, effective {fmtDate(pending.effectiveDate)}. Submitted{' '}
            {fmtDateTime(pending.submittedAt)}. Your current value stays active until this is approved.
          </Banner>
        </div>
      )}
      {open && !pending && (
        <div className="request-form">
          <div className="field">
            <label className="field-label" htmlFor={`req-${field}`}>
              Requested {label.toLowerCase()}
            </label>
            <CoreFieldInput field={field} id={`req-${field}`} value={value} onChange={setValue} allowUnset={false} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`req-${field}-eff`}>
              Effective date
            </label>
            <input className="input" id={`req-${field}-eff`} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`req-${field}-note`}>
              Note (optional)
            </label>
            <textarea
              className="textarea"
              id={`req-${field}-note`}
              placeholder="Add context for your HR Admin"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <Banner kind="danger" title="Couldn't submit">
              {error}
            </Banner>
          )}
          <div className="request-actions">
            <button className="btn btn-primary" onClick={submit}>
              Submit request
            </button>
            <button className="btn btn-secondary" onClick={onToggle}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyProfilePage() {
  const [openField, setOpenField] = useState<CoreField | null>(null)
  const { data, error, reload } = useAsync(async () => {
    const [employee, requests] = await Promise.all([
      apiClient.get<Employee>('/employees/me'),
      apiClient.get<ChangeRequest[]>('/employees/me/change-requests'),
    ])
    return { employee, requests }
  })

  return (
    <Layout
      title="My profile"
      crumbs={[{ label: 'Employee self-service' }]}
      actions={data && <span className="self-badge">Signed in as {data.employee.fullName}</span>}
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load your profile">
          {error.message}
        </Banner>
      ) : data ? (
        <>
          <ContactForm employee={data.employee} />
          <div className="card" style={{ maxWidth: 680 }}>
            <h3 className="card-title">Employment details</h3>
            <p className="card-body">Changes to these fields need HR Admin approval before they take effect.</p>
            {CORE_FIELDS.map((f) => (
              <FieldRow
                key={f}
                employee={data.employee}
                field={f}
                pending={data.requests.find((r) => r.field === f)}
                open={openField === f}
                onToggle={() => setOpenField(openField === f ? null : f)}
                onSubmitted={() => {
                  setOpenField(null)
                  reload()
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ maxWidth: 680 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18 }} />
        </div>
      )}
    </Layout>
  )
}
