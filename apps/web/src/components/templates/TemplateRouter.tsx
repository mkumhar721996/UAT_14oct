import { resolveTemplateType } from '../../lib/templates/resolveTemplateType'
import type { DrupalNode, TemplateType } from '../../lib/templates/types'
import { ClientWorkTemplate } from './ClientWorkTemplate'
import { HomePageTemplate } from './HomePageTemplate'
import { LandingPageTemplate } from './LandingPageTemplate'
import { PartnerTemplate } from './PartnerTemplate'
import { ServicesTemplate } from './ServicesTemplate'

const TEMPLATE_RENDERERS: Record<TemplateType, (props: { node: DrupalNode }) => JSX.Element> = {
  HomePage: HomePageTemplate,
  LandingPage: LandingPageTemplate,
  // The router only knows the node's type, not its content; the real page data comes from ClientWorkPage.
  ClientWork: () => <ClientWorkTemplate node={{ title: '', body: '', heroImage: null, paragraphs: [] }} />,
  Partner: PartnerTemplate,
  Services: ServicesTemplate,
}

export function TemplateRouter({ node }: { node: DrupalNode }) {
  const templateType = resolveTemplateType(node)
  if (!templateType) return null
  const Renderer = TEMPLATE_RENDERERS[templateType]
  return <Renderer node={node} />
}
