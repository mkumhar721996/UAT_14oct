import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { ReadonlyField, StatusChip } from '../components/DefectParts'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { DEFECT_SEVERITIES } from '../lib/defectFields'
import type { Defect, DefectSeverity } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const SEVERITIES = DEFECT_SEVERITIES

function Refused({ defect }: { defect: Defect }) {
  return (
    <div className="empty-state">
      <div className="glyph" aria-hidden="true">&#9940;</div>
      <h2 className="heading-lg">You don't have permission to edit this defect</h2>
      <p className="text-muted" style={{ maxWidth: '52ch' }}>
        You're not this defect's Reporter and not an Admin. Only the Reporter or an Admin can change {defect.defectNumber}.
      </p>
      <Link className="link" to={`/defects/${defect.id}`}>
        ← Back to defect (view only)
      </Link>
    </div>
  )
}

function EditForm({ defect: initial, isAdmin }: { defect: Defect; isAdmin: boolean }) {
  const [defect, setDefect] = useState(initial)
  const [values, setValues] = useState({ description: initial.description, reproSteps: initial.reproSteps, severity: initial.severity })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [serverError, setServerError] = useState('')
  const locked = !isAdmin && defect.triagedAt !== null
  const emptyField = !values.description.trim() || !values.reproSteps.trim()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (emptyField) return
    const body: Partial<typeof values> = {}
    if (values.description !== defect.description) body.description = values.description
    if (values.reproSteps !== defect.reproSteps) body.reproSteps = values.reproSteps
    if (isAdmin && values.severity !== defect.severity) body.severity = values.severity
    const changed = Object.keys(body)
    if (changed.length === 0) {
      setSaved('Saved. No changes were made.')
      return
    }
    setSaving(true)
    setServerError('')
    setSaved('')
    try {
      const updated = await apiClient.patch<Defect>(`/defects/${defect.id}`, body)
      const messages = ['Saved.']
      if (body.severity) {
        messages.push(`Severity updated to "${body.severity}".`)
        if (defect.priority) messages.push(`Priority remains "${defect.priority}" — it isn't recalculated automatically.`)
      }
      setDefect(updated)
      setSaved(messages.join(' '))
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {saved && (
        <Banner kind="success" title="Defect updated">
          {saved}
        </Banner>
      )}
      {serverError && (
        <Banner kind="danger" title="Couldn't save">
          {serverError}
        </Banner>
      )}
      <div className="detail-grid">
        <div>
          {locked && (
            <div className="lock-note">
              <span aria-hidden="true">&#128274;</span>
              <span>
                This defect has entered Triaged. As its Reporter, you can no longer change the description or reproduction details —
                only an Admin can now.
              </span>
            </div>
          )}
          {isAdmin && (
            <ReadonlyField label="Title">{defect.title}</ReadonlyField>
          )}
          <h3 className="block-title">
            <label htmlFor="ed-description">Description</label>
          </h3>
          <textarea
            id="ed-description"
            className={'textarea' + (locked ? ' input-locked' : '')}
            style={{ width: '100%', minHeight: 110 }}
            value={values.description}
            disabled={locked}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
          <h3 className="block-title" style={{ marginTop: 'var(--space-4)' }}>
            <label htmlFor="ed-reproSteps">Reproduction details</label>
          </h3>
          <textarea
            id="ed-reproSteps"
            className={'textarea' + (locked ? ' input-locked' : '')}
            style={{ width: '100%', minHeight: 140 }}
            value={values.reproSteps}
            disabled={locked}
            onChange={(e) => setValues({ ...values, reproSteps: e.target.value })}
          />
          {emptyField && !locked && <div className="field-error">Description and reproduction details can't be empty.</div>}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            {locked ? (
              <Link className="btn btn-secondary" to={`/defects/${defect.id}`}>
                Back to defect
              </Link>
            ) : (
              <>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <Link className="btn btn-secondary" to={`/defects/${defect.id}`}>
                  Cancel
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="block-title" style={{ marginTop: 0 }}>
            {isAdmin ? 'Classification' : 'Not editable by Reporter'}
          </h3>
          {isAdmin && (
            <div className="field">
              <label className="field-label" htmlFor="ed-severity">
                Severity
              </label>
              <select
                id="ed-severity"
                className="select"
                value={values.severity}
                onChange={(e) => setValues({ ...values, severity: e.target.value as DefectSeverity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          {!isAdmin && <ReadonlyField label="Severity">{defect.severity}</ReadonlyField>}
          <ReadonlyField label="Priority">{defect.priority ?? 'Not yet triaged'}</ReadonlyField>
          {isAdmin && (
            <p className="text-muted" style={{ margin: '0 0 var(--space-3) 0' }}>
              Priority is set when a defect is triaged and isn't recalculated when severity changes.
            </p>
          )}
          <ReadonlyField label="Status">
            <StatusChip status={defect.status} />
          </ReadonlyField>
          {isAdmin && (
            <p className="text-muted" style={{ margin: '0 0 var(--space-3) 0' }}>
              Status changes happen through the defect's workflow actions, not from this form.
            </p>
          )}
          <ReadonlyField label="Type">{defect.type}</ReadonlyField>
          <ReadonlyField label="Assignee">{defect.assigneeName ?? 'Unassigned'}</ReadonlyField>
          {isAdmin && <ReadonlyField label="Reporter">{defect.reporterName ?? defect.reporterId}</ReadonlyField>}
        </div>
      </div>
    </form>
  )
}

export default function EditDefectPage() {
  const { id = '' } = useParams()
  const session = useAuth()
  const { data: defect, error } = useAsync(() => apiClient.get<Defect>(`/defects/${id}`))
  const isAdmin = session?.role === 'admin'
  const canEdit = !!defect && (isAdmin || session?.sub === defect.reporterId)

  return (
    <Layout
      title="Edit defect"
      crumbs={[{ label: 'Defects' }, { label: defect?.defectNumber ?? '…', to: `/defects/${id}` }, { label: 'Edit' }]}
      actions={
        canEdit && (
          <Link className="link" to={`/defects/${id}`}>
            ← Back to defect
          </Link>
        )
      }
    >
      {error ? (
        <Banner kind="danger" title="We couldn't load this defect">
          {error.message}
        </Banner>
      ) : !defect ? (
        <div className="card" aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18 }} />
        </div>
      ) : canEdit ? (
        <EditForm defect={defect} isAdmin={isAdmin} />
      ) : (
        <Refused defect={defect} />
      )}
    </Layout>
  )
}
