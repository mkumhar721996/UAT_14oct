export class MissingDrupalBaseUrlError extends Error {
  constructor() {
    super('DRUPAL_BASE_URL environment variable is required');
    this.name = 'MissingDrupalBaseUrlError';
  }
}

export class MissingDrupalCredentialError extends Error {
  constructor() {
    super('DRUPAL_API_TOKEN environment variable is required');
    this.name = 'MissingDrupalCredentialError';
  }
}

export class DrupalRequestError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`Drupal request failed: ${status} ${statusText}`);
    this.name = 'DrupalRequestError';
  }
}
