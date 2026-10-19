import type { ParagraphInstance } from '../paragraphs/types'

export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
  title?: string
  bodyHtml?: string
  images?: Array<{ url: string; alt: string }>
  // LandingPageTemplate's backend-resolved paragraphs (ResolvedParagraph) and the generic
  // paragraph-dispatch-table paragraphs (ParagraphInstance) are both routed through this field
  // until the two paragraph systems are unified.
  paragraphs?: Array<ResolvedParagraph | ParagraphInstance>
}

export interface ResolvedParagraph {
  status: 'resolved' | 'unresolved' | 'failed'
  jsonApiType: string
  componentKey?: string
  data?: unknown
}

export function isResolvedParagraph(p: ResolvedParagraph | ParagraphInstance): p is ResolvedParagraph {
  return 'status' in p
}

/** Narrows a DrupalNode's mixed paragraphs field down to the generic ParagraphInstance entries. */
export function toParagraphInstances(paragraphs: DrupalNode['paragraphs']): ParagraphInstance[] {
  return (paragraphs ?? []).filter((p): p is ParagraphInstance => !isResolvedParagraph(p))
}
