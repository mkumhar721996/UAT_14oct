import type { DrupalNode, TemplateType } from './types'

const TEMPLATE_TYPE_BY_VALUE: Record<string, TemplateType | undefined> = {
  home_page: 'HomePage',
  landing_page: 'LandingPage',
  client_work: 'ClientWork',
  partner: 'Partner',
  services: 'Services',
}

const lookup = (value: string) => TEMPLATE_TYPE_BY_VALUE[value.trim().toLowerCase()]

export function resolveTemplateType(node: DrupalNode): TemplateType | null {
  const fromTemplateField = node.templateField ? lookup(node.templateField) : undefined
  const fromContentType = lookup(node.contentType)
  if (fromTemplateField && fromContentType && fromTemplateField !== fromContentType) return null
  return fromTemplateField ?? fromContentType ?? null
}
