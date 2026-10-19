import type { DrupalNode } from '../../lib/templates/types'
import { ParagraphDispatcher } from '../paragraphs/ParagraphDispatcher'

export function LandingPageTemplate({ node }: { node: DrupalNode }) {
  return (
    <article data-testid="landing-page-template">
      <h1>{node.title}</h1>
      {node.bodyHtml && <div className="landing-page-body" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />}
      {(node.images ?? []).map((img) => (
        <img key={img.url} src={img.url} alt={img.alt} />
      ))}
      {(node.paragraphs ?? []).map((p, i) => (
        <ParagraphDispatcher key={i} paragraph={p} />
      ))}
    </article>
  )
}
