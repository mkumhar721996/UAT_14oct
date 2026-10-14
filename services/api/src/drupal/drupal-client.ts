import { DrupalConfig, loadDrupalConfig } from './drupal-config';
import { DrupalRequestError, MissingDrupalBaseUrlError, MissingDrupalCredentialError } from './errors';

export interface DrupalClient {
  getJson<T>(path: string): Promise<T>;
}

export function createDrupalClient(
  config: DrupalConfig = loadDrupalConfig(),
  fetchImpl: typeof fetch = fetch,
): DrupalClient {
  return {
    async getJson<T>(path: string): Promise<T> {
      if (!config.baseUrl) throw new MissingDrupalBaseUrlError();
      if (!config.bearerToken) throw new MissingDrupalCredentialError();

      const url = new URL(path, config.baseUrl).toString();
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${config.bearerToken}`,
          Accept: 'application/vnd.api+json',
        },
      });
      if (!response.ok) throw new DrupalRequestError(response.status, response.statusText);
      return (await response.json()) as T;
    },
  };
}
