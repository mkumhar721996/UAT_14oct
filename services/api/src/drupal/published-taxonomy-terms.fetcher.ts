import { createDrupalClient, DrupalClient } from './drupal-client';

export function fetchPublishedTaxonomyTerms<T = unknown>(
  vocabulary: string,
  client: DrupalClient = createDrupalClient(),
): Promise<T> {
  return client.getJson<T>(`/jsonapi/taxonomy_term/${vocabulary}?filter[status]=1`);
}
