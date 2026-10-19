export const TEMPLATE_TYPES = ['HomePage', 'LandingPage', 'ClientWork', 'Partner', 'Services'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const PAGE_CONTENT_TYPES: Record<TemplateType, string> = {
  HomePage: 'home_page',
  LandingPage: 'landing_page',
  ClientWork: 'client_work',
  Partner: 'partner',
  Services: 'services',
};
