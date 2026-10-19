import type { ReactElement } from 'react'

export interface ParagraphInstance {
  type: string
  id: string
  // Populated when this instance comes from a backend that already resolved its content
  // (e.g. the landing page API); other producers of ParagraphInstance leave these unset and
  // their registered render path is expected to fetch its own data.
  status?: 'resolved' | 'unresolved' | 'failed'
  componentKey?: string
  data?: unknown
}

export type ParagraphRenderPath =
  | { kind: 'component'; Component: (props: { paragraph: ParagraphInstance }) => ReactElement | null }
  | { kind: 'html-fragment'; fetchHtml: (paragraph: ParagraphInstance) => Promise<string> }
