import { Link, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { SeverityTag, StatusChip } from '../components/DefectTags'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
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

export default function DefectDetailPage() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const toast = useToast()
  const { data: defect, error, loading, reload } = useAsync(() => apiClient.get<Defect>(`/defects/${id}`))
  const canEdit = !!defect && (auth?.role === 'admin' || auth?.sub === defect.reportedBy)

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
          <TextRow label="Description" value={defect.description} />
          <TextRow label="Steps to reproduce" value={defect.stepsToReproduce} />
          <TextRow label="Expected result" value={defect.expectedResult} />
          <TextRow label="Actual result" value={defect.actualResult} />
          <TextRow label="Environment / build version" value={defect.environment} />
        </div>
      )}
    </Layout>
  )
}
