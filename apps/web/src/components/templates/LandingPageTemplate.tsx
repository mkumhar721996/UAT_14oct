import type { DrupalNode } from '../../lib/templates/types'

export function LandingPageTemplate({ node }: { node: DrupalNode }) {
  return <div data-testid="landing-page-template">{node.contentType}</div>
}
