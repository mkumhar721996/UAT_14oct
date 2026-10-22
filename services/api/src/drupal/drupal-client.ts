import { Logger } from '@nestjs/common';
import { loadDrupalConfig } from './drupal-config';

const logger = new Logger('DrupalClient');

export class DrupalFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrupalFetchError';
  }
}

// Shared by every Drupal fetcher: issues the request and logs its rate/duration/outcome, labelled
// only by the caller-supplied operation name (a fixed, bounded-cardinality label — never the raw
// path or resource id, which could carry an attacker-controlled value into logs).
async function requestDrupal(path: string, env: NodeJS.ProcessEnv, operation: string): Promise<Response> {
  const config = loadDrupalConfig(env);
  const url = new URL(path, config.baseUrl).toString();
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.accessToken}` } });
    const statusClass = response.ok ? 'ok' : `${Math.floor(response.status / 100)}xx`;
    logger.log(`drupal_fetch_outcome count=1 op=${operation} status=${statusClass} duration_ms=${Date.now() - startedAt}`);
    return response;
  } catch (error) {
    logger.warn(`drupal_fetch_outcome count=1 op=${operation} status=network_error duration_ms=${Date.now() - startedAt}`);
    throw error;
  }
}

// Shared request primitive for every Drupal fetcher; config is loaded first so a missing
// variable throws before any network call is made.
export async function fetchDrupalResource(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
  operation = 'unknown',
): Promise<unknown> {
  const response = await requestDrupal(path, env, operation);
  if (!response.ok) {
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
  }
  return response.json();
}

// Raw-text sibling of fetchDrupalResource for rendered-HTML responses (legacy paragraph fragments).
export async function fetchDrupalHtmlFragment(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
  operation = 'unknown',
): Promise<string> {
  const response = await requestDrupal(path, env, operation);
  if (!response.ok) {
    throw new DrupalFetchError(`Drupal request to ${path} failed with status ${response.status}`);
  }
  return response.text();
}
