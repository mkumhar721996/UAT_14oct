import { fetchDrupalHtmlFragment } from './drupal-client';
import type { FetchCacheStrategy } from './typed-fetcher';

export interface HtmlFragmentFetcher {
  jsonApiType: string;
  cacheStrategy: FetchCacheStrategy;
  fetchById: (id: string, env?: NodeJS.ProcessEnv) => Promise<{ html: string }>;
}

// Same shape as a TypedFetcher so legacy paragraphs sit behind the same ResourceRegistration.
export function createHtmlFragmentFetcher(definition: {
  jsonApiType: string;
  endpoint: string;
  cacheStrategy: FetchCacheStrategy;
}): HtmlFragmentFetcher {
  return {
    jsonApiType: definition.jsonApiType,
    cacheStrategy: definition.cacheStrategy,
    async fetchById(id, env = process.env) {
      const html = await fetchDrupalHtmlFragment(`${definition.endpoint}/${encodeURIComponent(id)}`, env);
      return { html };
    },
  };
}
