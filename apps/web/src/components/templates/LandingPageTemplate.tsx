import { ParagraphList } from '../paragraphs/ParagraphRenderer'
import type { ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import { isResolvedParagraph, toParagraphInstances, type DrupalNode } from '../../lib/templates/types'
import { ParagraphDispatcher } from '../paragraphs/ParagraphDispatcher'

export function LandingPageTemplate({
  node,
  paragraphDispatchTable: table,
}: {
  node: DrupalNode
  paragraphDispatchTable?: ParagraphDispatchTable
}) {
  const resolvedParagraphs = (node.paragraphs ?? []).filter(isResolvedParagraph)
  const paragraphInstances = toParagraphInstances(node.paragraphs)

  return (
    <article data-testid="landing-page-template">
      <h1>{node.title}</h1>
      {node.bodyHtml && <div className="landing-page-body" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />}
      {(node.images ?? []).map((img) => (
        <img key={img.url} src={img.url} alt={img.alt} />
      ))}
      {resolvedParagraphs.map((p, i) => (
        <ParagraphDispatcher key={i} paragraph={p} />
      ))}
      <ParagraphList paragraphs={paragraphInstances} table={table} />
    </article>
  )
}
