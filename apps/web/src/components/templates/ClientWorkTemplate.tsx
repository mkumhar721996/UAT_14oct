import type { ClientWorkPageData } from '../../lib/templates/types'
import { ParagraphList } from '../ParagraphList'

export function ClientWorkTemplate({ node }: { node: ClientWorkPageData }) {
  return (
    <article data-testid="client-work-template">
      <h1>{node.title}</h1>
      {node.heroImage && <img src={node.heroImage.url} alt={node.heroImage.alt} />}
      <div data-testid="client-work-body" dangerouslySetInnerHTML={{ __html: node.body }} />
      <ParagraphList paragraphs={node.paragraphs} />
    </article>
  )
}
