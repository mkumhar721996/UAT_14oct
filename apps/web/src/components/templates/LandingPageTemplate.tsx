import { ParagraphList } from '../paragraphs/ParagraphRenderer'
import { paragraphDispatchTable as defaultParagraphDispatchTable, type ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import { toParagraphInstances, type DrupalNode } from '../../lib/templates/types'
import { registerLandingPageParagraphTypes } from './landingPageParagraphDispatch'

export function LandingPageTemplate({
  node,
  paragraphDispatchTable: table = defaultParagraphDispatchTable,
}: {
  node: DrupalNode
  paragraphDispatchTable?: ParagraphDispatchTable
}) {
  const paragraphInstances = toParagraphInstances(node.paragraphs)
  registerLandingPageParagraphTypes(paragraphInstances, table)

  return (
    <article data-testid="landing-page-template">
      <h1>{node.title}</h1>
      {node.bodyHtml && <div className="landing-page-body" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />}
      {(node.images ?? []).map((img) => (
        <img key={img.url} src={img.url} alt={img.alt} />
      ))}
      <ParagraphList paragraphs={paragraphInstances} table={table} />
    </article>
  )
}
