import { loadDrupalConfig } from './drupal-config';

export class DrupalFetchError extends Error {
  constructor(message: string) {
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
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
  }
  return response.json();
}

// Raw-text sibling of fetchDrupalResource for rendered-HTML responses (legacy paragraph fragments).
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
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
  }
  return response.text();
}
