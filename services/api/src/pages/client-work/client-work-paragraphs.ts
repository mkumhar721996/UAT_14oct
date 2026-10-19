import { createHtmlFragmentFetcher } from '../../drupal/html-fragment-fetcher';
import type { ResourceRegistry } from '../../drupal/resource-registry';
import { createTypedFetcher } from '../../drupal/typed-fetcher';

// Type names, component keys and fragment endpoints are placeholders until confirmed against Drupal.
const NATIVE_PARAGRAPHS = [
  { type: 'quote', componentKey: 'Quote' },
  { type: 'text_block', componentKey: 'TextBlock' },
  { type: 'image_gallery', componentKey: 'ImageGallery' },
];

const LEGACY_PARAGRAPHS = [
  'legacy_quote',
  'legacy_stats',
  'legacy_video',
  'legacy_cta',
  'legacy_carousel',
  'legacy_accordion',
];

// Call once per registry; a repeat call surfaces the registry's "already registered" error.
export function registerClientWorkParagraphs(registry: ResourceRegistry): void {
  for (const { type, componentKey } of NATIVE_PARAGRAPHS) {
    const jsonApiType = `paragraph--${type}`;
    registry.register({
      jsonApiType,
      componentKey,
      fetcher: createTypedFetcher<Record<string, unknown>>({
        jsonApiType,
        endpoint: `/jsonapi/paragraph/${type}`,
        include: [],
        cacheStrategy: 'static-revalidatable',
        parse: (resource) => resource.attributes,
      }),
    });
  }
  for (const type of LEGACY_PARAGRAPHS) {
    const jsonApiType = `paragraph--${type}`;
    registry.register({
      jsonApiType,
      fetcher: createHtmlFragmentFetcher({
        jsonApiType,
        endpoint: `/fragments/paragraph/${type}`,
        cacheStrategy: 'static-revalidatable',
      }),
    });
  }
}
