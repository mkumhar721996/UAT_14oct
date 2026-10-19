import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { SeverityTag, StatusChip } from '../components/DefectTags'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { ApiError, apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import { fmtDateTime } from '../lib/format'
import type { Defect } from '../lib/types'
import { useAsync } from '../lib/useAsync'

function TextRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="readonly-row align-top">
      <span className="readonly-label">{label}</span>
      <span className={'readonly-value text-left' + (value ? '' : ' muted')}>{value || 'Not set'}</span>
    </div>
  )
}

type ModalKind = 'triage' | 'assign' | 'resolve' | 'reopen'
type WorkflowAction = { id: string; label: string; primary?: boolean; modal?: ModalKind; direct?: 'start' | 'verify' }

const ACTIONS: Record<string, { description: string; actions: WorkflowAction[] }> = {
  New: {
    description: 'Triaging sets a priority and moves this defect into the fix process. Only QA/Verifier or Admin can triage.',
    actions: [{ id: 'triage', label: 'Triage', primary: true, modal: 'triage' }],
  },
  Triaged: {
    description: 'Assigning hands this defect to a Developer. Only Admin can assign.',
    actions: [{ id: 'assign', label: 'Assign', primary: true, modal: 'assign' }],
  },
  Reopened: {
    description: 'Assigning hands this defect to a Developer. Only Admin can assign.',
    actions: [{ id: 'assign', label: 'Assign', primary: true, modal: 'assign' }],
  },
  Assigned: {
    description: 'Reassign to a different Developer (Admin only), or the assigned Developer can start work.',
    actions: [
      { id: 'reassign', label: 'Reassign', modal: 'assign' },
      { id: 'start', label: 'Start progress', primary: true, direct: 'start' },
    ],
  },
  'In Progress': {
    description: 'Only the assigned Developer can mark this resolved, with a resolution note.',
    actions: [{ id: 'resolve', label: 'Mark resolved', primary: true, modal: 'resolve' }],
  },
  Resolved: {
    description: "QA/Verifier verifies the fix, or reopens it with a reason if it isn't fixed.",
    actions: [
      { id: 'verify', label: 'Verify', primary: true, direct: 'verify' },
      { id: 'reopen', label: 'Reopen', modal: 'reopen' },
    ],
  },
  Verified: {
    description: 'QA/Verifier or Admin can reopen this with a reason if it regresses.',
    actions: [{ id: 'reopen', label: 'Reopen', modal: 'reopen' }],
  },
  Closed: {
    description: 'QA/Verifier can reopen a closed defect with a reason.',
    actions: [{ id: 'reopen', label: 'Reopen', modal: 'reopen' }],
  },
}

const MODALS: Record<ModalKind, { title: string; description: string; submit: string; error: string }> = {
  triage: { title: 'Triage defect', description: 'Set a priority to move this defect from New to Triaged.', submit: 'Set to Triaged', error: "Priority can't be empty." },
  assign: { title: 'Assign defect', description: "Enter the developer's sign-in ID.", submit: 'Assign', error: 'Choose an assignee.' },
  resolve: { title: 'Mark defect resolved', description: 'Describe the fix so QA knows what to verify.', submit: 'Mark resolved', error: "Resolution note can't be empty." },
  reopen: { title: 'Reopen defect', description: 'Say why this defect needs more work.', submit: 'Reopen', error: "Reopen reason can't be empty." },
}

const PRIORITIES = ['P1 — Critical', 'P2 — High', 'P3 — Medium', 'P4 — Low']

