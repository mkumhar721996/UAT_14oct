import type { DrupalNode } from '../../lib/templates/types'

export function HomePageTemplate({ node }: { node: DrupalNode }) {
  return <div data-testid="home-page-template">{node.contentType}</div>
}
