import { useEffect, useState } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import type { InventoryEntry, ReviewResult } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const RESULT_ACTIONS: { id: ReviewResult; label: string }[] = [
  { id: 'pass', label: 'Mark pass' },
  { id: 'fail', label: 'Mark fail' },
]

function InventoryRow({ entry, onSaved }: { entry: InventoryEntry; onSaved: (e: InventoryEntry) => void }) {
  const [reviewerName, setReviewerName] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [errors, setErrors] = useState<{ reviewerName?: string; reviewDate?: string; form?: string }>({})

  async function record(result: ReviewResult) {
    const next: typeof errors = {}
    if (!reviewerName.trim()) next.reviewerName = 'Enter the reviewer name.'
    if (!reviewDate) next.reviewDate = 'Enter the review date.'
    setErrors(next)
    if (next.reviewerName || next.reviewDate) return
    try {
      const saved = await apiClient.post<{ reviewerName: string; reviewDate: string; result: ReviewResult }>(
        `/inventory/${encodeURIComponent(entry.pageId)}/results`,
        { reviewerName: reviewerName.trim(), reviewDate, result },
      )
      onSaved({ ...entry, reviewerName: saved.reviewerName, reviewDate: saved.reviewDate, status: saved.result })
    } catch (e) {
      setErrors({ form: (e as Error).message })
    }
  }

  return (
    <tr>
      <td>{entry.title || entry.pageId}</td>
      <td>{entry.templateType}</td>
      <td className="mono">{entry.path ?? '—'}</td>
      <td>
        {entry.status === 'pass' && <span className="chip chip-success">Pass</span>}
        {entry.status === 'fail' && <span className="chip chip-danger">Fail</span>}
        {entry.status === null && <span className="text-muted">No result yet</span>}
      </td>
      <td>{entry.reviewerName ?? '—'}</td>
      <td>{entry.reviewDate ?? '—'}</td>
      <td>
        <input
          className="input"
          aria-label={`Reviewer name for ${entry.title || entry.pageId}`}
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
        />
        {errors.reviewerName && <div className="field-error">{errors.reviewerName}</div>}
        <input
          className="input"
          type="date"
          aria-label={`Review date for ${entry.title || entry.pageId}`}
          value={reviewDate}
          onChange={(e) => setReviewDate(e.target.value)}
        />
        {errors.reviewDate && <div className="field-error">{errors.reviewDate}</div>}
        {RESULT_ACTIONS.map((a) => (
          <button key={a.id} className="btn btn-secondary" onClick={() => record(a.id)}>
            {a.label}
          </button>
        ))}
        {errors.form && <div className="field-error">{errors.form}</div>}
      </td>
    </tr>
  )
}

export default function PageInventoryPage() {
  const { data, error, loading, reload } = useAsync(() => apiClient.get<InventoryEntry[]>('/inventory'))
  const [rows, setRows] = useState<InventoryEntry[]>([])
  useEffect(() => {
    if (data) setRows(data)
  }, [data])

  return (
    <Layout title="Page inventory" crumbs={[{ label: 'QA Tracker' }]}>
      {error ? (
        <>
          <Banner kind="danger" title="Couldn't load the page inventory">
            The inventory could not be built from Drupal. Try again.
          </Banner>
          <button className="btn btn-secondary" onClick={reload}>
            Retry
          </button>
        </>
      ) : !loading && rows.length === 0 ? (
        <div className="empty-state">
          <p>
            <strong>No published pages found</strong>
          </p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Template</th>
              <th>Path</th>
              <th>Status</th>
              <th>Reviewer</th>
              <th>Review date</th>
              <th>Record result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <InventoryRow
                key={entry.pageId}
                entry={entry}
                onSaved={(saved) => setRows((rs) => rs.map((r) => (r.pageId === saved.pageId ? saved : r)))}
              />
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
