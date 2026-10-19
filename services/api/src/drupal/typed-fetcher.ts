import { fetchDrupalResource } from './drupal-client';
import type { JsonApiResource } from './jsonapi-types';

// Metadata only: a future rendering layer decides prebuilt-vs-live serving from this tag.
export type FetchCacheStrategy = 'static-revalidatable' | 'per-request';

export interface TypedResourceDefinition<T> {
  jsonApiType: string;
  endpoint: string;
  include: readonly string[];
  cacheStrategy: FetchCacheStrategy;
  parse: (resource: JsonApiResource) => T;
}

export interface TypedFetcher<T> {
  jsonApiType: string;
  cacheStrategy: FetchCacheStrategy;
  fetchById: (id: string, env?: NodeJS.ProcessEnv) => Promise<T>;
}

export function createTypedFetcher<T>(definition: TypedResourceDefinition<T>): TypedFetcher<T> {
  return {
    jsonApiType: definition.jsonApiType,
    cacheStrategy: definition.cacheStrategy,
    async fetchById(id, env = process.env) {
      const query = definition.include.length > 0 ? `?include=${definition.include.join(',')}` : '';
      const body = (await fetchDrupalResource(`${definition.endpoint}/${id}${query}`, env)) as {
        data: JsonApiResource;
      };
      return definition.parse(body.data);
    },
  };
}
