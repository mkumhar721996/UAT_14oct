import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { requisitionsApi, type Requisition } from '../../api/requisitionsApi'
import { isReviewer, useActor } from '../../auth/ActorContext'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { StatusChip, statusLabel } from '../../components/StatusChip'
import { Toast } from '../../components/Toast'
import { formatDate, money, requisitionCode } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'
import { ReassignModal } from './ReassignModal'

export function RequisitionDetailPage() {
  const id = Number(useParams().id)
  const actor = useActor()
  const { state, reload } = useLoad(() => requisitionsApi.get(actor, id), [id, actor.id])
  const [notice, setNotice] = useState<string | null>(null)
  const requisition = state.status === 'ready' ? state.data : null

  return (
    <AppShell
      title={requisition ? `${requisition.title} · ${requisitionCode(requisition.id)}` : 'Requisition'}
      context={requisition ? `Requisition detail — ${statusLabel(requisition.status)}` : 'Requisition detail'}
    >
      {state.status === 'loading' && <p className="text-muted">Loading requisition…</p>}
      {state.status === 'error' && (
        <Banner variant="danger" title="Couldn't load this requisition.">
          <p>{state.message}</p>
        </Banner>
      )}
      {requisition && (
        <>
          <SummaryCard requisition={requisition} />
          <StatusSection
            requisition={requisition}
            onChanged={(message) => {
              setNotice(message)
              reload()
            }}
          />
        </>
      )}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </AppShell>
  )
}

function SummaryCard({ requisition: r }: { requisition: Requisition }) {
  const items: [string, string][] = [
    ['Department', r.department ?? '—'],
    ['Location', r.location ?? '—'],
    ['Employment type', r.employmentType],
    ['Headcount', String(r.headcount)],
    ['Target start date', formatDate(r.startDate)],
    ['Salary range', `${money(r.salaryMin)} – ${money(r.salaryMax)}`],
  ]
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="section-title">{r.title}</h3>
        <StatusChip status={r.status} />
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="m-0 mt-[2px]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3">{r.description}</p>
    </div>
  )
}

function StatusSection({ requisition: r, onChanged }: { requisition: Requisition; onChanged: (message: string) => void }) {
  const actor = useActor()
  const reviewer = isReviewer(actor)
  const owner = r.hiringManager?.name ?? r.hiringManagerId
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reassigning, setReassigning] = useState(false)

  async function act(run: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError(null)
    try {
      await run()
      setRejecting(false)
      onChanged(message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function confirmReject() {
    if (!reason.trim()) {
      setReasonError(true)
      return
    }
    void act(() => requisitionsApi.reject(actor, r.id, reason.trim()), `Rejected — "${r.title}" was sent back to ${owner}.`)
  }

  const errorBanner = error && (
    <Banner variant="danger" title="That didn't go through.">
      <p>{error}</p>
    </Banner>
  )

  if (r.status === 'draft') {
    return (
      <>
        <Banner variant="info" title="This requisition is still a draft.">
          <p>It's only visible to you until you submit it for approval.</p>
        </Banner>
        {!reviewer && (
          <Link className="btn btn-primary" to={`/requisitions/${r.id}/edit`}>
            Edit draft
          </Link>
        )}
      </>
    )
  }

  if (r.status === 'pending_approval') {
    return (
      <>
        {errorBanner}
        <div className="card">
          <h3 className="section-title">Approval</h3>
          <p className="text-muted">
            Submitted by {owner} on {formatDate(r.submittedAt)}.
          </p>
          {rejecting && (
            <>
              <div className="field mt-2">
                <label className="field-label" htmlFor="reject-reason">
                  Reason for rejection
                </label>
                <textarea
                  id="reject-reason"
                  className="textarea"
                  placeholder="Explain what needs to change before this can be resubmitted."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {reasonError && <div className="field-error">Enter a reason so the hiring manager knows what to fix.</div>}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={confirmReject}>
                  Confirm rejection
                </button>
              </div>
            </>
          )}
          <div className="mt-2 flex gap-2">
            <button
              className="btn btn-primary"
              disabled={!reviewer || busy}
              onClick={() => act(() => requisitionsApi.approve(actor, r.id), `Published — "${r.title}" is now open on the job board.`)}
            >
              Approve
            </button>
            <button className="btn btn-danger" disabled={!reviewer || busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </div>
          {!reviewer && (
            <p className="field-hint mt-2">
              Only a Recruiter or HR Admin can approve or reject a requisition. As a Hiring Manager, it stays pending approval.
            </p>
          )}
        </div>
        <div className="card">
          <h3 className="section-title">Ownership</h3>
          <dl className="m-0 mb-3">
            <dt className="text-sm text-fg-muted">Hiring manager</dt>
            <dd className="m-0 mt-[2px]">{owner}</dd>
          </dl>
          <button className="btn btn-secondary" disabled title="Reassignment is only available once a requisition is open.">
            Reassign owner
          </button>
          <p className="field-hint mt-2">
            Reassignment is only available once a requisition is open — this request stays with {owner} while it's pending.
          </p>
        </div>
      </>
    )
  }

  if (r.status === 'rejected') {
    return (
      <>
        <Banner variant="danger" title={`Rejected by ${r.rejectedBy} on ${formatDate(r.rejectedAt)}.`}>
          <p>{r.rejectionReason}</p>
        </Banner>
        {reviewer ? (
          <p className="field-hint">Only the hiring manager who owns this requisition can resubmit it.</p>
        ) : (
          <Link className="btn btn-primary" to={`/requisitions/${r.id}/edit`}>
            Resubmit for approval
          </Link>
        )}
      </>
    )
  }

  const ownerChanged = r.hiringManager && !r.hiringManager.eligible
  return (
    <>
      <div className="card">
        <h3 className="section-title">Ownership</h3>
        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <div>
            <dt className="text-sm text-fg-muted">Hiring manager</dt>
            <dd className="m-0 mt-[2px]">{owner}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">Approved by</dt>
            <dd className="m-0 mt-[2px]">{r.approvedBy}</dd>
          </div>
        </dl>
        {ownerChanged && (
          <div className="mt-3">
            <Banner variant="warning" title={`${owner}'s role has changed since this requisition opened.`}>
              <p>It remains open with its candidate pipeline unchanged until a Recruiter or HR Admin reassigns it to a new hiring manager.</p>
            </Banner>
          </div>
        )}
        <button
          className="btn btn-secondary mt-3"
          disabled={!reviewer}
          title={reviewer ? undefined : 'Only a Recruiter or HR Admin can reassign a requisition.'}
          onClick={() => setReassigning(true)}
        >
          Reassign owner
        </button>
        {!reviewer && (
          <p className="field-hint mt-2">
            Only a Recruiter or HR Admin can reassign a requisition. As a Hiring Manager, this reassignment request would be refused.
          </p>
        )}
      </div>
      <div className="card">
        <h3 className="section-title">Candidate pipeline</h3>
        <p className="text-muted">Candidates stay on the requisition even if its ownership changes.</p>
        <table className="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {r.pipeline.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-muted">
                  No candidates in the pipeline yet.
                </td>
              </tr>
            ) : (
              r.pipeline.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.stage}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {reassigning && (
        <ReassignModal
          requisition={r}
          onClose={() => setReassigning(false)}
          onReassigned={(_updated, name) => {
            setReassigning(false)
            onChanged(`Reassigned to ${name}. The candidate pipeline is unchanged.`)
          }}
        />
      )}
    </>
  )
}
