import { ParagraphList } from '../paragraphs/ParagraphRenderer'
import type { ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { DrupalNode } from '../../lib/templates/types'

export function PartnerTemplate({
  node,
  paragraphDispatchTable: table,
}: {
  node: DrupalNode
  paragraphDispatchTable?: ParagraphDispatchTable
}) {
  return (
    <div data-testid="partner-template">
      {node.contentType}
      <ParagraphList paragraphs={node.paragraphs ?? []} table={table} />
    </div>
  )
}
