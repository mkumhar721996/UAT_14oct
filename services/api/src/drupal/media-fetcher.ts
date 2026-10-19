import { createTypedFetcher, type TypedFetcher } from './typed-fetcher';

// Shared (not landing-page-specific) so sibling template stories reuse one registration.
export function createMediaImageFetcher(): TypedFetcher<{ url: string; alt: string }> {
  return createTypedFetcher({
    jsonApiType: 'media--image',
    endpoint: '/jsonapi/media/image',
    include: [],
    cacheStrategy: 'static-revalidatable',
    parse: (r) => ({ url: r.attributes.url as string, alt: (r.attributes.alt as string) ?? '' }),
  });
}
