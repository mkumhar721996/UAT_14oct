import { sanitizeCmsHtml } from './html-sanitizer';
import { fetchDrupalHtmlFragment } from './drupal-client';
import type { TypedFetcher } from './typed-fetcher';

// Single place where fetched legacy markup is sanitized, so no registration can forget to.
export function createLegacyFragmentFetcher(definition: {
  jsonApiType: string;
  endpoint: string;
}): TypedFetcher<{ html: string }> {
  return {
    jsonApiType: definition.jsonApiType,
    cacheStrategy: 'static-revalidatable',
    async fetchById(id, env = process.env) {
      const raw = await fetchDrupalHtmlFragment(`${definition.endpoint}/${encodeURIComponent(id)}`, env, definition.jsonApiType);
      return { html: sanitizeCmsHtml(raw) };
    },
  };
}
