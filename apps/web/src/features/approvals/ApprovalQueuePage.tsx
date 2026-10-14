import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { requisitionsApi, type Requisition } from '../../api/requisitionsApi'
import { useActor } from '../../auth/ActorContext'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { useToast } from '../../components/Toast'
import { formatDate, requisitionCode } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

export function ApprovalQueuePage() {
  const actor = useActor()
  const { state, reload } = useLoad(() => requisitionsApi.listPending(actor), [actor.id])
  const toast = useToast()
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(r: Requisition, run: () => Promise<unknown>, message: string) {
    setBusyId(r.id)
    setError(null)
    try {
      await run()
      setRejectingId(null)
      setReason('')
      toast(message)
      reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  function confirmReject(r: Requisition) {
    if (!reason.trim()) {
      setReasonError(true)
      return
    }
    void act(
      r,
      () => requisitionsApi.reject(actor, r.id, reason.trim()),
      `Rejected — "${r.title}" was sent back to ${r.hiringManager?.name ?? r.hiringManagerId}.`,
    )
  }

  return (
    <AppShell
      title="Approval queue"
      context="Recruiter / HR Admin console"
      actions={
        <button className="btn btn-secondary" onClick={reload}>
          Refresh
        </button>
      }
    >
      <p className="text-muted max-w-[65ch]">
        Requisitions waiting on a Recruiter or HR Admin decision. Approving publishes the role to the job board; rejecting
        sends it back to the hiring manager with a reason.
      </p>
      {error && (
        <Banner variant="danger" title="That didn't go through.">
          <p>{error}</p>
        </Banner>
      )}
      {state.status === 'loading' && (
        <table className="table" aria-busy="true" aria-label="Loading approval queue">
          <tbody>
            {[1, 2, 3].map((n) => (
              <tr key={n}>
                <td className="p-3">
                  <div className="skeleton-bar w-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {state.status === 'error' && (
        <Banner variant="danger" title="Couldn't load the approval queue.">
          <p>Check your connection and try again.</p>
          <button className="btn btn-secondary btn-sm mt-2" onClick={reload}>
            Retry
          </button>
        </Banner>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="req-empty-state">
          <h3>No requisitions waiting on approval</h3>
          <p>Nice work — you're all caught up.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Requisition</th>
              <th>Hiring manager</th>
              <th>Department</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td>
                    <Link className="font-semibold" to={`/requisitions/${r.id}`}>
                      {r.title}
                    </Link>
                    <br />
                    <span className="text-muted">{requisitionCode(r.id)}</span>
                  </td>
                  <td>{r.hiringManager?.name ?? r.hiringManagerId}</td>
                  <td>{r.department}</td>
                  <td>{formatDate(r.submittedAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busyId === r.id}
                        aria-label={`Approve ${r.title}`}
                        onClick={() =>
                          act(r, () => requisitionsApi.approve(actor, r.id), `Published — "${r.title}" is now open on the job board.`)
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busyId === r.id}
                        aria-label={`Reject ${r.title}`}
                        onClick={() => {
                          setRejectingId(r.id)
                          setReason('')
                          setReasonError(false)
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
                {rejectingId === r.id && (
                  <tr className="[&>td]:bg-subtle">
                    <td colSpan={5}>
                      <div className="field max-w-[480px]">
                        <label className="field-label" htmlFor={`reason-${r.id}`}>
                          Reason for rejection
                        </label>
                        <textarea
                          id={`reason-${r.id}`}
                          className="textarea"
                          placeholder="Explain what needs to change before this can be resubmitted."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        {reasonError && <div className="field-error">Enter a reason so the hiring manager knows what to fix.</div>}
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => setRejectingId(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => confirmReject(r)}>
                          Confirm rejection
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  )
}
