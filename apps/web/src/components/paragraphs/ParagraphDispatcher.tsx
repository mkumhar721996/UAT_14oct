import type { ReactElement } from 'react'
import type { ResolvedParagraph } from '../../lib/templates/types'
import { LegacyParagraphFragment } from './LegacyParagraphFragment'

type NativeParagraphComponent = (props: { data: unknown }) => ReactElement

// Populated by the Paragraph/Component Library epic.
export const NATIVE_PARAGRAPH_COMPONENTS: Record<string, NativeParagraphComponent> = {}

export function ParagraphDispatcher({
  paragraph,
  registry = NATIVE_PARAGRAPH_COMPONENTS,
}: {
  paragraph: ResolvedParagraph
  registry?: Record<string, NativeParagraphComponent>
}) {
  if (paragraph.status !== 'resolved') return null
  if (paragraph.componentKey === 'LegacyHtmlFragment') {
    return <LegacyParagraphFragment html={(paragraph.data as { html: string }).html} />
  }
  const Component = paragraph.componentKey ? registry[paragraph.componentKey] : undefined
  return Component ? <Component data={paragraph.data} /> : null
}
