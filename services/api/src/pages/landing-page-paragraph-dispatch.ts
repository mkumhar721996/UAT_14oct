import { createLegacyFragmentFetcher } from '../drupal/legacy-fragment-fetcher';
import type { ResourceRegistry } from '../drupal/resource-registry';
import { createTypedFetcher } from '../drupal/typed-fetcher';

// PLACEHOLDER machine names/paths: swap for the real Drupal schema once confirmed.
const NATIVE_PARAGRAPH_TYPES = [
  { jsonApiType: 'paragraph--hero_banner', endpoint: '/jsonapi/paragraph/hero_banner', componentKey: 'HeroBanner' },
  { jsonApiType: 'paragraph--rich_text', endpoint: '/jsonapi/paragraph/rich_text', componentKey: 'RichText' },
];

const LEGACY_PARAGRAPH_TYPES = [
  'paragraph--legacy_promo',
  'paragraph--legacy_cta',
  'paragraph--legacy_testimonial',
  'paragraph--legacy_media_embed',
  'paragraph--legacy_accordion',
  'paragraph--legacy_table',
];

export const LEGACY_FRAGMENT_ENDPOINT = '/paragraph/fragment';

// Contract shared with apps/web/src/components/paragraphs/ParagraphDispatcher.tsx, which special-cases
// this componentKey to render an HTML fragment instead of a native component. Keep both in sync.
export const LEGACY_HTML_FRAGMENT_KEY = 'LegacyHtmlFragment';

export function registerLandingPageParagraphDispatch(registry: ResourceRegistry): void {
  for (const { jsonApiType, endpoint, componentKey } of NATIVE_PARAGRAPH_TYPES) {
    registry.register({
      jsonApiType,
      componentKey,
      fetcher: createTypedFetcher({
        jsonApiType,
        endpoint,
        include: [],
        cacheStrategy: 'static-revalidatable',
        parse: (r) => r.attributes,
      }),
    });
  }
  for (const jsonApiType of LEGACY_PARAGRAPH_TYPES) {
    registry.register({
      jsonApiType,
      componentKey: LEGACY_HTML_FRAGMENT_KEY,
      fetcher: createLegacyFragmentFetcher({ jsonApiType, endpoint: LEGACY_FRAGMENT_ENDPOINT }),
    });
  }
}
