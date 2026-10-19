export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
  title?: string
  bodyHtml?: string
  images?: Array<{ url: string; alt: string }>
  paragraphs?: ResolvedParagraph[]
}

export interface ResolvedParagraph {
  status: 'resolved' | 'unresolved' | 'failed'
  jsonApiType: string
  componentKey?: string
  data?: unknown
}
