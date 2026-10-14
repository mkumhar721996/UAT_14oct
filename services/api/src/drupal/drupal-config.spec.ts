import { describe, expect, it } from 'vitest';
import { loadDrupalConfig } from './drupal-config';

describe('loadDrupalConfig', () => {
  it('returns the configured base URL and token', () => {
    expect(
      loadDrupalConfig({ DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' }),
    ).toEqual({ baseUrl: 'http://local.docksal.site', accessToken: 'test-token' });
  });

  it('throws naming DRUPAL_BASE_URL when it is not set', () => {
    expect(() => loadDrupalConfig({ DRUPAL_ACCESS_TOKEN: 'test-token' })).toThrow(/DRUPAL_BASE_URL/);
  });

  it('throws naming DRUPAL_ACCESS_TOKEN when it is not set', () => {
    expect(() => loadDrupalConfig({ DRUPAL_BASE_URL: 'http://local.docksal.site' })).toThrow(
      /DRUPAL_ACCESS_TOKEN/,
    );
  });
});
