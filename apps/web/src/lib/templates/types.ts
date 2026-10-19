import type { ParagraphInstance } from '../paragraphs/types'

export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
  paragraphs?: ParagraphInstance[]
}

export type ComposedParagraph =
  | { status: 'component'; componentKey: string; data: unknown }
  | { status: 'html-fragment'; html: string }
  | { status: 'unresolved' | 'failed' }

export interface ClientWorkPageData {
  title: string
  body: string
  heroImage: { url: string; alt: string } | null
  paragraphs: ComposedParagraph[]
}
