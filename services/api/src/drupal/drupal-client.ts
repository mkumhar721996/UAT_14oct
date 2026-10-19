import { loadDrupalConfig } from './drupal-config';

export class DrupalFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'DrupalFetchError';
  }
}

// Shared request primitive for every Drupal fetcher; config is loaded first so a missing
// variable throws before any network call is made.
export async function fetchDrupalResource(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const config = loadDrupalConfig(env);
  const url = new URL(path, config.baseUrl).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) {
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`, response.status);
  }
  return response.json();
}

// For legacy paragraph endpoints that answer with rendered markup instead of a JSON:API document.
export async function fetchDrupalHtmlFragment(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const config = loadDrupalConfig(env);
  const url = new URL(path, config.baseUrl).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) {
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`, response.status);
  }
  return response.text();
}
