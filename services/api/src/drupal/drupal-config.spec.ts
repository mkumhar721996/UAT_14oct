import { describe, expect, it } from 'vitest';
import { loadDrupalConfig } from './drupal-config';

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe('loadDrupalConfig', () => {
  it('AC2: picks up a changed DRUPAL_BASE_URL with no code change', () => {
    expect(loadDrupalConfig(env({ DRUPAL_BASE_URL: 'http://drupal.docksal.site' })).baseUrl).toBe(
      'http://drupal.docksal.site',
    );
    expect(loadDrupalConfig(env({ DRUPAL_BASE_URL: 'https://dev.example-remote.test' })).baseUrl).toBe(
      'https://dev.example-remote.test',
    );
  });

  it('reads the credential from DRUPAL_API_TOKEN', () => {
    expect(loadDrupalConfig(env({ DRUPAL_API_TOKEN: 'test-token' })).bearerToken).toBe('test-token');
  });

  it('treats unset values as undefined', () => {
    expect(loadDrupalConfig(env({}))).toEqual({ baseUrl: undefined, bearerToken: undefined });
  });

  it('treats a whitespace-only DRUPAL_BASE_URL as unset', () => {
    expect(loadDrupalConfig(env({ DRUPAL_BASE_URL: '   ' })).baseUrl).toBeUndefined();
  });

  it('treats an empty-string DRUPAL_API_TOKEN as unset', () => {
    expect(loadDrupalConfig(env({ DRUPAL_API_TOKEN: '' })).bearerToken).toBeUndefined();
  });
});
