import { useParams } from 'react-router-dom'
import { Banner } from '../components/Banner'
import { ClientWorkTemplate } from '../components/templates/ClientWorkTemplate'
import { ApiError, apiClient } from '../lib/apiClient'
import type { ClientWorkPageData } from '../lib/templates/types'
import { useAsync } from '../lib/useAsync'

export default function ClientWorkPage() {
  const { pageId = '' } = useParams()
  const { data, error, loading, reload } = useAsync(() =>
    apiClient.get<ClientWorkPageData>(`/pages/client-work/${encodeURIComponent(pageId)}`),
  )

  if (error instanceof ApiError && error.status === 404) {
    return (
      <main className="content">
        <h1 className="heading-lg">Page not found</h1>
        <p className="text-muted">This page does not exist or is not published.</p>
      </main>
    )
  }
  if (error) {
    return (
      <main className="content">
        <Banner kind="danger" title="Couldn't load this page">
          The page could not be loaded. Try again.
        </Banner>
        <button className="btn btn-secondary" onClick={reload}>
          Retry
        </button>
      </main>
    )
  }
  if (loading || !data) return null
  return <ClientWorkTemplate node={data} />
}
