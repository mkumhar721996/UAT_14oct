import { ParagraphList } from '../paragraphs/ParagraphRenderer'
import type { ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { DrupalNode } from '../../lib/templates/types'

export function ClientWorkTemplate({
  node,
  paragraphDispatchTable: table,
}: {
  node: DrupalNode
  paragraphDispatchTable?: ParagraphDispatchTable
}) {
  return (
    <div data-testid="client-work-template">
      {node.contentType}
      <ParagraphList paragraphs={node.paragraphs ?? []} table={table} />
    </div>
  )
}
