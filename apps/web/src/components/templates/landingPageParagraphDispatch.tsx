import type { ReactElement } from 'react'
import { paragraphDispatchTable as defaultParagraphDispatchTable, type ParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { ParagraphInstance } from '../../lib/paragraphs/types'
import { ParagraphFallback } from '../paragraphs/ParagraphFallback'

// Contract shared with services/api/src/pages/landing-page-paragraph-dispatch.ts, which tags
// legacy paragraphs' resolved data with this componentKey. Keep both in sync (and keep the two
// jsonApiType lists below in sync with NATIVE_PARAGRAPH_TYPES/LEGACY_PARAGRAPH_TYPES there) --
// no shared package exists between the two services to enforce this at build time.
export const LEGACY_HTML_FRAGMENT_KEY = 'LegacyHtmlFragment'

const NATIVE_PARAGRAPH_TYPES = ['paragraph--hero_banner', 'paragraph--rich_text']
const LEGACY_PARAGRAPH_TYPES = [
  'paragraph--legacy_promo',
  'paragraph--legacy_cta',
  'paragraph--legacy_testimonial',
  'paragraph--legacy_media_embed',
  'paragraph--legacy_accordion',
  'paragraph--legacy_table',
]

type NativeParagraphComponent = (props: { data: unknown }) => ReactElement

// Populated by the Paragraph/Component Library epic.
export const NATIVE_PARAGRAPH_COMPONENTS: Record<string, NativeParagraphComponent> = {}

/**
 * Chooses, per paragraph INSTANCE (not per type), between its native component, its legacy HTML
 * fragment, or a visible fallback, based on that instance's own resolved status. This is the only
 * render path ever registered for a landing-page paragraph type (see
 * registerLandingPageParagraphTypes below), so one page's transient failure can never change how
 * a later, successfully-resolved instance of the same type renders.
 */
function LandingPageParagraph({ paragraph }: { paragraph: ParagraphInstance }) {
  if (paragraph.status !== 'resolved') return <ParagraphFallback paragraph={paragraph} />
  if (paragraph.componentKey === LEGACY_HTML_FRAGMENT_KEY) {
    const html = (paragraph.data as { html?: string } | undefined)?.html ?? ''
    return <div className="legacy-paragraph" dangerouslySetInnerHTML={{ __html: html }} />
  }
  const Component = paragraph.componentKey ? NATIVE_PARAGRAPH_COMPONENTS[paragraph.componentKey] : undefined
  return Component ? <Component data={paragraph.data} /> : <ParagraphFallback paragraph={paragraph} />
}

/**
 * Registers every landing-page paragraph type into the given dispatch table exactly once; safe to
 * call repeatedly (idempotent per table instance via table.resolve, since register() throws on a
 * duplicate) because the registered render path never depends on render-time data -- unlike a
 * scheme that registers lazily per-instance, which would let whichever instance of a type is seen
 * first (e.g. a transient failure) decide that type's render path for every later page too.
 */
export function registerLandingPageParagraphTypes(table: ParagraphDispatchTable): void {
  for (const paragraphType of [...NATIVE_PARAGRAPH_TYPES, ...LEGACY_PARAGRAPH_TYPES]) {
    if (table.resolve(paragraphType)) continue
    table.register({ paragraphType, renderPath: { kind: 'component', Component: LandingPageParagraph } })
  }
}

// Registered once, at module init, against the shared singleton the real app renders through.
registerLandingPageParagraphTypes(defaultParagraphDispatchTable)
