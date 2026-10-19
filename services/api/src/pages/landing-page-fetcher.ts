import { sanitizeCmsHtml } from '../drupal/html-sanitizer';
import { toResourceIdentifierArray, type JsonApiResourceIdentifier } from '../drupal/jsonapi-types';
import { createTypedFetcher, type TypedFetcher } from '../drupal/typed-fetcher';

export interface LandingPageNode {
  title: string;
  bodyHtml: string;
  imageRefs: JsonApiResourceIdentifier[];
  paragraphRefs: JsonApiResourceIdentifier[];
}

export function createLandingPageFetcher(): TypedFetcher<LandingPageNode> {
  return createTypedFetcher({
    jsonApiType: 'node--landing_page',
    endpoint: '/jsonapi/node/landing_page',
    include: [],
    cacheStrategy: 'static-revalidatable',
    parse: (r) => ({
      title: r.attributes.title as string,
      bodyHtml: sanitizeCmsHtml((r.attributes.body as { processed?: string } | undefined)?.processed ?? ''),
      imageRefs: toResourceIdentifierArray(r.relationships?.field_image?.data),
      paragraphRefs: toResourceIdentifierArray(r.relationships?.field_paragraphs?.data),
    }),
  });
}
