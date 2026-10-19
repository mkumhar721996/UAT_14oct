export interface DrupalConfig {
  baseUrl: string;
  accessToken: string;
}

export class DrupalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrupalConfigError';
  }
}

// No fallback host or credential: a missing variable must never resolve to a default target.
export function loadDrupalConfig(env: NodeJS.ProcessEnv = process.env): DrupalConfig {
  const baseUrl = env.DRUPAL_BASE_URL ?? '';
  if (!baseUrl) {
    throw new DrupalConfigError('DRUPAL_BASE_URL environment variable is required');
  }
  const accessToken = env.DRUPAL_ACCESS_TOKEN ?? '';
  if (!accessToken) {
    throw new DrupalConfigError('DRUPAL_ACCESS_TOKEN environment variable is required');
  }
  return { baseUrl, accessToken };
}
