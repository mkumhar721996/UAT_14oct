import type { JsonApiResource, JsonApiResourceIdentifier } from '../../drupal/jsonapi-types';
import { createTypedFetcher } from '../../drupal/typed-fetcher';

export interface ClientWorkNode {
  published: boolean;
  title: string;
  body: string;
  heroImage: { url: string; alt: string } | null;
  paragraphRefs: JsonApiResourceIdentifier[];
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

// Field names are placeholders until confirmed against the real Drupal schema.
export function parseClientWorkNode(resource: JsonApiResource): ClientWorkNode {
  const { attributes, relationships } = resource;
  const body = attributes.body as { processed?: unknown; value?: unknown } | string | null | undefined;
  const bodyHtml = typeof body === 'string' ? body : asString(body?.processed) || asString(body?.value);
  const heroUrl = asString(attributes.field_hero_image_url);
  const refs = relationships?.field_paragraphs?.data;
  return {
    published: attributes.status === true,
    title: asString(attributes.title),
    body: bodyHtml,
    heroImage: heroUrl ? { url: heroUrl, alt: asString(attributes.field_hero_image_alt) } : null,
    paragraphRefs: Array.isArray(refs)
      ? refs.filter((r) => r && typeof r.type === 'string' && typeof r.id === 'string')
      : [],
  };
}

export const clientWorkPageFetcher = createTypedFetcher<ClientWorkNode>({
  jsonApiType: 'node--client_work',
  endpoint: '/jsonapi/node/client_work',
  include: [],
  cacheStrategy: 'static-revalidatable',
  parse: parseClientWorkNode,
});
