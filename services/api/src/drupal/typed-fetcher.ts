import { DrupalFetchError, fetchDrupalResource } from './drupal-client';
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
      const query =
        definition.include.length > 0
          ? `?include=${definition.include.map(encodeURIComponent).join(',')}`
          : '';
      const body = (await fetchDrupalResource(
        `${definition.endpoint}/${encodeURIComponent(id)}${query}`,
        env,
        definition.jsonApiType,
      )) as { data?: unknown } | null;
      const data = body?.data as JsonApiResource | undefined;
      if (!data || Array.isArray(data) || typeof data !== 'object' || typeof data.attributes !== 'object') {
        throw new DrupalFetchError(`Drupal response for ${definition.jsonApiType} "${id}" is not a resource object`);
      }
      return definition.parse(data);
    },
  };
}
