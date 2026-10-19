import type { DrupalNode, TemplateType } from './types'

const TEMPLATE_TYPE_BY_VALUE = new Map<string, TemplateType>([
  ['home_page', 'HomePage'],
  ['landing_page', 'LandingPage'],
  ['client_work', 'ClientWork'],
  ['partner', 'Partner'],
  ['services', 'Services'],
])

const lookup = (value: string) => TEMPLATE_TYPE_BY_VALUE.get(value.trim().toLowerCase())

export function resolveTemplateType(node: DrupalNode): TemplateType | null {
  const templateField = node.templateField?.trim()
  const fromContentType = lookup(node.contentType)
  if (!templateField) return fromContentType ?? null
  const fromTemplateField = lookup(templateField)
  if (!fromTemplateField) return null
  if (fromContentType && fromContentType !== fromTemplateField) return null
  return fromTemplateField
}
