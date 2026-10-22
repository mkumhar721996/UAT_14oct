import { useParams } from 'react-router-dom'
import { TemplateRouter } from '../components/templates/TemplateRouter'
import { apiClient } from '../lib/apiClient'
import type { DrupalNode } from '../lib/templates/types'
import { useAsync } from '../lib/useAsync'

/** Public (unauthenticated) marketing route: no Layout chrome. */
export default function LandingPageRoute() {
  const { pageId = '' } = useParams()
  const { data, error, loading } = useAsync(() => apiClient.get<DrupalNode>(`/pages/landing-page/${encodeURIComponent(pageId)}`))
  if (loading) return <p>Loading…</p>
  if (error || !data) return <p>This page couldn't be loaded.</p>
  return <TemplateRouter node={data} />
}
