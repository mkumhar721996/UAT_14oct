export interface DrupalConfig {
  baseUrl?: string;
  bearerToken?: string;
}

// Re-read on every call (never cached) so a changed env var retargets with no code change.
export function loadDrupalConfig(env: NodeJS.ProcessEnv = process.env): DrupalConfig {
  return {
    baseUrl: env.DRUPAL_BASE_URL?.trim() || undefined,
    bearerToken: env.DRUPAL_API_TOKEN?.trim() || undefined,
  };
}
