import type { DrupalNode } from '../../lib/templates/types'

export function ServicesTemplate({ node }: { node: DrupalNode }) {
  return <div data-testid="services-template">{node.contentType}</div>
}
