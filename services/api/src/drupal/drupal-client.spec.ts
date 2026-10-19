import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDrupalResource } from './drupal-client';

const PATH = '/jsonapi/node/article';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchDrupalResource', () => {
  it('follows the configured base URL (AC1, AC2)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{"data":[]}', { status: 200 }));

    await fetchDrupalResource(PATH, { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' });
    expect(fetchMock).toHaveBeenCalledWith('http://local.docksal.site/jsonapi/node/article', expect.anything());

    fetchMock.mockClear();
    await fetchDrupalResource(PATH, {
      DRUPAL_BASE_URL: 'https://dev.example-drupal.test',
      DRUPAL_ACCESS_TOKEN: 'test-token',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://dev.example-drupal.test/jsonapi/node/article', expect.anything());
  });

  it('returns the parsed response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"data":[1]}', { status: 200 }));
    await expect(
      fetchDrupalResource(PATH, { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' }),
    ).resolves.toEqual({ data: [1] });
  });

  it('rejects when Drupal answers with a non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 403 }));
    await expect(
      fetchDrupalResource(PATH, { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' }),
    ).rejects.toThrow(/403/);
  });

  it('makes no request when the base URL is not set (AC3)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(fetchDrupalResource(PATH, { DRUPAL_ACCESS_TOKEN: 'test-token' })).rejects.toThrow(/DRUPAL_BASE_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the credential as an OAuth2 bearer token (AC4)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    await fetchDrupalResource(PATH, { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'fake-token' });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fake-token');
  });

  it('contains no host or credential literal in its source (AC5)', () => {
    const source =
      readFileSync(join(__dirname, 'drupal-client.ts'), 'utf8') +
      readFileSync(join(__dirname, 'drupal-config.ts'), 'utf8');
    expect(source).not.toMatch(/:\/\//);
  });

  it('errors and makes no request when the credential is not set (AC6)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(fetchDrupalResource(PATH, { DRUPAL_BASE_URL: 'http://local.docksal.site' })).rejects.toThrow(
      /DRUPAL_ACCESS_TOKEN/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
