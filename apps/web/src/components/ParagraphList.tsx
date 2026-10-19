import type { ComponentType } from 'react'
import type { ComposedParagraph } from '../lib/templates/types'
import { HtmlFragmentParagraph } from './HtmlFragmentParagraph'

export type ParagraphComponentMap = Record<string, ComponentType<{ data: any }>>

// Component entries are added by the Paragraph/Component Library epic. Unresolved, failed and
// not-yet-mapped paragraphs render nothing so they never hide their siblings.
export function ParagraphList({
  paragraphs,
  componentMap = {},
}: {
  paragraphs: ComposedParagraph[]
  componentMap?: ParagraphComponentMap
}) {
  return (
    <>
      {paragraphs.map((paragraph, index) => {
        if (paragraph.status === 'html-fragment') return <HtmlFragmentParagraph key={index} html={paragraph.html} />
        if (paragraph.status !== 'component') return null
        const Component = Object.prototype.hasOwnProperty.call(componentMap, paragraph.componentKey)
          ? componentMap[paragraph.componentKey]
          : undefined
        return Component ? <Component key={index} data={paragraph.data} /> : null
      })}
    </>
  )
}