function WorkflowModal({ kind, onCancel, onSubmit }: { kind: ModalKind; onCancel: () => void; onSubmit: (value: string) => Promise<void> }) {
  const meta = MODALS[kind]
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return setError(meta.error)
    setError(null)
    setBusy(true)
    await onSubmit(value.trim())
    setBusy(false)
  }
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
        <h3 id="workflow-modal-title">{meta.title}</h3>
        <p>{meta.description}</p>
        <form onSubmit={submit} noValidate>
          <div className="field">
            {kind === 'triage' && (
              <>
                <label className="field-label" htmlFor="wf-input">
                  Priority<span className="required-mark">*</span>
                </label>
                <select className={'select' + (error ? ' has-error' : '')} id="wf-input" value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Select a priority…</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p.slice(0, 2)}>
                      {p}
                    </option>
                  ))}
                </select>
              </>
            )}
            {kind === 'assign' && (
              <>
                <label className="field-label" htmlFor="wf-input">
                  Assignee<span className="required-mark">*</span>
                </label>
                <input className={'input' + (error ? ' has-error' : '')} id="wf-input" value={value} onChange={(e) => setValue(e.target.value)} />
              </>
            )}
            {(kind === 'resolve' || kind === 'reopen') && (
              <>
                <label className="field-label" htmlFor="wf-input">
                  {kind === 'resolve' ? 'Resolution note' : 'Reopen reason'}
                  <span className="required-mark">*</span>
                </label>
                <textarea className="textarea" id="wf-input" value={value} onChange={(e) => setValue(e.target.value)} />
              </>
            )}
            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {meta.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DefectDetailPage() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const toast = useToast()
  const { data: loaded, error, loading, reload } = useAsync(() => apiClient.get<Defect>(`/defects/${id}`))
  const [updated, setUpdated] = useState<Defect | null>(null)
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const defect = updated ?? loaded
  const canEdit = !!defect && (auth?.role === 'admin' || auth?.sub === defect.reportedBy)


  const transition = async (body: Record<string, string>, successMessage: string) => {
    try {
      setUpdated(await apiClient.post<Defect>(`/defects/${id}/transitions`, body))
      setRefusal(null)
      setModal(null)
      toast(successMessage)
    } catch (e) {
      setRefusal(e instanceof ApiError ? e.message : "Couldn't update this defect. Try again.")
      setModal(null)
    }
  }
  const submitModal = (kind: ModalKind, value: string) => {
    if (kind === 'triage') return transition({ action: 'triage', priority: value }, `Defect triaged — priority ${value}.`)
    if (kind === 'assign') return transition({ action: 'assign', assigneeId: value }, `Defect assigned to ${value}.`)
    if (kind === 'resolve') return transition({ action: 'resolve', resolutionNote: value }, 'Defect marked resolved.')
    return transition({ action: 'reopen', reopenReason: value }, 'Defect reopened.')
  }
  const workflow = defect ? ACTIONS[defect.status] : undefined

  return (
    <Layout
      title={defect?.title ?? 'Defect'}
      crumbs={[{ label: 'Defects' }, { label: defect?.title ?? '…' }]}
      actions={
        <Link
          className="btn btn-primary"
          to={`/defects/${id}/edit`}
          onClick={() => {
            if (!canEdit) toast("Edit refused — you don't have permission to change this defect.", true)
          }}
        >
          Edit defect
        </Link>
      }
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load this defect">
          {error.message}{' '}
          <button className="btn btn-secondary" onClick={reload}>
            Try again
          </button>
        </Banner>
      ) : loading || !defect ? (
        <div className="card" style={{ maxWidth: 720 }} aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '60%', height: 20, marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', marginBottom: 'var(--space-2)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 720 }}>
          <h3 className="card-title">{defect.title}</h3>
          <div className="readonly-row">
            <span className="readonly-label">Defect ID</span>
            <span className="readonly-value mono">{defect.id}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Status</span>
            <span className="readonly-value">
              <StatusChip status={defect.status} />
            </span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Severity</span>
            <span className="readonly-value">
              <SeverityTag severity={defect.severity} />
            </span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Priority</span>
            <span className={'readonly-value' + (defect.priority ? '' : ' muted')}>
              {defect.priority || 'Not set'}
              <span className="readonly-hint">Set by the triage workflow</span>
            </span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Assignee</span>
            <span className={'readonly-value' + (defect.assigneeName ? '' : ' muted')}>{defect.assigneeName || 'Not assigned'}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Reporter</span>
            <span className="readonly-value">{defect.reportedBy}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Created</span>
            <span className="readonly-value">{fmtDateTime(defect.createdAt)}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Last updated</span>
            <span className="readonly-value">{fmtDateTime(defect.updatedAt)}</span>
          </div>
          {defect.resolutionNote && <TextRow label="Resolution note" value={defect.resolutionNote} />}
          {defect.reopenReason && <TextRow label="Reopen reason" value={defect.reopenReason} />}
          <TextRow label="Description" value={defect.description} />
          <TextRow label="Steps to reproduce" value={defect.stepsToReproduce} />
          <TextRow label="Expected result" value={defect.expectedResult} />
          <TextRow label="Actual result" value={defect.actualResult} />
          <TextRow label="Environment / build version" value={defect.environment} />
        </div>
      )}
      {defect && workflow && (
        <div style={{ maxWidth: 720, marginTop: 'var(--space-4)' }}>
          {refusal && (
            <Banner kind="danger" title="You can't do that">
              {refusal}
            </Banner>
          )}
          <div className="card">
            <h3 className="card-title">Workflow actions</h3>
            <p>{workflow.description}</p>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              {workflow.actions.map((a) => (
                <button
                  key={a.id}
                  className={'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary')}
                  onClick={() => {
                    setRefusal(null)
                    if (a.modal) setModal(a.modal)
                    else if (a.direct === 'start') transition({ action: 'start' }, 'Work started.')
                    else transition({ action: 'verify' }, 'Defect verified.')
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {modal && <WorkflowModal key={modal} kind={modal} onCancel={() => setModal(null)} onSubmit={(v) => submitModal(modal, v)} />}
    </Layout>
  )
}
