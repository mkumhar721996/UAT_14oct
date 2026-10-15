import { useEffect, useState } from 'react'
import { requisitionsApi, type Requisition } from '../../api/requisitionsApi'
import { useActor } from '../../auth/ActorContext'
import { Banner } from '../../components/Banner'
import { requisitionCode, roleLabel } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

export function ReassignModal({
  requisition,
  onClose,
  onReassigned,
}: {
  requisition: Requisition
  onClose: () => void
  onReassigned: (updated: Requisition, newOwnerName: string) => void
}) {
  const actor = useActor()
  const { state } = useLoad(() => requisitionsApi.reassignmentTargets(actor), [actor.id])
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const targets = state.status === 'ready' ? state.data : []
  const eligible = targets.filter((u) => u.eligible && u.id !== requisition.hiringManagerId)
  const ineligible = targets.filter((u) => !u.eligible)

  async function confirm() {
    if (!selected) {
      setError('Select a hiring manager to reassign to.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const updated = await requisitionsApi.reassign(actor, requisition.id, selected)
      onReassigned(updated, targets.find((u) => u.id === selected)?.name ?? selected)
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reassign-title">
        <h2 id="reassign-title" className="m-0 mb-1 text-lg font-semibold">
          Reassign requisition owner
        </h2>
        <p className="text-muted">
          {requisition.title} ({requisitionCode(requisition.id)}) — currently owned by {requisition.hiringManager?.name ?? requisition.hiringManagerId}.
        </p>
        {state.status === 'error' && <Banner variant="danger" title="Couldn't load hiring managers."><p>{state.message}</p></Banner>}
        {error && <div className="field-error mb-2" role="alert">{error}</div>}
        <div className="field">
          <label className="field-label" htmlFor="reassign-select">
            New hiring manager
          </label>
          <select id="reassign-select" className="select" value={selected} onChange={(e) => setSelected(e.target.value)} autoFocus>
            <option value="">Select a hiring manager</option>
            <optgroup label="Hiring managers">
              {eligible.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Not eligible — missing the Hiring Manager role">
              {ineligible.map((u) => (
                <option key={u.id} value={u.id} disabled>
                  {u.name} ({roleLabel(u.role)})
                </option>
              ))}
            </optgroup>
          </select>
          <div className="field-hint">
            Only users with the Hiring Manager role can own a requisition — other roles are listed but can't be selected.
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={pending} onClick={confirm}>
            {pending ? 'Reassigning…' : 'Confirm reassignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
