import { Link, useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { ReadonlyField, StatusChip } from '../components/DefectParts'
import { Layout } from '../components/Layout'
import { apiClient } from '../lib/apiClient'
import { fmtDateTime } from '../lib/format'
import type { Defect } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function DefectDetailPage() {
  const { id = '' } = useParams()
  const { data: defect, error } = useAsync(() => apiClient.get<Defect>(`/defects/${id}`))

  return (
    <Layout
      title={defect ? `${defect.defectNumber} — ${defect.title}` : 'Defect detail'}
      crumbs={[{ label: 'Defects' }]}
      actions={
        <Link className="btn btn-primary" to={`/defects/${id}/edit`}>
          Edit defect
        </Link>
      }
    >
      {error ? (
        <Banner kind="danger" title="We couldn't load this defect">
          {error.message}
        </Banner>
      ) : !defect ? (
        <div className="card" aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18, marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        </div>
      ) : (
        <>
          <div className="detail-header">
            <div>
              <div className="detail-id">{defect.defectNumber}</div>
              <div className="detail-title">{defect.title}</div>
              <div className="detail-status-row">
                <StatusChip status={defect.status} />
                <span className="text-muted">Assignee: {defect.assigneeName ?? 'Unassigned'}</span>
              </div>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <h3 className="block-title">Description</h3>
              <p className="readable-block">{defect.description}</p>
              <h3 className="block-title">Reproduction details</h3>
              <p className="readable-block">{defect.reproSteps}</p>
            </div>
            <div className="card">
              <h3 className="block-title" style={{ marginTop: 0 }}>
                Record
              </h3>
              <ReadonlyField label="Severity">{defect.severity}</ReadonlyField>
              <ReadonlyField label="Priority">{defect.priority ?? 'Not yet triaged'}</ReadonlyField>
              <ReadonlyField label="Type">{defect.type}</ReadonlyField>
              <ReadonlyField label="Assignee">{defect.assigneeName ?? 'Unassigned'}</ReadonlyField>
              <ReadonlyField label="Reporter">{defect.reporterName ?? defect.reporterId}</ReadonlyField>
              <ReadonlyField label="Environment">{defect.environment ?? '—'}</ReadonlyField>
              <ReadonlyField label="Created">{fmtDateTime(defect.createdAt)}</ReadonlyField>
              <ReadonlyField label="Last updated">{fmtDateTime(defect.updatedAt)}</ReadonlyField>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
