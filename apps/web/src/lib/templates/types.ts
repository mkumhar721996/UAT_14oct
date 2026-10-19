import type { ParagraphInstance } from '../paragraphs/types'

export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
  paragraphs?: ParagraphInstance[]
}
