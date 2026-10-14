import { createDrupalClient, DrupalClient } from './drupal-client';

export function fetchPublishedContent<T = unknown>(
  contentType: string,
  client: DrupalClient = createDrupalClient(),
): Promise<T> {
  return client.getJson<T>(`/jsonapi/node/${contentType}?filter[status]=1`);
}
