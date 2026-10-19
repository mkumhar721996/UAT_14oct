import type { ReactElement } from 'react'

export interface ParagraphInstance {
  type: string
  id: string
}

export type ParagraphRenderPath =
  | { kind: 'component'; Component: (props: { paragraph: ParagraphInstance }) => ReactElement | null }
  | { kind: 'html-fragment'; fetchHtml: (paragraph: ParagraphInstance) => Promise<string> }
