import type { DrupalNode } from '../../lib/templates/types'

export function ClientWorkTemplate({ node }: { node: DrupalNode }) {
  return <div data-testid="client-work-template">{node.contentType}</div>
}
