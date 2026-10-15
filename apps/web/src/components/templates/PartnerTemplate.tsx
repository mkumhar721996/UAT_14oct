import type { DrupalNode } from '../../lib/templates/types'

export function PartnerTemplate({ node }: { node: DrupalNode }) {
  return <div data-testid="partner-template">{node.contentType}</div>
}
