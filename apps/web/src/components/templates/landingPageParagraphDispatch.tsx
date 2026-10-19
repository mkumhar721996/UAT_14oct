import type { ReactElement } from 'react'
import type { ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { ParagraphInstance } from '../../lib/paragraphs/types'
import { ParagraphFallback } from '../paragraphs/ParagraphFallback'

// Contract shared with services/api/src/pages/landing-page-paragraph-dispatch.ts, which tags
// legacy paragraphs' resolved data with this componentKey. Keep both in sync.
export const LEGACY_HTML_FRAGMENT_KEY = 'LegacyHtmlFragment'

type NativeParagraphComponent = (props: { data: unknown }) => ReactElement

// Populated by the Paragraph/Component Library epic.
export const NATIVE_PARAGRAPH_COMPONENTS: Record<string, NativeParagraphComponent> = {}

function NativeParagraph({ paragraph }: { paragraph: ParagraphInstance }) {
  const Component = paragraph.componentKey ? NATIVE_PARAGRAPH_COMPONENTS[paragraph.componentKey] : undefined
  return Component ? <Component data={paragraph.data} /> : <ParagraphFallback paragraph={paragraph} />
}

async function fetchLegacyHtml(paragraph: ParagraphInstance): Promise<string> {
  return (paragraph.data as { html?: string } | undefined)?.html ?? ''
}

/**
 * Ensures every distinct paragraph type on this landing page has a dispatch entry, so AC3
 * ("every paragraph instance appears") holds even when a native component isn't implemented yet
 * or the backend couldn't resolve an item. Already-registered types (an injected test table, or
 * a real component registered elsewhere) are left untouched.
 */
export function registerLandingPageParagraphTypes(paragraphs: ParagraphInstance[], table: ParagraphDispatchTable): void {
  for (const paragraph of paragraphs) {
    if (table.resolve(paragraph.type)) continue
    if (paragraph.status === 'resolved' && paragraph.componentKey === LEGACY_HTML_FRAGMENT_KEY) {
      table.register({ paragraphType: paragraph.type, renderPath: { kind: 'html-fragment', fetchHtml: fetchLegacyHtml } })
    } else {
      table.register({ paragraphType: paragraph.type, renderPath: { kind: 'component', Component: NativeParagraph } })
    }
  }
}
