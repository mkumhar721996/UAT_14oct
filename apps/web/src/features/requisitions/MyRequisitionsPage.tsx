import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { requisitionsApi, type Requisition } from '../../api/requisitionsApi'
import { useActor } from '../../auth/ActorContext'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { StatusChip } from '../../components/StatusChip'
import { Toast } from '../../components/Toast'
import { formatDate, requisitionCode } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

function lastActivity(r: Requisition): string {
  switch (r.status) {
    case 'draft':
      return `Saved ${formatDate(r.lastSavedAt)}`
    case 'pending_approval':
      return `Submitted ${formatDate(r.submittedAt)}`
    case 'open':
      return `Published ${formatDate(r.publishedAt)}`
    case 'rejected':
      return `Rejected ${formatDate(r.rejectedAt)}`
  }
}

/** Lists requisitions for the signed-in manager (`mine`) or every non-draft one for reviewers (`open`). */
export function MyRequisitionsPage({ mode = 'mine' }: { mode?: 'mine' | 'open' }) {
  const actor = useActor()
  const navigate = useNavigate()
  const location = useLocation()
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)
  const { state, reload } = useLoad(
    () => requisitionsApi.list(actor, mode === 'open' ? 'open' : undefined),
    [actor.id, mode],
  )
  const isMine = mode === 'mine'

  return (
    <AppShell
      title={isMine ? 'My requisitions' : 'Open requisitions'}
      context={isMine ? 'Hiring Manager console' : 'Recruiter / HR Admin console'}
      actions={
        isMine && (
          <button className="btn btn-primary" onClick={() => navigate('/requisitions/new')}>
            New requisition
          </button>
        )
      }
    >
      <p className="text-muted max-w-[65ch]">
        {isMine
          ? "Requisitions you've created. Submit a draft once it's ready, or resubmit one that was rejected — only you can see and edit your drafts."
          : "Published requisitions. Open one to see its candidate pipeline or reassign its owner."}
      </p>
      {state.status === 'loading' && <p className="text-muted">Loading requisitions…</p>}
      {state.status === 'error' && (
        <Banner variant="danger" title="Couldn't load requisitions.">
          <p>{state.message}</p>
          <button className="btn btn-secondary btn-sm mt-2" onClick={reload}>
            Retry
          </button>
        </Banner>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="empty-state">
          <h3>{isMine ? "You haven't created any requisitions yet" : 'No open requisitions'}</h3>
          {isMine && (
            <>
              <p>Start a new requisition to request a job opening — it's saved as a draft until you submit it.</p>
              <button className="btn btn-primary mt-2" onClick={() => navigate('/requisitions/new')}>
                New requisition
              </button>
            </>
          )}
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Requisition</th>
              <th>Department</th>
              <th>Status</th>
              <th>Last activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="text-muted">{requisitionCode(r.id)}</span>
                </td>
                <td>{r.department ?? '—'}</td>
                <td>
                  <StatusChip status={r.status} />
                </td>
                <td>{lastActivity(r)}</td>
                <td>
                  <Link
                    className="btn btn-secondary btn-sm"
                    to={r.status === 'draft' ? `/requisitions/${r.id}/edit` : `/requisitions/${r.id}`}
                  >
                    {r.status === 'draft' ? 'Edit draft' : 'View'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </AppShell>
  )
}
