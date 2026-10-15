export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export interface DrupalNode {
  contentType: string
  templateField?: string | null
}
