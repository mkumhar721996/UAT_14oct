import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { SeverityTag, StatusChip } from '../components/DefectTags'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { DEFECT_SEVERITIES } from '../lib/defectFields'
import type { Defect, DefectSeverity } from '../lib/types'
import { useAsync } from '../lib/useAsync'

function ReadonlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="readonly-row">
      <span className="readonly-label">{label}</span>
      <span className="readonly-value">{children}</span>
    </div>
  )
}

const Muted = ({ value, empty }: { value: string | null; empty: string }) =>
  value ? <>{value}</> : <span className="muted">{empty}</span>

function EditForm({ defect, role, sub }: { defect: Defect; role: string | undefined; sub: string | undefined }) {
  const navigate = useNavigate()
  const toast = useToast()
  const isAdmin = role === 'admin'
  const isReporter = sub === defect.reportedBy
  const isTriaged = defect.status !== 'New'
  const textEditable = (isReporter && !isTriaged) || (isAdmin && isTriaged)
  const canSave = isAdmin || textEditable

  const [description, setDescription] = useState(defect.description)
  const [steps, setSteps] = useState(defect.stepsToReproduce)
  const [severity, setSeverity] = useState<DefectSeverity>(defect.severity)
  const [errors, setErrors] = useState<{ description?: string; steps?: string }>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (textEditable && !description.trim()) next.description = 'Describe the defect.'
    if (textEditable && !steps.trim()) next.steps = 'Describe the steps to reproduce the defect.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const body: Record<string, string> = {}
    if (isAdmin) body.severity = severity
    if (textEditable) {
      body.description = description.trim()
      body.stepsToReproduce = steps.trim()
    }
    setSaving(true)
    setServerError('')
    try {
      await apiClient.patch(`/defects/${defect.id}`, body)
      toast(`${defect.id} updated.`)
      navigate(`/defects/${defect.id}`)
    } catch (err) {
      setServerError((err as Error).message)
      setSaving(false)
    }
  }

  const lockLabel = (text: string, locked: boolean) => (locked ? `🔒 ${text}` : text)

  return (
    <>
      {!isReporter && !isAdmin && (
        <Banner kind="danger" title="You don't have permission to do that">
          Editing this defect is limited to its reporter (before it's triaged) or an Admin. Ask one of them to make this change.
        </Banner>
      )}
      {isReporter && !isAdmin && isTriaged && (
        <Banner kind="warning" title="Locked after triage">
          This defect has entered Triaged, so its description and reproduction details can no longer be changed by the reporter. Ask an
          Admin to update them.
        </Banner>
      )}
      {serverError && (
        <Banner kind="danger" title="Couldn't save this defect">
          {serverError}
        </Banner>
      )}
      <div className="card" style={{ maxWidth: 720 }}>
        <h3 className="card-title">{defect.title}</h3>
        <ReadonlyRow label="Status">
          <StatusChip status={defect.status} />
          {isAdmin && <span className="readonly-hint">Status changes aren't made here — use the defect's workflow actions.</span>}
        </ReadonlyRow>
        {!isAdmin && (
          <ReadonlyRow label="Severity">
            <SeverityTag severity={defect.severity} />
          </ReadonlyRow>
        )}
        <ReadonlyRow label="Priority">
          <Muted value={defect.priority} empty="Not set" />
          {isAdmin && <span className="readonly-hint">Set by the triage workflow — stays unchanged when you update severity.</span>}
        </ReadonlyRow>
        {(isAdmin || isReporter) && (
          <ReadonlyRow label="Assignee">
            <Muted value={defect.assigneeName} empty="Not assigned" />
          </ReadonlyRow>
        )}
        <form onSubmit={onSubmit} noValidate>
          {isAdmin && (
            <div className="field" style={{ marginTop: 'var(--space-3)' }}>
              <label className="field-label" htmlFor="ed-severity">
                Severity<span className="required-mark">*</span>
              </label>
              <select className="select" id="ed-severity" value={severity} onChange={(e) => setSeverity(e.target.value as DefectSeverity)}>
                {DEFECT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="field-hint">Admins can change severity at any status.</p>
            </div>
          )}
          {isReporter && !isAdmin && !isTriaged && (
            <p className="field-hint" style={{ margin: 'var(--space-3) 0 0' }}>
              You can edit the description and reproduction details until this defect is triaged.
            </p>
          )}
          <div className="field" style={{ marginTop: 'var(--space-2)' }}>
            <label className={'field-label' + (textEditable ? '' : ' field-lock')} htmlFor="ed-description">
              {lockLabel('Description', !textEditable && (isAdmin || isReporter))}
              {textEditable && <span className="required-mark">*</span>}
            </label>
            <textarea
              className={'textarea' + (errors.description ? ' has-error' : '')}
              id="ed-description"
              disabled={!textEditable}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <div className="field-error">{errors.description}</div>}
            {isAdmin && !isTriaged && <p className="field-hint">Becomes editable for Admins once this defect is triaged.</p>}
          </div>
          <div className="field">
            <label className={'field-label' + (textEditable ? '' : ' field-lock')} htmlFor="ed-steps">
              {lockLabel('Steps to reproduce', !textEditable && (isAdmin || isReporter))}
              {textEditable && <span className="required-mark">*</span>}
            </label>
            <textarea
              className={'textarea' + (errors.steps ? ' has-error' : '')}
              id="ed-steps"
              disabled={!textEditable}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
            {errors.steps && <div className="field-error">{errors.steps}</div>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {canSave ? (
              <>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <Link className="btn btn-secondary" to={`/defects/${defect.id}`}>
                  Cancel
                </Link>
              </>
            ) : (
              <Link className="btn btn-secondary" to={`/defects/${defect.id}`}>
                Back to defect
              </Link>
            )}
          </div>
        </form>
      </div>
    </>
  )
}

export default function DefectEditPage() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const { data: defect, error, loading } = useAsync(() => apiClient.get<Defect>(`/defects/${id}`))

  return (
    <Layout
      title="Edit defect"
      crumbs={[{ label: 'Defects' }, { label: defect?.title ?? '…', to: `/defects/${id}` }, { label: 'Edit' }]}
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load this defect">
          {error.message}
        </Banner>
      ) : loading || !defect ? (
        <div className="card" style={{ maxWidth: 720 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '60%', height: 20, marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        </div>
      ) : (
        <EditForm defect={defect} role={auth?.role} sub={auth?.sub} />
      )}
    </Layout>
  )
}
