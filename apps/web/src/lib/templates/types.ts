import type { ParagraphInstance } from '../paragraphs/types'

export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
  title?: string
  bodyHtml?: string
  images?: Array<{ url: string; alt: string }>
  // A backend that already resolved its paragraphs' content (ResolvedParagraph) and one that
  // hasn't (plain ParagraphInstance) are both accepted here; toParagraphInstances normalizes
  // either shape into the dispatch table's canonical ParagraphInstance.
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

/** Normalizes a DrupalNode's mixed paragraphs field into the dispatch table's ParagraphInstance shape. */
export function toParagraphInstances(paragraphs: DrupalNode['paragraphs']): ParagraphInstance[] {
  return (paragraphs ?? []).map((p, index) =>
    isResolvedParagraph(p)
      ? { type: p.jsonApiType, id: String(index), status: p.status, componentKey: p.componentKey, data: p.data }
      : p,
  )
}
