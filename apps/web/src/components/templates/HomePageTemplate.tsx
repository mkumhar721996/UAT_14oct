import { ParagraphList } from '../paragraphs/ParagraphRenderer'
import type { ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import { toParagraphInstances, type DrupalNode } from '../../lib/templates/types'

export function HomePageTemplate({
  node,
  paragraphDispatchTable: table,
}: {
  node: DrupalNode
  paragraphDispatchTable?: ParagraphDispatchTable
}) {
  return (
    <div data-testid="home-page-template">
      {node.contentType}
      <ParagraphList paragraphs={toParagraphInstances(node.paragraphs)} table={table} />
    </div>
  )
}
