import type { ParagraphInstance } from '../../lib/paragraphs/types'

// Visible marker so every paragraph instance stays represented on the page (AC3) even when its
// native component isn't implemented yet, or the backend couldn't resolve its content.
export function ParagraphFallback({ paragraph }: { paragraph: ParagraphInstance }) {
  return (
    <div data-testid="paragraph-fallback" data-paragraph-type={paragraph.type} data-paragraph-status={paragraph.status ?? 'unresolved'}>
      This content is temporarily unavailable.
    </div>
  )
}
