import { useState, type FormEvent } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { DEFECT_SEVERITIES, REQUIRED_DEFECT_FIELDS, SEVERITY_META } from '../lib/defectFields'
import { fmtDateTime } from '../lib/format'
import type { Defect, DefectSeverity } from '../lib/types'

const EMPTY = { title: '', description: '', severity: '', stepsToReproduce: '', expectedResult: '', actualResult: '', environment: '' }
type Draft = typeof EMPTY
type RequiredKey = (typeof REQUIRED_DEFECT_FIELDS)[number]['key']

function SeverityTag({ severity }: { severity: DefectSeverity }) {
  const meta = SEVERITY_META[severity]
  return (
    <span className={`severity-tag ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {severity}
    </span>
  )
}

function OptionalRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="readonly-row">
      <span className="readonly-label">{label}</span>
      <span className={'readonly-value' + (value ? '' : ' muted')}>{value || 'Not set'}</span>
    </div>
  )
}

export default function ReportDefectPage() {
  const auth = useAuth()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [missing, setMissing] = useState<RequiredKey[]>([])
  const [denied, setDenied] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Defect | null>(null)
  const toast = useToast()
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const isReporter = auth?.role === 'reporter'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!isReporter) {
      setDenied(true)
      toast('Submission refused — Reporter role required.')
      return
    }
    setDenied(false)
    const absent = REQUIRED_DEFECT_FIELDS.filter((f) => !draft[f.key].trim()).map((f) => f.key)
    setMissing(absent)
    if (absent.length) return
    const body: Record<string, string> = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      severity: draft.severity,
      stepsToReproduce: draft.stepsToReproduce.trim(),
    }
    for (const k of ['expectedResult', 'actualResult', 'environment'] as const) {
      if (draft[k].trim()) body[k] = draft[k].trim()
    }
    setSaving(true)
    try {
      setSaved(await apiClient.post<Defect>('/defects', body))
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const errorFor = (k: RequiredKey) => (missing.includes(k) ? REQUIRED_DEFECT_FIELDS.find((f) => f.key === k)!.message : null)
  const cls = (base: string, k: RequiredKey) => base + (missing.includes(k) ? ' has-error' : '')
  const missingLabels = REQUIRED_DEFECT_FIELDS.filter((f) => missing.includes(f.key)).map((f) => f.label)

  if (saved) {
    return (
      <Layout title="Report a defect">
        <Banner kind="success" title="Defect created">
          Defect <span className="mono">{saved.id}</span> was logged and is ready for QA to triage.
        </Banner>
        <div className="card" style={{ maxWidth: 720 }}>
          <h3 className="card-title">{saved.title}</h3>
          <div className="readonly-row">
            <span className="readonly-label">Defect ID</span>
            <span className="readonly-value mono">{saved.id}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Status</span>
            <span className="readonly-value">
              <span className="chip chip-neutral">{saved.status}</span>
            </span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Severity</span>
            <span className="readonly-value">
              <SeverityTag severity={saved.severity} />
            </span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Created</span>
            <span className="readonly-value">{fmtDateTime(saved.createdAt)}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Description</span>
            <span className="readonly-value">{saved.description}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Steps to reproduce</span>
            <span className="readonly-value">{saved.stepsToReproduce}</span>
          </div>
          <OptionalRow label="Expected result" value={saved.expectedResult} />
          <OptionalRow label="Actual result" value={saved.actualResult} />
          <OptionalRow label="Environment / build version" value={saved.environment} />
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSaved(null)
                setDraft(EMPTY)
                setMissing([])
              }}
            >
              + Report another defect
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Report a defect">
      {!isReporter && (
        <Banner kind="warning" title="Submitting will be refused">
          You don't have the Reporter role. You can fill in the form, but it won't be saved.
        </Banner>
      )}
      {denied && (
        <Banner kind="danger" title="You don't have permission to do that">
          Reporting a defect requires the Reporter role.
        </Banner>
      )}
      {missing.length > 0 && (
        <Banner kind="danger" title="Can't submit this defect">
          Missing required field{missing.length > 1 ? 's' : ''}: {missingLabels.join(', ')}.
        </Banner>
      )}
      {serverError && (
        <Banner kind="danger" title="Couldn't submit this defect">
          {serverError}
        </Banner>
      )}
      <div className="card" style={{ maxWidth: 720 }}>
        <h3 className="card-title">Defect details</h3>
        <p className="card-body">Title, description, severity and steps to reproduce are required so QA can triage this defect.</p>
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="nd-title">
              Title<span className="required-mark">*</span>
            </label>
            <input
              className={cls('input', 'title')}
              id="nd-title"
              type="text"
              placeholder="e.g. Checkout button unresponsive on Safari"
              value={draft.title}
              onChange={(e) => set('title')(e.target.value)}
            />
            {errorFor('title') && <div className="field-error">{errorFor('title')}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nd-description">
              Description<span className="required-mark">*</span>
            </label>
            <textarea
              className={cls('textarea', 'description')}
              id="nd-description"
              placeholder="What's wrong, and where does it happen?"
              value={draft.description}
              onChange={(e) => set('description')(e.target.value)}
            />
            {errorFor('description') && <div className="field-error">{errorFor('description')}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nd-severity">
              Severity<span className="required-mark">*</span>
            </label>
            <select className={cls('select', 'severity')} id="nd-severity" value={draft.severity} onChange={(e) => set('severity')(e.target.value)}>
              <option value="">Select severity</option>
              {DEFECT_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errorFor('severity') && <div className="field-error">{errorFor('severity')}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nd-steps">
              Steps to reproduce<span className="required-mark">*</span>
            </label>
            <textarea
              className={cls('textarea', 'stepsToReproduce')}
              id="nd-steps"
              placeholder={'1. ...\n2. ...\n3. ...'}
              value={draft.stepsToReproduce}
              onChange={(e) => set('stepsToReproduce')(e.target.value)}
            />
            {errorFor('stepsToReproduce') && <div className="field-error">{errorFor('stepsToReproduce')}</div>}
          </div>

          <h3 className="card-title" style={{ marginTop: 'var(--space-4)' }}>
            Additional details
          </h3>
          <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
            Optional — the defect can be created without these.
          </p>
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="nd-expected">
                Expected result
              </label>
              <textarea
                className="textarea"
                id="nd-expected"
                placeholder="What should happen instead?"
                value={draft.expectedResult}
                onChange={(e) => set('expectedResult')(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="nd-actual">
                Actual result
              </label>
              <textarea
                className="textarea"
                id="nd-actual"
                placeholder="What actually happens?"
                value={draft.actualResult}
                onChange={(e) => set('actualResult')(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nd-environment">
              Environment / build version
            </label>
            <input
              className="input"
              id="nd-environment"
              type="text"
              placeholder="e.g. iOS 17.4, Safari, build 4.12.0"
              value={draft.environment}
              onChange={(e) => set('environment')(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit defect report'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(EMPTY)
                setMissing([])
                setDenied(false)
                setServerError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
